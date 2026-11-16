import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { mercadoController } from "../src/controllers/mercadoController.js";
import { mercadoItemSchema, mercadoVendedorSchema } from "../src/schemas/apiSchemas.js";
import { requireMaster } from "../src/middlewares/authMiddleware.js";
import { MercadoVendedor, MercadoItem } from "../src/models/index.js";

const MESTRE_ID = "user-mestre-mercado";
const OUTRO_MESTRE_ID = "user-outro-mestre-mercado";

function makeFakeRes() {
  const state = { statusCode: 200, jsonBody: null };
  const res = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(data) {
      state.jsonBody = data;
      return this;
    },
  };
  return { res, state };
}

function reqBase(userId, body = {}, params = {}) {
  return {
    params,
    body,
    query: {},
    user: { id: userId, perfil: "mestre", role: "master" },
    ip: "127.0.0.1",
  };
}

const itemValido = {
  nome: "Espada Longa de Aço Valiriano",
  regiao: "Capital Valíria & Terras da Coroa",
  vendedor: "Mestre Garrick",
  tipo: "Armas",
  quantidade: 4,
  preco: 35,
  moeda: "ouro",
  peso: 1.5,
  raridade: "Incomum",
  descricao: "Aço duplamente temperado.",
  requisitos: "FOR 11",
};

test("schemas do mercado aceitam payload válido e rejeitam inválidos", () => {
  assert.equal(mercadoItemSchema.safeParse(itemValido).success, true);
  assert.equal(mercadoItemSchema.safeParse({ ...itemValido, quantidade: -1 }).success, false);
  assert.equal(mercadoItemSchema.safeParse({ ...itemValido, preco: -0.01 }).success, false);
  assert.equal(mercadoItemSchema.safeParse({ ...itemValido, moeda: "diamante" }).success, false);
  assert.equal(mercadoItemSchema.safeParse({ ...itemValido, nome: "" }).success, false);
  assert.equal(mercadoVendedorSchema.safeParse({ nome: "Garrick", regiao: "Valíria" }).success, true);
  assert.equal(mercadoVendedorSchema.safeParse({ nome: "", regiao: "Valíria" }).success, false);
});

test("listarItens busca apenas itens do mestre autenticado", async () => {
  const originalFindAll = MercadoItem.findAll;
  const calls = [];
  MercadoItem.findAll = async (opts) => {
    calls.push(opts);
    return [];
  };
  try {
    const { res, state } = makeFakeRes();
    await mercadoController.listarItens(reqBase(MESTRE_ID), res);
    assert.equal(state.statusCode, 200);
    assert.equal(calls[0].where.criadoPorId, MESTRE_ID);
    assert.deepEqual(state.jsonBody.items, []);
  } finally {
    MercadoItem.findAll = originalFindAll;
  }
});

test("criarItem força criadoPorId do usuário autenticado (ignora id forjado)", async () => {
  const originalCreate = MercadoItem.create;
  const created = [];
  MercadoItem.create = async (payload) => {
    created.push(payload);
    return { ...payload, id: "item-1", toJSON() { return this; } };
  };
  try {
    const { res, state } = makeFakeRes();
    await mercadoController.criarItem(
      reqBase(MESTRE_ID, { ...itemValido, criadoPorId: OUTRO_MESTRE_ID }),
      res
    );
    assert.equal(state.statusCode, 201);
    assert.equal(created[0].criadoPorId, MESTRE_ID);
    assert.equal(state.jsonBody.item.preco, 35);
    assert.equal(typeof state.jsonBody.item.peso, "number");
  } finally {
    MercadoItem.create = originalCreate;
  }
});

test("atualizarItem de outro mestre retorna 404", async () => {
  const originalFindOne = MercadoItem.findOne;
  MercadoItem.findOne = async () => null;
  try {
    const { res, state } = makeFakeRes();
    await mercadoController.atualizarItem(reqBase(MESTRE_ID, itemValido, { id: "item-alheio" }), res);
    assert.equal(state.statusCode, 404);
  } finally {
    MercadoItem.findOne = originalFindOne;
  }
});

test("removerVendedor de outro mestre retorna 404 e não destrói", async () => {
  const originalFindOne = MercadoVendedor.findOne;
  MercadoVendedor.findOne = async () => null;
  try {
    const { res, state } = makeFakeRes();
    await mercadoController.removerVendedor(reqBase(MESTRE_ID, {}, { id: "vend-alheio" }), res);
    assert.equal(state.statusCode, 404);
  } finally {
    MercadoVendedor.findOne = originalFindOne;
  }
});

test("atualizarVendedor aplica dados do dono e devolve vendedor normalizado", async () => {
  const originalFindOne = MercadoVendedor.findOne;
  const updated = [];
  MercadoVendedor.findOne = async () => ({
    id: "vend-1",
    criadoPorId: MESTRE_ID,
    nome: "Antigo Nome",
    async update(values) {
      updated.push(values);
      Object.assign(this, values);
      return this;
    },
    toJSON() {
      return { id: this.id, nome: this.nome, titulo: this.titulo || "", regiao: this.regiao, humor: this.humor || "", especialidade: this.especialidade || "" };
    },
  });
  try {
    const { res, state } = makeFakeRes();
    await mercadoController.atualizarVendedor(
      reqBase(MESTRE_ID, { nome: "Novo Nome", regiao: "Pântano das Brumas", especialidade: "Poções" }, { id: "vend-1" }),
      res
    );
    assert.equal(state.statusCode, 200);
    assert.equal(updated[0].nome, "Novo Nome");
    assert.equal(state.jsonBody.vendor.nome, "Novo Nome");
  } finally {
    MercadoVendedor.findOne = originalFindOne;
  }
});

test("requireMaster bloqueia jogador e libera mestre", () => {
  const jogadorReq = { user: { perfil: "jogador", role: "player" } };
  const mestreReq = { user: { perfil: "mestre", role: "master" } };
  const { res: resJogador, state: stateJogador } = makeFakeRes();
  const { res: resMestre } = makeFakeRes();
  let nextChamado = false;
  requireMaster(jogadorReq, resJogador, () => { nextChamado = true; });
  assert.equal(stateJogador.statusCode, 403);
  assert.equal(nextChamado, false);
  requireMaster(mestreReq, resMestre, () => { nextChamado = true; });
  assert.equal(nextChamado, true);
});
