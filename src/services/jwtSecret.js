import crypto from "node:crypto";

let cachedSecret = null;

// Centraliza a leitura do JWT_SECRET; falha rápido se ausente.
export function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado no servidor.");
  }
  cachedSecret = secret;
  return cachedSecret;
}

export default getJwtSecret;
