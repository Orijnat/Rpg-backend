import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Character, Campaign, CampaignMember, AtributosPersonagem, Race, Class, registrarAuditoria } from "../models/index.js";
import { publicCharacter, DEFAULT_ATRIBUTOS, atributosFromPayload } from "../services/characterPublic.js";
import { resolveRaca } from "../services/racaService.js";
import { resolveClasse } from "../services/classeService.js";
import { hitDieMax } from "../services/hitDie.js";

import { criarSessao, revogarSessao } from "../services/sessionAuth.js";

import { getJwtSecret } from "../services/jwtSecret.js";

function perfilDoUsuario(usuario) {
  return usuario.perfil === "mestre" || usuario.role === "master" ? "mestre" : "jogador";
}

function usuarioParaResposta(usuario) {
  const dados = typeof usuario.toJSON === "function" ? usuario.toJSON() : { ...usuario };
  if (dados.password) delete dados.password;
  dados.perfil = perfilDoUsuario(usuario);
  dados.role = dados.perfil === "mestre" ? "master" : "player";
  return dados;
}

const includeAtributos = { model: AtributosPersonagem, as: "atributos", required: false };
const includeRaca = { model: Race, as: "raca", attributes: ["id", "slug", "nome", "dado_de_vida"] };
const includeClasse = { model: Class, as: "classe", attributes: ["id", "slug", "nome", "dado_de_vida"] };
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
  // Registro de novo usuário. Jogadores ganham a criação imediata do primeiro
  // personagem; mestres NUNCA ganham ficha (não são jogadores).
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
        confirmPassword,
      } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Nome de usuário, e-mail e senha são obrigatórios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      }
      if (confirmPassword !== undefined && confirmPassword !== password) {
        return res.status(422).json({ error: "As senhas informadas não coincidem." });
      }

      const selectedPerfil = perfil === "mestre" || role === "master" ? "mestre" : "jogador";
      const selectedRole = selectedPerfil === "mestre" ? "master" : "player";

      // A raça é resolvida contra a tabela `racas` (id ou slug); a fonte de verdade dos atributos e do dado de vida.
      let raca = null;
      if (selectedPerfil === "jogador") {
        const heroName = characterName ? String(characterName).trim() : "";
        const heroJob = characterJob ? String(characterJob).trim() : "";
        if (!heroName || !heroJob) {
          return res.status(400).json({ error: "Informe o nome e a classe do herói." });
        }
        raca = await resolveRaca(req.body);
        // A raça é OPCIONAL no cadastro: o jogador a escolhe depois, num campo próprio na ficha.
      }
      // A classe também é opcional no cadastro (escolhida depois na ficha); quando presente,
      // ela é a fonte de verdade do Dado de Vida / HP inicial.
      let classe = null;
      const classeIdInput = req.body.classeId ?? req.body.classId ?? null;
      if (selectedPerfil === "jogador" && (classeIdInput || req.body.classe)) {
        classe = await resolveClasse({ classId: classeIdInput, class: req.body.classe });
        if (!classe) {
          return res.status(400).json({ error: "Classe inválida ou não encontrada." });
        }
      }

      // Validação de convite da mesa (se fornecido) — exclusiva de jogadores
      const rawCode = (inviteCode || codigoConvite || "").trim().toUpperCase();
      if (rawCode && selectedPerfil === "mestre") {
        return res.status(400).json({ error: "Código de convite de mesa é exclusivo para contas de jogador." });
      }
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

      // Criação do usuário
      const user = await User.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password,
        perfil: selectedPerfil,
        role: selectedRole,
      });

      // Criação do herói associado (apenas jogadores; mestres não recebem ficha)
      let character = null;
      if (selectedPerfil !== "mestre") {
        const clampAttr = (value) => Math.max(1, Math.min(30, Math.floor(Number(value)) || 10));
        const attrSource = atributosFromPayload(req.body);
        const atributos = Object.fromEntries(
          Object.entries(attrSource).map(([key, value]) => [key, clampAttr(value)])
        );
        const extras = {
          ...(customClass?.trim() ? { customClass: String(customClass).trim() } : {}),
          ...(raca ? { race: raca.slug } : {}),
          ...(classe ? { class: classe.slug, hitDie: classe.dadoDeVida } : (raca ? { hitDie: raca.dadoDeVida } : {})),
        };
        const baseHp = classe ? hitDieMax(classe.dadoDeVida, 70) : (raca ? hitDieMax(raca.dadoDeVida, 70) : 70);
        character = await Character.create({
          userId: user.id,
          campanhaId: targetCampaign ? targetCampaign.id : null,
          name: String(characterName).trim(),
          job: String(characterJob).trim(),
          racaId: raca?.id ?? null,
          classeId: classe?.id ?? null,
          dadosExtras: extras,
          hp: baseHp,
          hpMax: baseHp,
          level: 1,
        });
        // Cria o registro de atributos; falha aqui não pode impedir o cadastro do herói
        try {
          await AtributosPersonagem.create({ personagemId: character.id, ...atributos });
        } catch (atributosError) {
          console.error("Falha ao criar atributos do personagem:", atributosError?.message || atributosError);
        }
      }

      // Se ingressou via convite, registra como membro da campanha (somente jogadores)
      if (targetCampaign && character) {
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

      // Geração do token JWT (válido por 7 dias) + sessão server-side revogável
      const token = await emitirLogin(user, req);

      // Monta a resposta em memória (evita round-trip e funciona antes do flush)
      const payload = {
        message: targetCampaign
          ? `Conta criada e vinculada com sucesso à mesa "${targetCampaign.nome}"!`
          : selectedPerfil === "mestre"
            ? "Conta de mestre criada com sucesso!"
            : "Usuário e personagem criados com sucesso!",
        user: usuarioParaResposta(user),
        campaign: targetCampaign ? (typeof targetCampaign.toJSON === "function" ? targetCampaign.toJSON() : targetCampaign) : null,
        token,
      };

      if (character) {
        const characterBase = typeof character.toJSON === "function" ? character.toJSON() : { ...character };
        const characterCompleto = {
          ...characterBase,
          ...(classe
            ? { classe: { id: classe.id, slug: classe.slug, nome: classe.nome, dadoDeVida: classe.dadoDeVida } }
            : {}),
          atributos: { personagemId: characterBase.id, ...DEFAULT_ATRIBUTOS },
        };
        payload.character = personagemParaResposta(characterCompleto);
        payload.characters = [personagemParaResposta(characterCompleto)];
      } else {
        payload.characters = [];
      }

      return res.status(201).json(payload);
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
      // Busca todos os personagens deste usuário
      const characters = await Character.findAll({
        where: { userId: user.id },
        include: [includeAtributos, includeRaca, includeClasse],
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
        include: [includeAtributos, includeRaca, includeClasse],
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
};
