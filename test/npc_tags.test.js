import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { npcController } from "../src/controllers/npcController.js";
import { validar } from "../src/middlewares/validate.js";
import { npcSchema } from "../src/schemas/apiSchemas.js";
import { AuditLog, NPC } from "../src/models/index.js";

const MESTRE = { id: "user-mestre-npc-tags", username: "mestre", perfil: "mestre" };

function makeRes() {
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

function payloadTags(tags) {
  return {
    nome: "Lich da Cripta",
    papel: "Chefe",
    descricao: "Guarda a cripta.",
    hp: 30,
    hpMax: 30,
    ca: 15,
    iniciativa: 3,
    attitude: "Chefe",
    status: "Ativo",
    avatar: "",
    tags,
    acoes: [],
    notasMestre: "",
    atributos: { INT: 18 },
    abilities: [],
    pericias: [],
    sharedWithPlayers: false,
  };
}

test("Backend — NPCs — tags persistidas no cadastro", async (t) => {
  const originalCreate = NPC.create;
  const originalAudit = AuditLog.create;
  AuditLog.create = async () => ({});

  await t.test("POST /npcs grava as tags marcadas em dadosExtras.tags", async () => {
    let capturado = null;
    NPC.create = async (data) => {
      capturado = data;
      return { id: "npc-tags-1", ...data };
    };
    try {
      const { res, state } = makeRes();
      await npcController.criar(
        { user: MESTRE, params: {}, body: payloadTags(["Morto-Vivo", "Mágico", "Chefe"]) },
        res,
      );
      assert.equal(state.statusCode, 201);
      assert.deepEqual(capturado.dadosExtras.tags, ["Morto-Vivo", "Mágico", "Chefe"]);
    } finally {
      NPC.create = originalCreate;
    }
  });

  await t.test("tags são normalizadas (trim, dedupe e limite) antes de gravar", async () => {
    let capturado = null;
    NPC.create = async (data) => {
      capturado = data;
      return { id: "npc-tags-2", ...data };
    };
    try {
      const { res } = makeRes();
      await npcController.criar(
        { user: MESTRE, params: {}, body: payloadTags(["  Chefe  ", "chefe", "", "Elite"]) },
        res,
      );
      assert.deepEqual(capturado.dadosExtras.tags, ["Chefe", "Elite"]);
    } finally {
      NPC.create = originalCreate;
    }
  });

  await t.test("validar(npcSchema) rejeita tags fora de array com 422", () => {
    const { res, state } = makeRes();
    let chamouNext = false;
    validar(npcSchema)({ body: payloadTags("Chefe") }, res, () => {
      chamouNext = true;
    });
    assert.equal(state.statusCode, 422);
    assert.equal(chamouNext, false);
  });

  await t.test("validar(npcSchema) preserva todos os campos enviados pelo formulário", () => {
    let corpo = null;
    const req = { body: payloadTags(["Elite"]) };
    validar(npcSchema)(req, makeRes().res, () => {
      corpo = req.body;
    });
    assert.deepEqual(corpo.tags, ["Elite"]);
    assert.equal(corpo.descricao, "Guarda a cripta.");
    assert.equal(corpo.sharedWithPlayers, false);
    assert.deepEqual(corpo.atributos, { INT: 18 });
    assert.deepEqual(corpo.abilities, []);
  });

  await t.test("PUT sem tags preserva as tags já salvas", async () => {
    const npc = {
      id: "npc-tags-3",
      campanhaId: null,
      criadoPorId: MESTRE.id,
      nome: "Lich da Cripta",
      papel: "Chefe",
      descricao: "",
      hp: 30,
      hpMax: 30,
      dadosExtras: { tags: ["Morto-Vivo", "Chefe"] },
      update: async (patch) => Object.assign(npc, patch),
    };
    const originalFindByPk = NPC.findByPk;
    NPC.findByPk = async () => npc;
    try {
      const { res, state } = makeRes();
      await npcController.atualizar({ user: MESTRE, params: { id: npc.id }, body: { nome: "Lich" } }, res);
      assert.equal(state.statusCode, 200);
      assert.deepEqual(npc.dadosExtras.tags, ["Morto-Vivo", "Chefe"]);
    } finally {
      NPC.findByPk = originalFindByPk;
    }
  });

  AuditLog.create = originalAudit;
});
