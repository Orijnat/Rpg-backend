import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { characterController } from "../src/controllers/characterController.js";
import { Character, AtributosPersonagem } from "../src/models/index.js";

// Contrato de concorrência otimista do /characters/sync (A-07):
// - updatedAt estagnado → 409 com conflict:true + serverCharacter
// - force:true → sobrescreve (200)
// - sem updatedAt → tolerado (legado)

const USER = { id: "user-sync-1", perfil: "jogador", role: "player", username: "tester" };

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

function makeTarget({ updatedAt = new Date("2026-11-14T12:00:00.000Z") } = {}) {
  return {
    id: "char-sync-1",
    userId: USER.id,
    campanhaId: null,
    updated_at: updatedAt,
    dadosExtras: {},
    async update() {
      return this;
    },
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        campanhaId: this.campanhaId,
        name: "Herói de Teste",
        hp: 50,
        hpMax: 70,
        dadosExtras: { notes: "x" },
        created_at: new Date("2026-11-01T00:00:00.000Z"),
        updated_at: new Date(updatedAt.getTime() + 60 * 60 * 1000), // servidor avançou após o save
      };
    },
  };
}

function withMockedCharacter(t, target) {
  const originalFindByPk = Character.findByPk;
  const originalAtributosFindOne = AtributosPersonagem.findOne;
  let call = 0;
  Character.findByPk = async () => {
    call += 1;
    return target;
  };
  AtributosPersonagem.findOne = async () => ({}); // registro existente: patch vazio não toca no banco
  t.after(() => {
    Character.findByPk = originalFindByPk;
    AtributosPersonagem.findOne = originalAtributosFindOne;
  });
  return () => call;
}

test("sync sem id → 400", async () => {
  const res = mockRes();
  await characterController.sync({ user: USER, body: { name: "Sem ID" } }, res);
  assert.equal(res.statusCode, 400);
});

test("sync com updatedAt estagnado → 409 com serverCharacter", async (t) => {
  const target = makeTarget({ updatedAt: new Date("2026-11-14T12:00:00.000Z") });
  withMockedCharacter(t, target);
  const res = mockRes();
  await characterController.sync({
    user: USER,
    body: { id: target.id, notes: "rascunho", updatedAt: "2020-01-01T00:00:00.000Z" },
  }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.conflict, true);
  assert.ok(res.body?.serverCharacter?.id, "deve devolver a versão remota");
});

test("sync com force:true ignora o conflito → 200", async (t) => {
  const target = makeTarget({ updatedAt: new Date("2026-11-14T12:00:00.000Z") });
  withMockedCharacter(t, target);
  const res = mockRes();
  await characterController.sync({
    user: USER,
    body: { id: target.id, notes: "rascunho", updatedAt: "2020-01-01T00:00:00.000Z", force: true },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
});

test("sync com updatedAt igual ao servidor → 200", async (t) => {
  const serverTime = new Date("2026-11-14T12:00:00.000Z");
  const target = makeTarget({ updatedAt: serverTime });
  withMockedCharacter(t, target);
  const res = mockRes();
  await characterController.sync({
    user: USER,
    body: { id: target.id, notes: "rascunho", updatedAt: serverTime.toISOString() },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
});

test("sync sem updatedAt → tolerado (legado) → 200", async (t) => {
  const target = makeTarget({ updatedAt: new Date("2026-11-14T12:00:00.000Z") });
  withMockedCharacter(t, target);
  const res = mockRes();
  await characterController.sync({
    user: USER,
    body: { id: target.id, notes: "rascunho legado" },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
});
