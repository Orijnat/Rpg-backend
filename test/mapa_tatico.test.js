import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { mapaTaticoController } from "../src/controllers/mapaTaticoController.js";
import { mapaTaticoPatchSchema } from "../src/schemas/apiSchemas.js";
import { Campaign, CampaignMember, MapaTatico } from "../src/models/index.js";

const CAMP_ID = "camp-mapa-tatico-test";
const MESTRE_ID = "user-mestre-id";
const MEMBRO_ID = "user-membro-id";

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

function makeMapa(initialTokens) {
  const mapa = {
    campanhaId: CAMP_ID,
    tokens: initialTokens.map((t) => ({ ...t })),
    titulo: "Campo de Batalha",
    gradePx: 40,
    gradeVisivel: true,
    arquivoFundoId: null,
    urlFundo: null,
    toJSON() {
      return {
        id: "mapa-fake-id",
        campanhaId: this.campanhaId,
        tokens: this.tokens.map((t) => ({ ...t })),
        titulo: this.titulo,
        gradePx: this.gradePx,
        gradeVisivel: this.gradeVisivel,
        arquivoFundoId: this.arquivoFundoId,
        urlFundo: this.urlFundo,
      };
    },
    async update(alvo) {
      Object.assign(this, alvo);
      if (alvo.tokens) this.tokens = alvo.tokens.map((t) => ({ ...t }));
      return this;
    },
  };
  return mapa;
}

function mockContext({ isOwner, initialTokens }) {
  const originals = {
    campaignFindByPk: Campaign.findByPk,
    memberFindOne: CampaignMember.findOne,
    mapaFindOne: MapaTatico.findOne,
    mapaCreate: MapaTatico.create,
  };
  const mapa = makeMapa(initialTokens);
  Campaign.findByPk = async () => ({ id: CAMP_ID, proprietarioId: MESTRE_ID });
  CampaignMember.findOne = async () => (isOwner ? null : { campanhaId: CAMP_ID, usuarioId: MEMBRO_ID, papel: "jogador" });
  MapaTatico.findOne = async () => mapa;
  MapaTatico.create = async () => mapa;
  return {
    mapa,
    restore() {
      Campaign.findByPk = originals.campaignFindByPk;
      CampaignMember.findOne = originals.memberFindOne;
      MapaTatico.findOne = originals.mapaFindOne;
      MapaTatico.create = originals.mapaCreate;
    },
  };
}

const tokenExistente = {
  id: "11111111-1111-4111-8111-111111111111",
  tipo: "monstro",
  refId: null,
  name: "Goblin",
  x: 0.3,
  y: 0.3,
  tamanho: "M",
  hp: 7,
  hpMax: 7,
  oculto: false,
  icone: "sword",
};
const tokenOculto = { ...tokenExistente, id: "22222222-2222-4222-8222-222222222222", name: "Chefe", oculto: true };

const asMestre = () => ({ id: MESTRE_ID, perfil: "mestre", role: "master" });
const asMembro = () => ({ id: MEMBRO_ID, perfil: "jogador", role: "player" });

test("Mapa tático — ACL do controller (mocks de models, sem banco)", async (t) => {
  await t.test("membro cria miniatura nova e oculto é forçado para false", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMembro(),
        body: {
          tokens: [
            ...[tokenExistente],
            { id: "33333333-3333-4333-8333-333333333333", tipo: "personagem", name: "Herói", x: 0.5, y: 0.5, oculto: true },
          ],
        },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 200);
      const criados = state.jsonBody.tokens.filter((tk) => tk.id === "33333333-3333-4333-8333-333333333333");
      assert.equal(criados.length, 1);
      assert.equal(criados[0].oculto, false);
    } finally {
      ctx.restore();
    }
  });

  await t.test("membro move miniatura existente; hpMax/name não mudam; hp e icone mudam", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMembro(),
        body: {
          tokens: [
            { ...tokenExistente, x: 0.7, y: 0.8, hp: 3, hpMax: 99, name: "Renomeado", icone: "skull" },
          ],
        },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 200);
      const movido = state.jsonBody.tokens.find((tk) => tk.id === tokenExistente.id);
      assert.equal(movido.x, 0.7);
      assert.equal(movido.y, 0.8);
      assert.equal(movido.hp, 3);
      assert.equal(movido.icone, "skull");
      assert.equal(movido.hpMax, 7);
      assert.equal(movido.name, "Goblin");
    } finally {
      ctx.restore();
    }
  });

  await t.test("membro omitir miniatura do array não apaga a miniatura (mantém as existentes + ocultas)", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente, tokenOculto] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMembro(),
        body: { tokens: [] },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 200);
      const ids = ctx.mapa.tokens.map((tk) => tk.id).sort();
      assert.deepEqual(ids, [tokenExistente.id, tokenOculto.id].sort());
    } finally {
      ctx.restore();
    }
  });

  await t.test("membro não pode ocultar nem renomear miniaturas existentes", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMembro(),
        body: { tokens: [{ ...tokenExistente, oculto: true, name: "Invadido" }] },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 200);
      const alvo = ctx.mapa.tokens.find((tk) => tk.id === tokenExistente.id);
      assert.equal(alvo.oculto, false);
      assert.equal(alvo.name, "Goblin");
    } finally {
      ctx.restore();
    }
  });

  await t.test("membro não altera título/fundo/grade → 403", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMembro(),
        body: { titulo: "Invadido" },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 403);
    } finally {
      ctx.restore();
    }
  });

  await t.test("mestre substitui a lista inteira (incluindo remoção)", async () => {
    const ctx = mockContext({ isOwner: true, initialTokens: [tokenExistente, tokenOculto] });
    try {
      const { res, state } = makeFakeRes();
      const req = {
        params: { campanhaId: CAMP_ID },
        user: asMestre(),
        body: { tokens: [{ ...tokenExistente, x: 0.9 }] },
      };
      await mapaTaticoController.atualizar(req, res);
      assert.equal(state.statusCode, 200);
      assert.equal(ctx.mapa.tokens.length, 1);
      assert.equal(ctx.mapa.tokens[0].x, 0.9);
    } finally {
      ctx.restore();
    }
  });

  await t.test("membro não vê miniaturas ocultas no GET; mestre vê todas", async () => {
    const ctx = mockContext({ isOwner: false, initialTokens: [tokenExistente, tokenOculto] });
    try {
      const { res, state } = makeFakeRes();
      await mapaTaticoController.obter({ params: { campanhaId: CAMP_ID }, user: asMembro() }, res);
      assert.equal(state.statusCode, 200);
      assert.deepEqual(state.jsonBody.tokens.map((tk) => tk.id), [tokenExistente.id]);
      assert.equal(state.jsonBody.podeGerenciar, false);
    } finally {
      ctx.restore();
    }
    const ctx2 = mockContext({ isOwner: true, initialTokens: [tokenExistente, tokenOculto] });
    try {
      const { res, state } = makeFakeRes();
      await mapaTaticoController.obter({ params: { campanhaId: CAMP_ID }, user: asMestre() }, res);
      assert.equal(state.jsonBody.tokens.length, 2);
      assert.equal(state.jsonBody.podeGerenciar, true);
    } finally {
      ctx2.restore();
    }
  });

  await t.test("mestre id desconhecido para membro (outro mestre, não dono) é negado", async () => {
    const originals = {
      campaignFindByPk: Campaign.findByPk,
      memberFindOne: CampaignMember.findOne,
      mapaFindOne: MapaTatico.findOne,
    };
    Campaign.findByPk = async () => ({ id: CAMP_ID, proprietarioId: "outro-mestre-id" });
    CampaignMember.findOne = async () => null;
    MapaTatico.findOne = async () => makeMapa([tokenExistente]);
    try {
      const { res, state } = makeFakeRes();
      await mapaTaticoController.obter({ params: { campanhaId: CAMP_ID }, user: { id: "mestre-intruso", perfil: "mestre", role: "master" } }, res);
      assert.equal(state.statusCode, 403);
    } finally {
      Campaign.findByPk = originals.campaignFindByPk;
      CampaignMember.findOne = originals.memberFindOne;
      MapaTatico.findOne = originals.mapaFindOne;
    }
  });
});

test("Mapa tático — schema zod", async (t) => {
  const base = {
    tokens: [{ id: "55555555-5555-4555-8555-555555555555", tipo: "monstro", name: "X", x: 0.5, y: 0.5, icone: "ghost" }],
  };

  await t.test("aceita ícone válido", () => {
    const r = mapaTaticoPatchSchema.safeParse(base);
    assert.equal(r.success, true);
  });

  await t.test("rejeita ícone fora do enum", () => {
    const r = mapaTaticoPatchSchema.safeParse({
      tokens: [{ ...base.tokens[0], icone: "nao-existe" }],
    });
    assert.equal(r.success, false);
  });

  await t.test("rejeita refId que não é uuid", () => {
    const r = mapaTaticoPatchSchema.safeParse({
      tokens: [{ ...base.tokens[0], refId: "nao-uuid" }],
    });
    assert.equal(r.success, false);
  });

  await t.test("rejeita corpo vazio", () => {
    const r = mapaTaticoPatchSchema.safeParse({});
    assert.equal(r.success, false);
  });
});
