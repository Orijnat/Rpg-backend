// DELETE /api/classes/:id — a remoção é exclusiva do mestre que criou a classe
// (criado_por). Classes seed e as criadas automaticamente no cadastro de jogadores
// não podem ser removidas — apenas editadas.
import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { classController } from "../src/controllers/classController.js";
import { Class } from "../src/models/index.js";

const MASTER_A = { id: "mestre-a-uuid", perfil: "mestre", role: "master", username: "mestreA" };
const MASTER_B = { id: "mestre-b-uuid", perfil: "mestre", role: "master", username: "mestreB" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

function withRow(t, criadoPor) {
  const originalFindByPk = Class.findByPk;
  const destroyCalls = [];
  const row = {
    id: "classe-alvo-1",
    slug: "netumance",
    nome: "Necromante",
    dadoDeVida: "1d8",
    criadoPor,
    async destroy() {
      destroyCalls.push(this.id);
      return this;
    },
  };
  Class.findByPk = async () => row;
  t.after(() => {
    Class.findByPk = originalFindByPk;
  });
  return { destroyCalls };
}

test("mestre dono da classe consegue remover a própria classe", async (t) => {
  const { destroyCalls } = withRow(t, MASTER_A.id);
  const res = mockRes();
  await classController.remove({ user: MASTER_A, params: { id: "classe-alvo-1" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.deepEqual(destroyCalls, ["classe-alvo-1"]);
});

test("outro mestre recebe 403 e a classe NÃO é removida", async (t) => {
  const { destroyCalls } = withRow(t, MASTER_A.id);
  const res = mockRes();
  await classController.remove({ user: MASTER_B, params: { id: "classe-alvo-1" } }, res);
  assert.equal(res.statusCode, 403);
  assert.ok(res.body?.error);
  assert.deepEqual(destroyCalls, []);
});

test("classe seed (criado_por nulo) não pode ser removida por nenhum mestre", async (t) => {
  const { destroyCalls } = withRow(t, null);
  const res = mockRes();
  await classController.remove({ user: MASTER_A, params: { id: "classe-alvo-1" } }, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(destroyCalls, []);
});

test("classe criada automaticamente no cadastro de jogador não pode ser removida por mestre", async (t) => {
  const { destroyCalls } = withRow(t, "jogador-do-cadastro-uuid");
  const res = mockRes();
  await classController.remove({ user: MASTER_A, params: { id: "classe-alvo-1" } }, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(destroyCalls, []);
});

test("classe inexistente retorna 404", async (t) => {
  const originalFindByPk = Class.findByPk;
  Class.findByPk = async () => null;
  t.after(() => {
    Class.findByPk = originalFindByPk;
  });
  const res = mockRes();
  await classController.remove({ user: MASTER_A, params: { id: "inexistente" } }, res);
  assert.equal(res.statusCode, 404);
});
