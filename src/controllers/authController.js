import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Character, Campaign, CampaignMember, AtributosPersonagem, registrarAuditoria } from "../models/index.js";
import { publicCharacter, DEFAULT_ATRIBUTOS } from "../services/characterPublic.js";
import { gerarToken, hashToken, enviarEmailVerificacao, enviarEmailRedefinicao } from "../services/mailer.js";
import { criarSessao, revogarSessao, revogarTodasSessoes } from "../services/sessionAuth.js";

import { getJwtSecret } from "../services/jwtSecret.js";

function perfilDoUsuario(usuario) {
  return usuario.perfil === "mestre" || usuario.role === "master" ? "mestre" : "jogador";
}

function usuarioParaResposta(usuario) {
  const dados = typeof usuario.toJSON === "function" ? usuario.toJSON() : { ...usuario };
  dados.perfil = perfilDoUsuario(usuario);
  dados.role = dados.perfil === "mestre" ? "master" : "player";
  return dados;
}

const includeAtributos = { model: AtributosPersonagem, as: "atributos", required: false };
function personagemParaResposta(personagem) {
  if (!personagem) return personagem;
  return publicCharacter(personagem);
}


// Emite JWT e registra a sessão server-side (revogável).
async function emitirLogin(usuario, req) {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const token = jwt.sign(
    {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      role: usuario.role,
      perfil: perfilDoUsuario(usuario),
      sessionId,
    },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
  const decodedExp = jwt.decode(token)?.exp;
  const expiraAt = decodedExp ? new Date(decodedExp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await criarSessao({
    usuarioId: usuario.id,
    token,
    expiraAt,
    ip: req?.ip ?? null,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 500) ?? null,
  });
  return token;
}

export const authController = {
  // Registro de novo usuário + criação imediata do primeiro personagem
  async register(req, res) {
    try {
      const {
        username,
        email,
        password,
        characterName,
        characterJob,
        customClass,
        perfil,
        role,
        inviteCode,
        codigoConvite,
      } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Nome de usuário, e-mail e senha são obrigatórios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      }

      // Validação de convite da mesa (se fornecido)
      const rawCode = (inviteCode || codigoConvite || "").trim().toUpperCase();
      let targetCampaign = null;
      if (rawCode) {
        targetCampaign = await Campaign.findOne({
          where: { codigoConvite: rawCode },
        });

        if (!targetCampaign) {
          return res.status(404).json({ error: "Nenhuma mesa de RPG encontrada com este código de convite." });
        }

        if (targetCampaign.estado === "encerrada" || targetCampaign.estado === "arquivada") {
          return res.status(400).json({ error: "Esta mesa de RPG já foi encerrada pelo mestre." });
        }
      }

      // Verifica se username ou e-mail já estão cadastrados
      const normalizedUsername = String(username).trim();
      const normalizedEmail = String(email).trim().toLowerCase();
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username: normalizedUsername }, { email: normalizedEmail }],
        },
      });

      if (existingUser) {
        if (existingUser.username.toLowerCase() === username.toLowerCase()) {
          return res.status(409).json({ error: "Este nome de usuário já está em uso." });
        }
        return res.status(409).json({ error: "Este e-mail já está cadastrado." });
      }

      const selectedPerfil = perfil === "mestre" || role === "master" ? "mestre" : "jogador";
      const selectedRole = selectedPerfil === "mestre" ? "master" : "player";

      // Criação do usuário
      const user = await User.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        perfil: selectedPerfil,
        role: selectedRole,
      });

      // Criação do herói associado à campanha (se convite fornecido)
      const character = await Character.create({
        userId: user.id,
        campanhaId: targetCampaign ? targetCampaign.id : null,
        name: characterName && String(characterName).trim() ? String(characterName).trim() : "Novo Herói",
        job: characterJob && String(characterJob).trim() ? String(characterJob).trim() : "Aventureiro",
        dadosExtras: customClass?.trim() ? { customClass: String(customClass).trim() } : {},
        hp: 70,
        hpMax: 70,
        level: 1,
      });
      // Cria o registro de atributos; falha aqui não pode impedir o cadastro do herói
      try {
        await AtributosPersonagem.create({ personagemId: character.id, ...DEFAULT_ATRIBUTOS });
      } catch (atributosError) {
        console.error("Falha ao criar atributos do personagem:", atributosError?.message || atributosError);
      }

      // Se ingressou via convite, registra como membro da campanha
      if (targetCampaign) {
        await CampaignMember.create({
          campanhaId: targetCampaign.id,
          usuarioId: user.id,
          papel: "jogador",
        });

        await registrarAuditoria({
          usuarioId: user.id,
          campanhaId: targetCampaign.id,
          acao: "ENTRADA_MEMBRO_CADASTRO",
          entidade: "membros_campanha",
          entidadeId: user.id,
          dados: {
            nome: user.username,
            personagemId: character.id,
            nomePersonagem: character.name,
            viaConvite: rawCode,
          },
          ip: req.ip,
        });
      }

      // Verificação de e-mail: gera o token e envia (falha de e-mail não impede o cadastro)
      let devPreviewUrl = null;
      try {
        const { token: emailToken, hash } = gerarToken();
        user.verificationTokenHash = hash;
        user.verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.save();
        const mailResult = await enviarEmailVerificacao({ para: user.email, token: emailToken });
        if (mailResult?.devMode && process.env.NODE_ENV !== "production") {
          devPreviewUrl = mailResult.url;
          console.log(`[MAIL:dev] Link de verificação para ${user.email}: ${mailResult.url}`);
        }
      } catch (mailError) {
        console.error("[MAIL] Falha ao enviar verificação de e-mail:", mailError?.message || mailError);
      }

      // Geração do token JWT (válido por 7 dias) + sessão server-side revogável
      const token = await emitirLogin(user, req);

      // Monta a resposta em memória (evita round-trip e funciona antes do flush)
      const characterBase = typeof character?.toJSON === "function" ? character.toJSON() : { ...character };
      const characterCompleto = {
        ...characterBase,
        atributos: { personagemId: characterBase.id, ...DEFAULT_ATRIBUTOS },
      };

      return res.status(201).json({
        message: targetCampaign
          ? `Conta criada e vinculada com sucesso à mesa "${targetCampaign.nome}"!`
          : "Usuário e personagem criados com sucesso!",
        user: usuarioParaResposta(user),
        character: personagemParaResposta(characterCompleto),
        characters: [personagemParaResposta(characterCompleto)],
        campaign: targetCampaign ? (typeof targetCampaign.toJSON === "function" ? targetCampaign.toJSON() : targetCampaign) : null,
        token,
        ...(devPreviewUrl ? { devPreviewUrl } : {}),
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      return res.status(500).json({ error: error.message || "Erro interno ao cadastrar." });
    }
  },

  // Login com Username ou E-mail e Senha
  async login(req, res) {
    try {
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({ error: "Usuário/E-mail e senha são obrigatórios." });
      }

      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username: login.trim() },
            { email: login.trim().toLowerCase() },
          ],
        },
      });

      if (!user) {
        return res.status(401).json({ error: "Credenciais inválidas. Verifique o usuário e a senha." });
      }

      const isValid = await user.checkPassword(password);
      if (!isValid) {
        return res.status(401).json({ error: "Credenciais inválidas. Verifique o usuário e a senha." });
      }

      // Bloqueio opcional para contas não verificadas (desligado por padrão;
      // ative com REQUIRE_EMAIL_VERIFICATION=true no ambiente).
      if (String(process.env.REQUIRE_EMAIL_VERIFICATION || "").toLowerCase() === "true" && !user.emailVerified) {
        return res.status(403).json({ error: "E-mail ainda não verificado. Confira sua caixa de entrada.", code: "EMAIL_NOT_VERIFIED" });
      }

      // Busca todos os personagens deste usuário
      const characters = await Character.findAll({
        where: { userId: user.id },
        include: [includeAtributos],
        order: [["updated_at", "DESC"]],
      });

      const token = await emitirLogin(user, req);

      return res.json({
        message: "Login realizado com sucesso!",
        user: usuarioParaResposta(user),
        characters: characters.map((character) => {
          return personagemParaResposta(character);
        }),
        token,
      });
    } catch (error) {
      console.error("Erro no login:", error);
      return res.status(500).json({ error: "Erro interno no servidor ao tentar login." });
    }
  },

  // Perfil do usuário atual e seus personagens
  async me(req, res) {
    try {
      const characters = await Character.findAll({
        where: { userId: req.user.id },
        include: [includeAtributos],
        order: [["updated_at", "DESC"]],
      });

      return res.json({
        user: usuarioParaResposta(req.user),
        characters: characters.map(personagemParaResposta),
        session: {
          sessionId: req.tokenPayload?.sessionId || null,
          issuedAt: req.tokenPayload?.iat ? new Date(req.tokenPayload.iat * 1000).toISOString() : null,
          expiresAt: req.tokenPayload?.exp ? new Date(req.tokenPayload.exp * 1000).toISOString() : null,
          role: req.user.role,
          perfil: perfilDoUsuario(req.user),
        },
      });
    } catch (error) {
      console.error("Erro ao obter dados do usuário:", error);
      return res.status(500).json({ error: "Erro ao obter perfil." });
    }
  },

  // Atualização de perfil do usuário (nome, e-mail, perfil/role) com emissão de novo JWT
  async updateProfile(req, res) {
    try {
      const { username, email, perfil, role } = req.body;
      const user = req.user;

      if (username && username.trim()) {
        user.username = username.trim();
      }

      if (email && email.trim()) {
        const nextEmail = email.trim().toLowerCase();
        if (nextEmail !== user.email) {
          const existing = await User.findOne({ where: { email: nextEmail } });
          if (existing && existing.id !== user.id) {
            return res.status(409).json({ error: "Este e-mail já está sendo utilizado por outra conta." });
          }
          user.email = nextEmail;
        }
      }

      // Perfil é uma atribuição administrativa; o cliente não pode se promover.
      const targetPerfil = perfil || (role === "master" ? "mestre" : role === "player" ? "jogador" : null);
      if (targetPerfil && targetPerfil !== perfilDoUsuario(user)) {
        return res.status(403).json({ error: "O perfil só pode ser alterado por um administrador." });
      }
      if (targetPerfil && (targetPerfil === "mestre" || targetPerfil === "jogador")) {
        user.perfil = targetPerfil;
      }

      await user.save();

      const token = await emitirLogin(user, req);

      return res.json({
        message: "Perfil atualizado com sucesso!",
        user: usuarioParaResposta(user),
        token,
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      return res.status(500).json({ error: error.message || "Erro ao atualizar perfil." });
    }
  },

  // Encerramento de sessão
  async logout(req, res) {
    try {
      if (req.user) {
        // Revoga a sessão atual no servidor; o JWT imediatamente deixa de valer.
        req.user.ultimoLoginAt = new Date();
        await req.user.save();
        const authHeader = req.headers?.authorization;
        const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (rawToken) await revogarSessao(rawToken);
      }
      return res.json({
        message: "Sessão encerrada com sucesso. Tokens anteriores foram revogados.",
        revoked: true,
      });
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
      return res.status(500).json({ error: "Erro ao encerrar sessão." });
    }
  },

  // ── Verificação de e-mail e redefinição de senha ─────────────────────────

  // Verifica o token enviado por e-mail e sela a conta
  async verifyEmail(req, res) {
    try {
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: "Token de verificação ausente." });

      const user = await User.findOne({
        where: { verificationTokenHash: hashToken(token) },
      });
      if (!user) {
        return res.status(400).json({ error: "Token inválido ou já utilizado." });
      }
      if (user.verificationExpiresAt && new Date(user.verificationExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Token expirado. Peça um novo e-mail de verificação." });
      }

      user.emailVerified = true;
      user.verificationTokenHash = null;
      user.verificationExpiresAt = null;
      await user.save();
      return res.json({ success: true, message: "E-mail verificado com sucesso!" });
    } catch (error) {
      console.error("Erro ao verificar e-mail:", error);
      return res.status(500).json({ error: "Erro ao verificar o e-mail." });
    }
  },

  // Reenvia o e-mail de verificação (sempre 200, anti-enumeração)
  async resendVerification(req, res) {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

      const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
      if (!user) {
        return res.json({ success: true, message: "Se a conta existir, enviaremos um novo e-mail de verificação." });
      }
      if (user.emailVerified) {
        return res.json({ success: true, message: "Este e-mail já está verificado." });
      }

      const { token: emailToken, hash } = gerarToken();
      user.verificationTokenHash = hash;
      user.verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();
      const mailResult = await enviarEmailVerificacao({ para: user.email, token: emailToken });
      const devPreviewUrl = mailResult?.devMode && process.env.NODE_ENV !== "production" ? mailResult.url : undefined;
      return res.json({
        success: true,
        message: "E-mail de verificação enviado. Confira sua caixa de entrada.",
        ...(devPreviewUrl ? { devPreviewUrl } : {}),
      });
    } catch (error) {
      console.error("Erro ao reenviar verificação:", error);
      return res.status(500).json({ error: "Erro ao enviar o e-mail de verificação." });
    }
  },

  // Pedido de redefinição de senha (sempre 200, anti-enumeração)
  async forgotPassword(req, res) {
    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

      const user = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
      if (!user) {
        return res.json({ success: true, message: "Se a conta existir, enviaremos um link de redefinição." });
      }

      const { token: resetToken, hash } = gerarToken();
      user.resetTokenHash = hash;
      user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await user.save();
      const mailResult = await enviarEmailRedefinicao({ para: user.email, token: resetToken });
      const devPreviewUrl = mailResult?.devMode && process.env.NODE_ENV !== "production" ? mailResult.url : undefined;
      return res.json({
        success: true,
        message: "Se a conta existir, enviaremos um link de redefinição para o e-mail informado.",
        ...(devPreviewUrl ? { devPreviewUrl } : {}),
      });
    } catch (error) {
      console.error("Erro ao pedir redefinição:", error);
      return res.status(500).json({ error: "Erro ao processar o pedido de redefinição." });
    }
  },

  // Redefine a senha com o token recebido por e-mail
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
      if (String(password).length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      }

      const user = await User.findOne({ where: { resetTokenHash: hashToken(token) } });
      if (!user) {
        return res.status(400).json({ error: "Token inválido ou já utilizado." });
      }
      if (user.resetTokenExpiresAt && new Date(user.resetTokenExpiresAt) < new Date()) {
        return res.status(400).json({ error: "Token expirado. Peça um novo link de redefinição." });
      }

      user.password = String(password); // hook beforeUpdate aplica o hash bcrypt
      user.resetTokenHash = null;
      user.resetTokenExpiresAt = null;
      user.passwordChangedAt = new Date(); // revoga JWTs emitidos antes deste momento
      if (!user.emailVerified) user.emailVerified = true; // provou posse do e-mail
      await user.save();
      await revogarTodasSessoes(user.id); // encerra sessões abertas em outros aparelhos

      await registrarAuditoria({
        usuarioId: user.id,
        acao: "REDEFINIR_SENHA",
        entidade: "usuarios",
        entidadeId: user.id,
        dados: { username: user.username },
        ip: req.ip,
      });
      return res.json({ success: true, message: "Senha redefinida com sucesso! Faça login com a nova senha." });
    } catch (error) {
      console.error("Erro ao redefinir senha:", error);
      return res.status(500).json({ error: "Erro ao redefinir a senha." });
    }
  },
};
