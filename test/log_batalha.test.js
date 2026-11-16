import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { batalhaLogController } from "../src/controllers/batalhaLogController.js";
import { batalhaLogSchema } from "../src/schemas/apiSchemas.js";
import { Campaign, CampaignMember, Encounter, LogBatalha } from "../src/models/index.js";

const CAMP_ID = "camp-batalha-log-test";
const ENCONTRO_ID = "11111111-2222-4333-8444-555555555555";
const MESTRE_ID = "user-mestre-id";
const MEMBRO_ID = "user-membro-id";
const FORA_ID = "user-fora-id";

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

function makeEncontro({ ativo = true, combatRound = 2 } = {}) {
  return {
    id: ENCONTRO_ID,
    campanhaId: CAMP_ID,
    nome: "Emboscada nas Ruínas",
    tipo: "combate",
    ativo,
    dadosExtras: { combatRound, iniciativa: [] },
  };
}

function makeEntry(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: "entry-1",
    encontroId: ENCONTRO_ID,
    campanhaId: CAMP_ID,
    autor: "Thorne",
    papel: "jogador",
    tipo: "rolagem",
    mensagem: "Iniciativa (+3): 18",
    dados: {},
    rodada: 2,
    createdAt: now,
    ...overrides,
  };
}

function mockContext({ isOwner = false, encontro = makeEncontro(), entries = [makeEntry()] } = {}) {
  const originals = {
    campaignFindByPk: Campaign.findByPk,
    memberFindOne: CampaignMember.findOne,
    encounterFindOne: Encounter.findOne,
    logFindAll: LogBatalha.findAll,
    logCreate: LogBatalha.create,
    created: [],
  };

  Campaign.findByPk = async () => ({ id: CAMP_ID, proprietarioId: MESTRE_ID });
  CampaignMember.findOne = async ({ where } = {}) => {
    const uid = where?.usuarioId ?? MEMBRO_ID;
    if (uid === FORA_ID) return null;
    if (isOwner) return uid === MESTRE_ID ? { campanhaId: CAMP_ID, usuarioId: MESTRE_ID, papel: "mestre" } : null;
    return uid === MEMBRO_ID ? { campanhaId: CAMP_ID, usuarioId: MEMBRO_ID, papel: "jogador" } : null;
  };
  Encounter.findOne = async () => encontro;
  LogBatalha.findAll = async () => entries.map((e) => ({ ...e }));
  LogBatalha.create = async (payload) => {
    originals.created.push(payload);
    return makeEntry({ ...payload, id: `entry-${originals.created.length}` });
  };

  return {
    created: originals.created,
    restore() {
      Campaign.findByPk = originals.campaignFindByPk;
      CampaignMember.findOne = originals.memberFindOne;
      Encounter.findOne = originals.encounterFindOne;
      LogBatalha.findAll = originals.logFindAll;
      LogBatalha.create = originals.logCreate;
    },
  };
}

const reqBase = (id, body = {}, query = {}) => ({
  params: { campanhaId: CAMP_ID },
  body,
  query,
  user: { id, username: id === MESTRE_ID ? "MestreArcano" : "Thorne", perfil: id === MESTRE_ID ? "mestre" : "jogador", role: id === MESTRE_ID ? "master" : "player" },
  ip: "127.0.0.1",
});

test("batalhaLogSchema rejeita tipo fora do catálogo e mensagem vazia", () => {
  assert.equal(batalhaLogSchema.safeParse({ tipo: "hackear", mensagem: "x" }).success, false);
  assert.equal(batalhaLogSchema.safeParse({ tipo: "dano", mensagem: "" }).success, false);
  assert.equal(batalhaLogSchema.safeParse({ tipo: "dano", mensagem: "Golpe de 14" }).success, true);
});

test("registrar — membro da mesa registra rolagem no encontro ativo", async () => {
  const ctx = mockContext();
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.registrar(
      reqBase(MEMBRO_ID, { tipo: "rolagem", mensagem: "Iniciativa (+3): 18", dados: { total: 18 } }),
      res
    );
    assert.equal(state.statusCode, 201);
    assert.equal(state.jsonBody.papel, "jogador");
    assert.equal(state.jsonBody.rodada, 2);
    assert.equal(ctx.created.length, 1);
    assert.equal(ctx.created[0].encontroId, ENCONTRO_ID);
  } finally {
    ctx.restore();
  }
});

test("registrar — dono da mesa registra tipo reservado ao mestre", async () => {
  const ctx = mockContext({ isOwner: true });
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.registrar(
      reqBase(MESTRE_ID, { tipo: "turno", mensagem: "Turno avançado para Goblin (Rodada 2)" }),
      res
    );
    assert.equal(state.statusCode, 201);
    assert.equal(state.jsonBody.papel, "mestre");
  } finally {
    ctx.restore();
  }
});

test("registrar — jogador NÃO pode registrar tipos reservados ao mestre", async () => {
  const ctx = mockContext();
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.registrar(
      reqBase(MEMBRO_ID, { tipo: "turno", mensagem: "Avanco escondido de rodada" }),
      res
    );
    assert.equal(state.statusCode, 403);
    assert.equal(ctx.created.length, 0);
  } finally {
    ctx.restore();
  }
});

test("registrar — sem encontro ativo retorna 404 e nada é gravado", async () => {
  const ctx = mockContext({ encontro: null });
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.registrar(
      reqBase(MEMBRO_ID, { tipo: "dano", mensagem: "Sofreu 9 de dano" }),
      res
    );
    assert.equal(state.statusCode, 404);
    assert.equal(ctx.created.length, 0);
  } finally {
    ctx.restore();
  }
});

test("registrar — usuário de fora da mesa recebe 403", async () => {
  const ctx = mockContext();
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.registrar(
      reqBase(FORA_ID, { tipo: "dano", mensagem: "Sofreu 9 de dano" }),
      res
    );
    assert.equal(state.statusCode, 403);
    assert.equal(ctx.created.length, 0);
  } finally {
    ctx.restore();
  }
});

test("listar — membro lê as entradas do encontro ativo em ordem cronológica", async () => {
  const entries = [
    makeEntry({ id: "e2", mensagem: "B", createdAt: "2026-11-16T12:00:02.000Z" }),
    makeEntry({ id: "e1", mensagem: "A", createdAt: "2026-11-16T12:00:01.000Z" }),
  ];
  const ctx = mockContext({ entries });
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.listar(reqBase(MEMBRO_ID, {}, {}), res);
    assert.equal(state.statusCode, 200);
    assert.equal(state.jsonBody.encontro.id, ENCONTRO_ID);
    // findAll retorna DESC (mock) — controller inverte para ASC
    assert.deepEqual(state.jsonBody.entradas.map((e) => e.mensagem), ["A", "B"]);
  } finally {
    ctx.restore();
  }
});

test("listar — usuário de fora da mesa recebe 403", async () => {
  const ctx = mockContext();
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.listar(reqBase(FORA_ID, {}, {}), res);
    assert.equal(state.statusCode, 403);
  } finally {
    ctx.restore();
  }
});

test("listar — sem encontro na campanha retorna lista vazia (200)", async () => {
  const ctx = mockContext({ encontro: null });
  try {
    const { res, state } = makeFakeRes();
    await batalhaLogController.listar(reqBase(MEMBRO_ID, {}, {}), res);
    assert.equal(state.statusCode, 200);
    assert.deepEqual(state.jsonBody, { encontro: null, entradas: [] });
  } finally {
    ctx.restore();
  }
});
