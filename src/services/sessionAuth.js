import crypto from "node:crypto";
import { SessaoAutenticacao } from "../models/index.js";

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export async function criarSessao({ usuarioId, token, expiraAt, ip = null, userAgent = null }) {
  return SessaoAutenticacao.create({
    usuarioId,
    tokenHash: hashToken(token),
    ip,
    userAgent,
    expiraAt,
  });
}

export async function verificarSessao(token) {
  const sessao = await SessaoAutenticacao.findOne({ where: { tokenHash: hashToken(token) } });
  if (!sessao) return null;
  if (sessao.revogadaAt) return null;
  if (new Date(sessao.expiraAt) <= new Date()) return null;
  return sessao;
}

export async function revogarSessao(token) {
  return SessaoAutenticacao.update(
    { revogadaAt: new Date() },
    { where: { tokenHash: hashToken(token) } },
  );
}

export async function revogarTodasSessoes(usuarioId) {
  return SessaoAutenticacao.update(
    { revogadaAt: new Date() },
    { where: { usuarioId, revogadaAt: null } },
  );
}
