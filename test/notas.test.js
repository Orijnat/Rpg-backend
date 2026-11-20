import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { notaController } from "../src/controllers/notaController.js";
import { Campaign, CampaignMember, Note, AuditLog } from "../src/models/index.js";

const CAMP_ID = "camp-notas-test";
const MESTRE_ID = "user-mestre-id";
const MEMBRO_ID = "user-membro-id";

const MESTRE_USER = { id: MESTRE_ID, username: "mestre", perfil: "mestre" };
const JOGADOR_USER = { id: MEMBRO_ID, username: "jogador", perfil: "jogador" };

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

function stubAcesso({ isOwner = false, membro = null } = {}) {
  const originais = {
    campaignFindByPk: Campaign.findByPk,
    memberFindOne: CampaignMember.findOne,
  };
  Campaign.findByPk = async () =>
    isOwner ? { id: CAMP_ID, proprietarioId: MESTRE_ID } : { id: CAMP_ID, proprietarioId: MESTRE_ID };
  CampaignMember.findOne = async () => membro;
  return {
    restore() {
      Campaign.findByPk = originais.campaignFindByPk;
      CampaignMember.findOne = originais.memberFindOne;
    },
  };
}

function makeNota(overrides = {}) {
  const nota = {
    id: "nota-1",
    campanhaId: CAMP_ID,
    autorId: MESTRE_ID,
    personagemId: null,
    tipo: "anotacao",
    titulo: "Semente de magia",
    conteudo: "A carta falou do templo.",
    privada: true,
    ...overrides,
    update: async (patch) => {
      Object.assign(nota, patch);
      return nota;
    },
    destroy: async () => undefined,
  };
  return nota;
}

test("Backend — Notas (anotacoes) — CRUD + privacidade", async (t) => {
  await t.test("1. listar: mestre recebe a lista completa da campanha", async () => {
    const stub = stubAcesso({ isOwner: true });
    const notas = [makeNota({ id: "nota-1", autorId: MESTRE_ID, privada: true })];
    const originalFindAll = Note.findAll;
    Note.findAll = async () => notas.map((n) => ({ ...n }));
    try {
      const { res, state } = makeRes();
      await notaController.listar({ user: MESTRE_USER, params: { campanhaId: CAMP_ID } }, res);
      assert.equal(state.statusCode, 200);
      assert.ok(Array.isArray(state.jsonBody));
      assert.equal(state.jsonBody.length, 1);
    } finally {
      Note.findAll = originalFindAll;
      stub.restore();
    }
  });

  await t.test("2. listar: jogador sem acesso recebe 403", async () => {
    const stub = stubAcesso({ isOwner: false, membro: null });
    const { res, state } = makeRes();
    await notaController.listar({ user: JOGADOR_USER, params: { campanhaId: CAMP_ID } }, res);
    assert.equal(state.statusCode, 403);
    stub.restore();
  });

  await t.test("3. listar: jogador ve apenas notas proprias (privadas) + publicas", async () => {
    const stub = stubAcesso({ isOwner: false, membro: { campanhaId: CAMP_ID, usuarioId: MEMBRO_ID, papel: "jogador" } });
    const notasBrutas = [
      { id: "nota-1", campanhaId: CAMP_ID, autorId: MESTRE_ID, tipo: "diario", titulo: "T", conteudo: "C", privada: true },
      { id: "nota-2", campanhaId: CAMP_ID, autorId: MEMBRO_ID, tipo: "anotacao", titulo: "T2", conteudo: "C2", privada: true },
      { id: "nota-3", campanhaId: CAMP_ID, autorId: MESTRE_ID, tipo: "handout", titulo: "T3", conteudo: "C3", privada: false },
    ];
    const originalFindAll = Note.findAll;
    Note.findAll = async () => notasBrutas;
    try {
      const { res, state } = makeRes();
      await notaController.listar({ user: JOGADOR_USER, params: { campanhaId: CAMP_ID } }, res);
      assert.equal(state.statusCode, 200);
      assert.equal(state.jsonBody.length, 2);
      assert.deepEqual(
        state.jsonBody.map((n) => n.id).sort(),
        ["nota-2", "nota-3"],
      );
    } finally {
      Note.findAll = originalFindAll;
      stub.restore();
    }
  });

  await t.test("4. criar: rejeita conteudo vazio com 400", async () => {
    const stub = stubAcesso({ isOwner: true });
    const { res, state } = makeRes();
    await notaController.criar(
      { user: MESTRE_USER, params: { campanhaId: CAMP_ID }, body: { titulo: "Sem conteudo", conteudo: "   " } },
      res,
    );
    assert.equal(state.statusCode, 400);
    stub.restore();
  });

  await t.test("5. criar: cria nota com campos normalizados", async () => {
    const stub = stubAcesso({ isOwner: true });
    const originalCreate = Note.create;
    const originalAudit = AuditLog.create;
    let payloadCriado = null;
    Note.create = async (payload) => {
      payloadCriado = payload;
      return makeNota({ ...payload });
    };
    AuditLog.create = async () => ({});
    try {
      const { res, state } = makeRes();
      await notaController.criar(
        {
          user: MESTRE_USER,
          params: { campanhaId: CAMP_ID },
          body: { titulo: "  Semente  ", conteudo: " Conteudo ", tipo: "handout", privada: true, personagemId: null },
        },
        res,
      );
      assert.equal(state.statusCode, 201);
      assert.equal(payloadCriado.conteudo, "Conteudo");
      assert.equal(payloadCriado.titulo, "Semente");
      assert.equal(payloadCriado.tipo, "handout");
      assert.equal(payloadCriado.privada, true);
      assert.equal(payloadCriado.campanhaId, CAMP_ID);
      assert.equal(payloadCriado.autorId, MESTRE_ID);
    } finally {
      Note.create = originalCreate;
      AuditLog.create = originalAudit;
      stub.restore();
    }
  });

  await t.test("6. atualizar: retorna 404 quando a nota nao existe", async () => {
    const stub = stubAcesso({ isOwner: true });
    const originalFindByPk = Note.findByPk;
    Note.findByPk = async () => null;
    try {
      const { res, state } = makeRes();
      await notaController.atualizar({ user: MESTRE_USER, params: { id: "nota-inexistente" }, body: { titulo: "X" } }, res);
      assert.equal(state.statusCode, 404);
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      stub.restore();
    }
  });

  await t.test("7. atualizar: jogador que nao e autor recebe 403", async () => {
    const stub = stubAcesso({ isOwner: false, membro: { campanhaId: CAMP_ID, usuarioId: MEMBRO_ID, papel: "jogador" } });
    const originalFindByPk = Note.findByPk;
    Note.findByPk = async () => makeNota({ id: "nota-1", autorId: MESTRE_ID });
    try {
      const { res, state } = makeRes();
      await notaController.atualizar({ user: JOGADOR_USER, params: { id: "nota-1" }, body: { titulo: "X" } }, res);
      assert.equal(state.statusCode, 403);
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      stub.restore();
    }
  });

  await t.test("8. atualizar: mestre atualiza titulo/conteudo", async () => {
    const stub = stubAcesso({ isOwner: true });
    const nota = makeNota();
    const originalFindByPk = Note.findByPk;
    const originalUpdate = Note.update;
    const originalAudit = AuditLog.create;
    Note.findByPk = async () => nota;
    Note.update = async () => [1];
    AuditLog.create = async () => ({});
    try {
      const { res, state } = makeRes();
      await notaController.atualizar(
        { user: MESTRE_USER, params: { id: "nota-1" }, body: { titulo: "Nova Titulo", conteudo: "Nova Conteudo" } },
        res,
      );
      assert.equal(state.statusCode, 200);
      assert.equal(nota.titulo, "Nova Titulo");
      assert.equal(nota.conteudo, "Nova Conteudo");
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      Note.update = originalUpdate;
      stub.restore();
    }
  });

  await t.test("9. remover: retorna 404 quando a nota nao existe", async () => {
    const stub = stubAcesso({ isOwner: true });
    const originalFindByPk = Note.findByPk;
    Note.findByPk = async () => null;
    try {
      const { res, state } = makeRes();
      await notaController.remover({ user: MESTRE_USER, params: { id: "nota-inexistente" } }, res);
      assert.equal(state.statusCode, 404);
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      stub.restore();
    }
  });

  await t.test("10. remover: jogador sem permissao recebe 403 e nao deleta", async () => {
    const stub = stubAcesso({ isOwner: false, membro: { campanhaId: CAMP_ID, usuarioId: MEMBRO_ID, papel: "jogador" } });
    const originalFindByPk = Note.findByPk;
    const originalDestroy = Note.destroy;
    let destruiu = false;
    Note.findByPk = async () => makeNota({ id: "nota-1", autorId: MESTRE_ID });
    Note.destroy = async () => {
      destruiu = true;
      return [1];
    };
    try {
      const { res, state } = makeRes();
      await notaController.remover({ user: JOGADOR_USER, params: { id: "nota-1" } }, res);
      assert.equal(state.statusCode, 403);
      assert.equal(destruiu, false);
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      Note.destroy = originalDestroy;
      stub.restore();
    }
  });

  await t.test("11. remover: mestre remove a nota com sucesso", async () => {
    const stub = stubAcesso({ isOwner: true });
    const originalFindByPk = Note.findByPk;
    const originalDestroy = Note.destroy;
    Note.findByPk = async () => makeNota();
    Note.destroy = async () => [1];
    try {
      const { res, state } = makeRes();
      await notaController.remover({ user: MESTRE_USER, params: { id: "nota-1" } }, res);
      assert.equal(state.statusCode, 200);
      assert.equal(state.jsonBody.success, true);
      stub.restore();
    } finally {
      Note.findByPk = originalFindByPk;
      Note.destroy = originalDestroy;
      stub.restore();
    }
  });
});
