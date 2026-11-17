import test from "node:test";
import assert from "node:assert/strict";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

test("mailer: envio via Resend chama a API HTTP com Bearer token", async () => {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_test_key_1234567890";
  process.env.SMTP_FROM = "Grimorium <no-reply@grimorium.dev>";

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id: "email_id_test" }),
    };
  };

  try {
    const { enviarEmail } = await import("../src/services/mailer.js");
    const result = await enviarEmail({ para: "dono@exemplo.com", assunto: "Teste", html: "<p>oi</p>" });

    assert.equal(result.sent, true);
    assert.equal(result.id, "email_id_test");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal(calls[0].options.headers.Authorization, "Bearer re_test_key_1234567890");
    assert.equal(calls[0].options.method, "POST");
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.to, "dono@exemplo.com");
    assert.equal(body.from, "Grimorium <no-reply@grimorium.dev>");
  } finally {
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
  }
});

test("mailer: sem provedor configurado retorna devMode e não chama fetch", async () => {
  delete process.env.EMAIL_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.SMTP_HOST;

  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, statusText: "OK", json: async () => ({}) };
  };

  try {
    const { enviarEmail, isSmtpConfigured } = await import("../src/services/mailer.js");
    assert.equal(isSmtpConfigured(), false);
    const result = await enviarEmail({ para: "dono@exemplo.com", assunto: "Teste", html: "<p>oi</p>" });
    assert.deepEqual(result, { devMode: true });
    assert.equal(calls.length, 0);
  } finally {
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
  }
});

test("mailer: Resend com erro na API lança exceção com o status", async () => {
  process.env.EMAIL_PROVIDER = "resend";
  process.env.RESEND_API_KEY = "re_invalid_key";

  global.fetch = async () => ({
    ok: false,
    status: 403,
    statusText: "Forbidden",
    json: async () => ({ message: "Invalid API key" }),
  });

  try {
    const { enviarEmail } = await import("../src/services/mailer.js");
    await assert.rejects(
      () => enviarEmail({ para: "dono@exemplo.com", assunto: "T", html: "<p>x</p>" }),
      /Resend API \(403\): Invalid API key/,
    );
  } finally {
    Object.assign(process.env, originalEnv);
    global.fetch = originalFetch;
  }
});
