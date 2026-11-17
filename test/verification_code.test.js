// Verificação de e-mail por código: HMAC, limite de tentativas e flag REQUIRE_EMAIL_VERIFICATION.
// Modelos Sequelize mockados no padrão de test/security_auth.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { authController } from "../src/controllers/authController.js";
import { hashCodigo, hashesIguais, hashToken } from "../src/services/mailer.js";
import { User, Character, SessaoAutenticacao } from "../src/models/index.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
const asReq = (over = {}) => ({ body: {}, ip: "127.0.0.1", headers: {}, params: {}, ...over });

function withUserFindOne(fakeUser, fn) {
  const original = User.findOne;
  User.findOne = async () => fakeUser;
  return Promise.resolve().then(fn).finally(() => { User.findOne = original; });
}

function makeFakeUser(overrides = {}) {
  const user = {
    id: "user-vc-1",
    username: "codificado",
    email: "codigo@test.dev",
    perfil: "jogador",
    role: "player",
    emailVerified: false,
    verificationTokenHash: "tok",
    verificationExpiresAt: new Date(Date.now() + 3600_000),
    verificationCodeHash: hashCodigo("123456"),
    verificationCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    verificationAttempts: 0,
    passwordChangedAt: null,
    checkPassword: async (plain) => plain === "senha-correta",
    saved: 0,
    async save() { this.saved += 1; return this; },
    ...overrides,
  };
  return user;
}

test("mailer: hashCodigo usa HMAC (não casa com SHA-256 puro) e hashesIguais compara de forma segura", () => {
  const sha256Puro = crypto.createHash("sha256").update("123456").digest("hex");
  assert.notEqual(hashCodigo("123456"), sha256Puro);
  assert.equal(hashCodigo("123456"), hashCodigo("123456"));
  assert.notEqual(hashCodigo("123456"), hashCodigo("123457"));
  assert.equal(hashesIguais("abcd", "abcd"), true);
  assert.equal(hashesIguais("abcd", "abce"), false);
  assert.equal(hashesIguais("abcd", "abc"), false);
  assert.equal(hashesIguais("", ""), true);
});

test("verify-email-code: sucesso sela a conta, zera tentativas e limpa o código", async () => {
  const fakeUser = makeFakeUser();
  await withUserFindOne(fakeUser, async () => {
    const res = mockRes();
    await authController.verifyEmailCode(asReq({ body: { email: "CODIGO@test.dev", code: "123456" } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(fakeUser.emailVerified, true);
    assert.equal(fakeUser.verificationCodeHash, null);
    assert.equal(fakeUser.verificationCodeExpiresAt, null);
    assert.equal(fakeUser.verificationAttempts, 0);
    assert.ok(fakeUser.saved >= 1);
  });
});

test("verify-email-code: código errado incrementa tentativas; na 5ª o código é invalidado e o código certo deixa de valer", async () => {
  const fakeUser = makeFakeUser();
  await withUserFindOne(fakeUser, async () => {
    for (let i = 1; i <= 4; i += 1) {
      const res = mockRes();
      await authController.verifyEmailCode(asReq({ body: { email: "codigo@test.dev", code: "999999" } }), res);
      assert.equal(res.statusCode, 400);
      assert.equal(fakeUser.verificationAttempts, i);
      assert.ok(fakeUser.verificationCodeHash, "código ainda válido antes do limite");
    }
    const res5 = mockRes();
    await authController.verifyEmailCode(asReq({ body: { email: "codigo@test.dev", code: "999999" } }), res5);
    assert.equal(res5.statusCode, 400);
    assert.equal(fakeUser.verificationAttempts, 5);
    assert.equal(fakeUser.verificationCodeHash, null, "código invalidado na 5ª tentativa errada");

    const res6 = mockRes();
    await authController.verifyEmailCode(asReq({ body: { email: "codigo@test.dev", code: "123456" } }), res6);
    assert.equal(res6.statusCode, 400);
    assert.match(res6.body.error, /[Mm]uitas tentativas/);
    assert.equal(fakeUser.emailVerified, false);
  });
});

test("verify-email-code: código expirado retorna 400 sem verificar", async () => {
  const fakeUser = makeFakeUser({ verificationCodeExpiresAt: new Date(Date.now() - 1000) });
  await withUserFindOne(fakeUser, async () => {
    const res = mockRes();
    await authController.verifyEmailCode(asReq({ body: { email: "codigo@test.dev", code: "123456" } }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /expirado/i);
    assert.equal(fakeUser.emailVerified, false);
  });
});

test("login: REQUIRE_EMAIL_VERIFICATION ausente bloqueia não verificado com EMAIL_NOT_VERIFIED; 'false' libera", async (t) => {
  const envBackup = process.env.REQUIRE_EMAIL_VERIFICATION;
  const originalFindAll = Character.findAll;
  const originalSessaoCreate = SessaoAutenticacao.create;
  Character.findAll = async () => [];
  SessaoAutenticacao.create = async () => ({});
  t.after(() => {
    if (envBackup === undefined) delete process.env.REQUIRE_EMAIL_VERIFICATION;
    else process.env.REQUIRE_EMAIL_VERIFICATION = envBackup;
    Character.findAll = originalFindAll;
    SessaoAutenticacao.create = originalSessaoCreate;
  });

  const unverified = makeFakeUser();
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  await withUserFindOne(unverified, async () => {
    const res = mockRes();
    await authController.login(asReq({ body: { login: "codificado", password: "senha-correta" } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, "EMAIL_NOT_VERIFIED");
    assert.equal(res.body.token, undefined);
  });

  const unverified2 = makeFakeUser();
  process.env.REQUIRE_EMAIL_VERIFICATION = "false";
  await withUserFindOne(unverified2, async () => {
    const res = mockRes();
    await authController.login(asReq({ body: { login: "codificado", password: "senha-correta" } }), res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
  });
});

test("hashToken continua SHA-256 simples (tokens de link/sessão não usam HMAC)", () => {
  const esperado = crypto.createHash("sha256").update("abc").digest("hex");
  assert.equal(hashToken("abc"), esperado);
});
