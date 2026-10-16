import { Op } from "sequelize";
import jwt from "jsonwebtoken";
import { User, Character } from "../models/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_rpg_ficha_key_2026_dev";

function perfilDoUsuario(usuario) {
  return usuario.perfil === "mestre" || usuario.role === "master" ? "mestre" : "jogador";
}

function usuarioParaResposta(usuario) {
  const dados = usuario.toJSON();
  dados.perfil = perfilDoUsuario(usuario);
  dados.role = dados.perfil === "mestre" ? "master" : "player";
  return dados;
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
      } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: "Nome de usuário, e-mail e senha são obrigatórios." });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
      }

      // Verifica se username ou e-mail já estão cadastrados
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }],
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
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        perfil: "jogador",
        role: "player",
      });

      // Criação do personagem inicial vinculado ao usuário
      const character = await Character.create({
        userId: user.id,
        name: characterName && characterName.trim() ? characterName.trim() : "Novo Herói",
        job: characterJob && characterJob.trim() ? characterJob.trim() : "Aventureiro",
        hp: 70,
        hpMax: 70,
        level: 1,
      });

      // Geração do token JWT (válido por 7 dias)
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, perfil: perfilDoUsuario(user) },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.status(201).json({
        message: "Usuário e personagem criados com sucesso!",
        user: usuarioParaResposta(user),
        character,
        characters: [character],
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
        order: [["updatedAt", "DESC"]],
      });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, perfil: perfilDoUsuario(user) },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        message: "Login realizado com sucesso!",
        user: usuarioParaResposta(user),
        characters,
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
        order: [["updatedAt", "DESC"]],
      });

      return res.json({
        user: usuarioParaResposta(req.user),
        characters,
      });
    } catch (error) {
      console.error("Erro ao obter dados do usuário:", error);
      return res.status(500).json({ error: "Erro ao obter perfil." });
    }
  },
};
