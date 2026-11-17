// Segurança de autenticação: login (anti-enumeração) e authMiddleware (revogação).
// Modelos Sequelize mockados como em test/invite_flow.test.js.
import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { authController } from "../src/controllers/authController.js";
import { authMiddleware } from "../src/middlewares/authMiddleware.js";
import { User, Character, SessaoAutenticacao } from "../src/models/index.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}
const asReq = (over = {}) => ({
  headers: {},
  params: {},
  body: {},
  ip: "127.0.0.1",
  ...over,
});

function withMocks(map, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(map)) {
    const [modelName, method] = key.split(".");
    const model = { User, Character, SessaoAutenticacao }[modelName];
    originals[key] = model[method];
    model[method] = value;
  }
  const restore = () => {
    for (const [key] of Object.entries(map)) {
      const [modelName, method] = key.split(".");
      const model = { User, Character, SessaoAutenticacao }[modelName];
      model[method] = originals[key];
    }
  };
  return Promise.resolve()
    .then(fn)
    .finally(restore);
}

const fakeUser = {
  id: "user-sec-1",
  username: "jogadorseguro",
  email: "seguro@test.dev",
  ativo: true,
  perfil: "jogador",
  role: "player",
  passwordChangedAt: null,
  checkPassword: async (plain) => plain === "senha-correta",
};

test("Login — credenciais e enumeração", async (t) => {
  await t.test("sucesso retorna token e nunca o hash", async () => {
    await withMocks({
      "User.findOne": async () => fakeUser,
      "Character.findAll": async () => [],
      "SessaoAutenticacao.create": async () => ({}),
    }, async () => {
      const res = mockRes();
      await authController.login(asReq({ body: { login: "jogadorseguro", password: "senha-correta" } }), res);
      assert.equal(res.statusCode, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.senha, undefined);
      assert.equal(res.body.user.senhaHash, undefined);
    });
  });

  await t.test("senha errada → 401 com a MESMA mensagem de usuário inexistente (anti-enumeração)", async () => {
    await withMocks({
      "User.findOne": async () => fakeUser,
    }, async () => {
      const res = mockRes();
      await authController.login(asReq({ body: { login: "jogadorseguro", password: "errada" } }), res);
      assert.equal(res.statusCode, 401);
      assert.match(res.body.error, /Credenciais inválidas/);
    });
  });

  await t.test("usuário inexistente → 401 com a mesma mensagem", async () => {
    await withMocks({
      "User.findOne": async () => null,
    }, async () => {
      const res = mockRes();
      await authController.login(asReq({ body: { login: "quem-nao-existe", password: "qualquer" } }), res);
      assert.equal(res.statusCode, 401);
      assert.match(res.body.error, /Credenciais inválidas/);
    });
  });
});

test("authMiddleware — JWT e revogação server-side", async (t) => {
  const secret = process.env.JWT_SECRET;
  const validToken = jwt.sign({ id: fakeUser.id, sessionId: "sess-test" }, secret, { expiresIn: "1h" });

  await t.test("sem Authorization → 401", async () => {
    await withMocks({}, async () => {
      const res = mockRes();
      let called = false;
      await authMiddleware(asReq(), res, () => { called = true; });
      assert.equal(res.statusCode, 401);
      assert.equal(called, false);
    });
  });

  await t.test("JWT expirado → 401", async () => {
    const expired = jwt.sign({ id: fakeUser.id, sessionId: "sess-x" }, secret, { expiresIn: "-1s" });
    await withMocks({}, async () => {
      const res = mockRes();
      await authMiddleware(asReq({ headers: { authorization: `Bearer ${expired}` } }), res, () => {});
      assert.equal(res.statusCode, 401);
    });
  });

  await t.test("JWT com secret errada → 401", async () => {
    const forged = jwt.sign({ id: fakeUser.id, sessionId: "sess-forged" }, "secret-completamente-errado-mas-longo-o-suficiente", { expiresIn: "1h" });
    await withMocks({}, async () => {
      const res = mockRes();
      await authMiddleware(asReq({ headers: { authorization: `Bearer ${forged}` } }), res, () => {});
      assert.equal(res.statusCode, 401);
    });
  });

  await t.test("usuário removido da base → 401", async () => {
    await withMocks({ "User.findByPk": async () => null }, async () => {
      const res = mockRes();
      await authMiddleware(asReq({ headers: { authorization: `Bearer ${validToken}` } }), res, () => {});
      assert.equal(res.statusCode, 401);
    });
  });

  await t.test("senha alterada depois do token → 401 (revogação por passwordChangedAt)", async () => {
    await withMocks({
      "User.findByPk": async () => ({ ...fakeUser, passwordChangedAt: new Date() }),
    }, async () => {
      const res = mockRes();
      await authMiddleware(asReq({ headers: { authorization: `Bearer ${validToken}` } }), res, () => {});
      assert.equal(res.statusCode, 401);
      assert.match(res.body.error, /alteração de senha/i);
    });
  });

  await t.test("sessão revogada no servidor → 401 (logout/reset imediato)", async () => {
    await withMocks({
      "User.findByPk": async () => ({ ...fakeUser }),
      "SessaoAutenticacao.findOne": async () => null, // revogada ou inexistente
    }, async () => {
      const res = mockRes();
      await authMiddleware(asReq({ headers: { authorization: `Bearer ${validToken}` } }), res, () => {});
      assert.equal(res.statusCode, 401);
      assert.match(res.body.error, /Sessão revogada/i);
    });
  });

  await t.test("token válido com sessão válida → next() com req.user populado", async () => {
    await withMocks({
      "User.findByPk": async () => ({ ...fakeUser }),
      "SessaoAutenticacao.findOne": async () => ({ revogadaAt: null, expiraAt: new Date(Date.now() + 3600_000) }),
    }, async () => {
      const res = mockRes();
      const req = asReq({ headers: { authorization: `Bearer ${validToken}` } });
      let called = false;
      await authMiddleware(req, res, () => { called = true; });
      assert.equal(called, true);
      assert.equal(req.user.id, fakeUser.id);
      assert.equal(typeof req.user.isJogador, "function");
    });
  });
});
