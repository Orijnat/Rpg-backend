// Serviço de e-mail para verificação de conta e redefinição de senha.
// SMTP via variáveis de ambiente (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
// Sem SMTP configurado: registra o link no log do servidor (modo dev) e,
// fora de produção, devolve o link na resposta para facilitar testes locais.
import crypto from "node:crypto";
import nodemailer from "nodemailer";

export function gerarToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

export async function enviarEmail({ para, assunto, html }) {
  if (!isSmtpConfigured()) {
    console.log(`[MAIL:dev] Para: ${para} | Assunto: ${assunto}`);
    return { devMode: true };
  }
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

export async function enviarEmailVerificacao({ para, token }) {
  const url = `${getFrontendUrl()}/verificar-email?token=${encodeURIComponent(token)}`;
  const corpo = `<p>Sua chama acaba de ser acesa no Grimorium. Confirme seu e-mail para selar o vínculo:</p>${botao(url, "Verificar meu e-mail")}<p>Se você não criou esta conta, ignore esta mensagem.</p>`;
  const result = await enviarEmail({ para, assunto: "Grimorium — verifique seu e-mail", html: shell("Selo de Verificação", corpo) });
  return { ...result, url };
}

export async function enviarEmailRedefinicao({ para, token }) {
  const url = `${getFrontendUrl()}/redefinir-senha?token=${encodeURIComponent(token)}`;
  const corpo = `<p>Você pediu para forjar uma nova chave para sua conta. O link expira em 1 hora:</p>${botao(url, "Redefinir minha senha")}<p>Se você não pediu isso, ignore — sua senha continua a mesma.</p>`;
  const result = await enviarEmail({ para, assunto: "Grimorium — redefinição de senha", html: shell("Nova Chave", corpo) });
  return { ...result, url };
}
