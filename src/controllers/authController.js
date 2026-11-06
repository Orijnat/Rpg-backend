import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Character, Campaign, CampaignMember, registrarAuditoria } from "../models/index.js";

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado.");
  }
  return process.env.JWT_SECRET;
}

function perfilDoUsuario(usuario) {
  return usuario.perfil === "mestre" || usuario.role === "master" ? "mestre" : "jogador";
}

function usuarioParaResposta(usuario) {
  const dados = typeof usuario.toJSON === "function" ? usuario.toJSON() : { ...usuario };
  dados.perfil = perfilDoUsuario(usuario);
  dados.role = dados.perfil === "mestre" ? "master" : "player";
  return dados;
}

function personagemParaResposta(personagem) {
  const dados = personagem.toJSON ? personagem.toJSON() : { ...personagem };
  delete dados.bankPassword;
  return dados;
}

function tokenParaUsuario(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      perfil: perfilDoUsuario(user),
      sessionId: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    getJwtSecret(),
    { expiresIn: "7d" },
  );
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

      // Geração do token JWT (válido por 7 dias)
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          perfil: perfilDoUsuario(user),
          sessionId,
        },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: targetCampaign
          ? `Conta criada e vinculada com sucesso à mesa "${targetCampaign.nome}"!`
          : "Usuário e personagem criados com sucesso!",
        user: usuarioParaResposta(user),
        character: personagemParaResposta(character),
        characters: [personagemParaResposta(character)],
        campaign: targetCampaign ? (typeof targetCampaign.toJSON === "function" ? targetCampaign.toJSON() : targetCampaign) : null,
        token,
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

      // Busca todos os personagens deste usuário
      const characters = await Character.findAll({
        where: { userId: user.id },
        order: [["updated_at", "DESC"]],
      });

      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          perfil: perfilDoUsuario(user),
          sessionId,
        },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

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

      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          perfil: perfilDoUsuario(user),
          sessionId,
        },
        getJwtSecret(),
        { expiresIn: "7d" }
      );

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
        user_logout: {
          req.user.ultimoLoginAt = new Date();
          await req.user.save();
        }
      }
      return res.json({
        message: "Sessão encerrada com sucesso.",
        revoked: true,
      });
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
      return res.status(500).json({ error: "Erro ao encerrar sessão." });
    }
  },
};
