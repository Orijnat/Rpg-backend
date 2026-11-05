import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

function ensureJwtSecret(res) {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: "Autenticação indisponível por configuração do servidor." });
    return false;
  }
  return true;
}

export async function authMiddleware(req, res, next) {
  try {
    if (!ensureJwtSecret(res)) return;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Token de autenticação não fornecido." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user || user.ativo === false) {
      return res.status(401).json({ error: "Usuário não encontrado ou sessão inválida." });
    }

    req.user = user;
    req.user.isMestre = () => user.perfil === "mestre" || user.role === "master";
    req.user.isJogador = () => user.perfil === "jogador" || user.role === "player";
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    console.warn("Falha de autenticação.");
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export async function optionalAuthMiddleware(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) return next();
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);
      if (user) {
        req.user = user;
        req.user.isMestre = () => user.perfil === "mestre" || user.role === "master";
        req.user.isJogador = () => user.perfil === "jogador" || user.role === "player";
        req.tokenPayload = decoded;
      }
    }
  } catch (error) {
    // Apenas ignora em modo opcional
  }
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Você não tem permissão para acessar este recurso." });
    }
    next();
  };
}

export function requireMaster(req, res, next) {
  if (!req.user || (!req.user.isMestre?.() && req.user.role !== "master")) {
    return res.status(403).json({ error: "Acesso restrito ao perfil de Mestre de Campanha." });
  }
  next();
}

export function requirePlayer(req, res, next) {
  if (!req.user || (!req.user.isJogador?.() && req.user.role !== "player")) {
    return res.status(403).json({ error: "Acesso restrito ao perfil de Jogador." });
  }
  next();
}
