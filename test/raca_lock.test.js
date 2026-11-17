import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { characterController } from "../src/controllers/characterController.js";
import { Character, AtributosPersonagem, Race, Campaign, CampaignMember } from "../src/models/index.js";

const PLAYER = { id: "user-race-1", perfil: "jogador", role: "player", username: "jogador" };
const MASTER = { id: "user-mestre-1", perfil: "mestre", role: "master", username: "mestre" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

const RACE_UUID = "11111111-1111-1111-1111-111111111111";
const OUTRA_RACA_UUID = "22222222-2222-2222-2222-222222222222";

function makeTarget({ racaId = RACE_UUID, dadosExtras = { race: "humano", hitDie: "1d8" } } = {}) {
  return {
    id: "char-race-1",
    userId: PLAYER.id,
    campanhaId: null,
    racaId,
    updated_at: new Date("2026-11-14T12:00:00.000Z"),
    dadosExtras,
    async update(patch) { Object.assign(this, patch); return this; },
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        campanhaId: this.campanhaId,
        racaId: this.racaId,
        name: "Herói de Teste",
        hp: 50,
        hpMax: 70,
        dadosExtras: this.dadosExtras,
        attributes: {},
        created_at: new Date("2026-11-01T00:00:00.000Z"),
        updated_at: new Date("2026-11-14T12:00:00.000Z"),
      };
    },
  };
}

function withMocks(t, target, { raceLookup } = {}) {
  const original = {
    findByPk: Character.findByPk,
    atributosFindOne: AtributosPersonagem.findOne,
    atributosFindByPk: AtributosPersonagem.findByPk,
    raceFindByPk: Race.findByPk,
    campaignFindAll: Campaign.findAll,
    memberFindOne: CampaignMember.findOne,
  };
  Character.findByPk = async () => target;
  AtributosPersonagem.findByPk = async () => ({ update: async () => ({}) });
  AtributosPersonagem.findOne = async () => ({});
  Race.findByPk = async (uuid) => (raceLookup ? raceLookup(uuid) : null);
  Campaign.findAll = async () => [{ id: "camp-1" }];
  CampaignMember.findOne = async () => ({ id: "membro-1" });
  t.after(() => {
    Character.findByPk = original.findByPk;
    AtributosPersonagem.findOne = original.atributosFindOne;
    AtributosPersonagem.findByPk = original.atributosFindByPk;
    Race.findByPk = original.raceFindByPk;
    Campaign.findAll = original.campaignFindAll;
    CampaignMember.findOne = original.memberFindOne;
  });
}

test("sync: jogador NÃO pode trocar a raça de uma ficha que já tem raça", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, raceId: OUTRA_RACA_UUID } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /mestre/i);
});

test("sync: jogador NÃO pode limpar a raça", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, raceId: null } }, res);
  assert.equal(res.statusCode, 403);
});

test("sync: jogador pode SINCRONIZAR a ficha ecoando a raça atual (no-op, sem 403)", async (t) => {
  const target = makeTarget(); // racaId = RACE_UUID, dadosExtras.race = "humano"
  const raca = { id: RACE_UUID, slug: "humano", nome: "Humano", dadoDeVida: "1d8" };
  withMocks(t, target, { raceLookup: () => raca });
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, raceId: RACE_UUID, updatedAt: target.updated_at.toISOString() } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

test("update: jogador NÃO pode trocar a raça (apenas o mestre)", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.update({ user: PLAYER, params: { id: target.id }, body: { raceId: OUTRA_RACA_UUID } }, res);
  assert.equal(res.statusCode, 403);
});

test("sync: jogador pode escolher a raça quando a ficha ainda não tem", async (t) => {
  const target = makeTarget({ racaId: null, dadosExtras: {} });
  const elfo = { id: RACE_UUID, slug: "elfo", nome: "Elfo", dadoDeVida: "1d8" };
  withMocks(t, target, { raceLookup: () => elfo });
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, raceId: RACE_UUID, updatedAt: target.updated_at.toISOString() } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

test("update: mestre (perfil) PODE trocar a raça de uma ficha com raça", async (t) => {
  const target = makeTarget();
  const orc = { id: OUTRA_RACA_UUID, slug: "orc", nome: "Orc", dadoDeVida: "1d12" };
  withMocks(t, target, { raceLookup: () => orc });
  const res = mockRes();
  await characterController.update({ user: MASTER, params: { id: target.id }, body: { raceId: OUTRA_RACA_UUID } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(target.racaId, OUTRA_RACA_UUID);
});

test("update: mestre pode LIMPAR a raça (raceId null desfaz o vínculo)", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.update({ user: MASTER, params: { id: target.id }, body: { raceId: null } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(target.racaId, null);
  assert.equal(target.dadosExtras.race, null);
});
