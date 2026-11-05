import rateLimit from "express-rate-limit";

const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3000";

export function getAllowedOrigins(env = process.env) {
  const configured = [env.FRONTEND_URL, env.CORS_ORIGIN]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = configured.length > 0 ? configured : [DEFAULT_FRONTEND_ORIGIN];

  if (origins.includes("*")) {
    throw new Error("CORS_ORIGIN/FRONTEND_URL não pode usar wildcard.");
  }
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGIN/FRONTEND_URL contém uma origem inválida.");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || (parsed.pathname !== "/" && parsed.pathname !== "")
    ) {
      throw new Error("CORS_ORIGIN/FRONTEND_URL contém uma origem inválida.");
    }
  }
  return [...new Set(origins)];
}

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite de requisições excedido. Tente novamente mais tarde." },
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Limite de tentativas de autenticação excedido. Tente novamente mais tarde." },
});
