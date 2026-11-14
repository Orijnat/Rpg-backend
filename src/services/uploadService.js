// Pipeline de upload: valida magic bytes, grava fora do público com nome aleatório.
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export const MAX_UPLOAD_BYTES = Math.max(64 * 1024, Number(process.env.UPLOAD_MAX_BYTES || 5 * 1024 * 1024));

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "private_uploads");

// Assinaturas binárias aceitas. Nada fora desta lista entra no servidor.
const SIGNATURES = [
  { mime: "image/png", ext: "png", magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", ext: "gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", ext: "webp", magic: null, check: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { mime: "application/pdf", ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
];

function bytesMatch(buffer, signature) {
  if (signature.magic) {
    for (let i = 0; i < signature.magic.length; i += 1) {
      if (buffer[i] !== signature.magic[i]) return false;
    }
    return true;
  }
  return signature.check(buffer);
}

export function detectMime(buffer) {
  for (const sig of SIGNATURES) {
    if (bytesMatch(buffer, sig)) return { mimeType: sig.mime, ext: sig.ext };
  }
  return null;
}

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".dll", ".msi", ".com", ".bat", ".cmd", ".ps1", ".sh", ".bash",
  ".js", ".mjs", ".cjs", ".jsx", ".ts", ".vbs", ".wsf", ".hta",
  ".html", ".htm", ".xhtml", ".svg", ".xml", ".php", ".jar", ".apk", ".iso", ".scr",
]);

export function checkOriginalName(name) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw Object.assign(new Error(`Extensão bloqueada por segurança: ${ext}`), { status: 400 });
  }
  const safe = String(name || "arquivo").replace(/[^\p{L}\p{N}._ -]/gu, "_").trim().slice(0, 200);
  return { safeName: safe || "arquivo", ext };
}

export async function saveBuffer(buffer, originalName) {
  const { safeName, ext } = checkOriginalName(originalName);
  const detected = detectMime(buffer);
  if (!detected) {
    throw Object.assign(new Error("Tipo de conteúdo não suportado. Envie PNG, JPEG, GIF, WebP ou PDF."), { status: 415 });
  }
  const allowedExts = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/gif": [".gif"], "image/webp": [".webp"], "application/pdf": [".pdf"] }[detected.mimeType];
  if (allowedExts && ext && !allowedExts.includes(ext)) {
    throw Object.assign(new Error(`Extensão ${ext} não corresponde ao conteúdo real do arquivo (${detected.mimeType}).`), { status: 415 });
  }

  const nomeInterno = `${Date.now().toString(36)}-${crypto.randomBytes(16).toString("hex")}.${detected.ext}`;
  const destino = path.join(UPLOAD_ROOT, nomeInterno);
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
  await fs.writeFile(destino, buffer, { mode: 0o600 });

  const hashSha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  return { nomeInterno, destino, hashSha256, tamanhoBytes: buffer.length, mimeType: detected.mimeType, nomeOriginal: safeName };
}

export async function removeFile(nomeInterno) {
  const destino = path.join(UPLOAD_ROOT, path.basename(nomeInterno));
  try {
    await fs.unlink(destino);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function caminhoPrivado(nomeInterno) {
  return path.join(UPLOAD_ROOT, path.basename(nomeInterno));
}

// Links de leitura assinados (curta duração) — o <img> do navegador não envia Authorization.
const READ_TOKEN_TTL_MS = Math.max(60_000, Number(process.env.UPLOAD_READ_TTL_MS || 15 * 60 * 1000));

export function signReadToken(arquivoId) {
  const expiresAt = Date.now() + READ_TOKEN_TTL_MS;
  const payload = `${arquivoId}.${expiresAt}`;
  const secret = process.env.JWT_SECRET || "upload-dev-secret";
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return { readToken: `${payload}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyReadToken(arquivoId, readToken) {
  if (!readToken || typeof readToken !== "string") return false;
  const parts = readToken.split(".");
  if (parts.length !== 3) return false;
  const [id, expiresRaw, signature] = parts;
  if (id !== arquivoId) return false;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const payload = `${id}.${expiresAt}`;
  const secret = process.env.JWT_SECRET || "upload-dev-secret";
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
