// Serviço de e-mail para verificação de conta e redefinição de senha.
// Provedores: EMAIL_PROVIDER=resend (RESEND_API_KEY) ou smtp (SMTP_HOST/SMTP_*).
// Sem provedor configurado: registra no log do servidor (modo dev) e,
// fora de produção, devolve o link/código na resposta para facilitar testes locais.
import crypto from "node:crypto";
import nodemailer from "nodemailer";

export function gerarToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

// Código numérico de 6 dígitos para a verificação de e-mail no primeiro acesso.
export function gerarCodigoVerificacao() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

// Código de 6 dígitos: hash com HMAC-SHA256 (chave = JWT_SECRET) em vez de SHA-256 puro.
// Com SHA-256 puro, um vazamento do banco permitiria varrer as 1M combinações offline
// e verificar a conta de qualquer usuário; o HMAC exige a chave do servidor.
export function hashCodigo(code) {
  const secret = process.env.EMAIL_CODE_SECRET || process.env.JWT_SECRET || "grimorium-dev-insecure-secret";
  return crypto.createHmac("sha256", secret).update(`email-code:${String(code)}`).digest("hex");
}

// Comparação em tempo constante para hashes hex.
export function hashesIguais(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

// Provedores suportados:
//   EMAIL_PROVIDER=resend  -> API HTTP do Resend (RESEND_API_KEY; domínio de testes @resend.dev)
//   EMAIL_PROVIDER=smtp    -> SMTP com nodemailer (SMTP_HOST/PORT/SECURE/USER/PASS)
// Sem provedor configurado, o e-mail apenas loga no console (modo dev).
export function emailProvider() {
  return (process.env.EMAIL_PROVIDER || "").toLowerCase();
}

export function isSmtpConfigured() {
  if (emailProvider() === "resend") return Boolean(process.env.RESEND_API_KEY);
  return Boolean(process.env.SMTP_HOST);
}

async function enviarViaResend({ para, assunto, html }) {
  const from = process.env.SMTP_FROM || process.env.RESEND_FROM || "Grimorium <onboarding@resend.dev>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: para, subject: assunto, html }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Resend API (${resp.status}): ${data?.message || data?.error || resp.statusText || "erro desconhecido"}`);
  }
  return { sent: true, id: data?.id ?? null };
}

export async function enviarEmail({ para, assunto, html }) {
  if (!isSmtpConfigured()) {
    console.log(`[MAIL:dev] Para: ${para} | Assunto: ${assunto}`);
    return { devMode: true };
  }
  if (emailProvider() === "resend") return enviarViaResend({ para, assunto, html });
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Grimorium <no-reply@grimorium.local>",
    to: para,
    subject: assunto,
    html,
  });
  return { sent: true };
}

function shell(titulo, corpo) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0b0d12;padding:32px;font-family:Georgia,serif;color:#e8d5b0">
  <div style="max-width:520px;margin:0 auto;background:#141720;border:1px solid #d69a3d44;border-radius:16px;padding:28px">
    <h1 style="color:#d69a3d;font-size:20px;letter-spacing:1px;margin:0 0 12px">${titulo}</h1>
    ${corpo}
  </div></body></html>`;
}

const botao = (url, texto) =>
  `<a href="${url}" style="display:inline-block;margin:14px 0;padding:12px 22px;background:#d69a3d;color:#0f0d0a;border-radius:10px;text-decoration:none;font-weight:bold">${texto}</a>
   <p style="font-size:12px;color:#8a7355;word-break:break-all">Se o botão não funcionar, copie e cole este link:<br>${url}</p>`;

export async function enviarEmailVerificacao({ para, token, code }) {
  const url = `${getFrontendUrl()}/verificar-email?token=${encodeURIComponent(token)}`;
  const blocoCodigo = code
    ? `<div style="margin:16px 0;padding:14px;background:#141720;border:1px solid #d69a3d44;border-radius:12px;text-align:center">
         <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#d69a3d;margin:0 0 8px">Código de verificação</p>
         <div style="font-family:'Courier New',monospace;font-size:32px;letter-spacing:12px;font-weight:800;color:#f0d9a0">${code}</div>
         <p style="font-size:12px;color:#8a7355;margin:8px 0 0">Expira em 15 minutos. Informe-o antes de entrar pela primeira vez.</p>
       </div>`
    : "";
  const corpo = `<p>Sua chama acaba de ser acesa no Grimorium. Confirme seu e-mail para selar o vínculo:</p>${blocoCodigo}${botao(url, "Verificar meu e-mail")}<p>Se você não criou esta conta, ignore esta mensagem.</p>`;
  const result = await enviarEmail({ para, assunto: "Grimorium — verifique seu e-mail", html: shell("Selo de Verificação", corpo) });
  return { ...result, url, code };
}

export async function enviarEmailRedefinicao({ para, token }) {
  const url = `${getFrontendUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const corpo = `<p>Você pediu para forjar uma nova chave para sua conta. O link expira em 1 hora:</p>${botao(url, "Redefinir minha senha")}<p>Se você não pediu isso, ignore — sua senha continua a mesma.</p>`;
  const result = await enviarEmail({ para, assunto: "Grimorium — redefinição de senha", html: shell("Nova Chave", corpo) });
  return { ...result, url };
}
