import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { characterController } from "../src/controllers/characterController.js";
import { Character, AtributosPersonagem, Race, Class, Campaign, CampaignMember } from "../src/models/index.js";

const PLAYER = { id: "user-class-1", perfil: "jogador", role: "player", username: "jogador" };
const MASTER = { id: "user-mestre-1", perfil: "mestre", role: "master", username: "mestre" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

const CLASS_UUID = "11111111-1111-1111-1111-111111111111";
const OUTRA_CLASS_UUID = "22222222-2222-2222-2222-222222222222";

function makeTarget({ classeId = CLASS_UUID, dadosExtras = { class: "humano", hitDie: "1d8" } } = {}) {
  return {
    id: "char-class-1",
    userId: PLAYER.id,
    campanhaId: null,
    classeId,
    updated_at: new Date("2026-11-14T12:00:00.000Z"),
    dadosExtras,
    async update(patch) { Object.assign(this, patch); return this; },
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        campanhaId: this.campanhaId,
        classeId: this.classeId,
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

function withMocks(t, target, { classLookup } = {}) {
  const original = {
    findByPk: Character.findByPk,
    atributosFindOne: AtributosPersonagem.findOne,
    atributosFindByPk: AtributosPersonagem.findByPk,
    classFindByPk: Class.findByPk,
    campaignFindAll: Campaign.findAll,
    memberFindOne: CampaignMember.findOne,
  };
  Character.findByPk = async () => target;
  AtributosPersonagem.findByPk = async () => ({ update: async () => ({}) });
  AtributosPersonagem.findOne = async () => ({});
  Class.findByPk = async (uuid) => (classLookup ? classLookup(uuid) : null);
  Campaign.findAll = async () => [{ id: "camp-1" }];
  CampaignMember.findOne = async () => ({ id: "membro-1" });
  t.after(() => {
    Character.findByPk = original.findByPk;
    AtributosPersonagem.findOne = original.atributosFindOne;
    AtributosPersonagem.findByPk = original.atributosFindByPk;
    Class.findByPk = original.classFindByPk;
    Campaign.findAll = original.campaignFindAll;
    CampaignMember.findOne = original.memberFindOne;
  });
}

test("sync: jogador NÃO pode trocar a classe de uma ficha que já tem classe", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, classId: OUTRA_CLASS_UUID } }, res);
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /mestre/i);
});

test("sync: jogador NÃO pode limpar a classe", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, classId: null } }, res);
  assert.equal(res.statusCode, 403);
});

test("sync: jogador pode SINCRONIZAR a ficha ecoando a classe atual (no-op, sem 403)", async (t) => {
  const target = makeTarget(); // classeId = CLASS_UUID, dadosExtras.class = "humano"
  const classe = { id: CLASS_UUID, slug: "humano", nome: "Humano", dadoDeVida: "1d8" };
  withMocks(t, target, { classLookup: () => classe });
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, classId: CLASS_UUID, updatedAt: target.updated_at.toISOString() } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

test("update: jogador NÃO pode trocar a classe (apenas o mestre)", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.update({ user: PLAYER, params: { id: target.id }, body: { classId: OUTRA_CLASS_UUID } }, res);
  assert.equal(res.statusCode, 403);
});

test("sync: jogador pode escolher a classe quando a ficha ainda não tem", async (t) => {
  const target = makeTarget({ classeId: null, dadosExtras: {} });
  const mago = { id: CLASS_UUID, slug: "mago", nome: "Mago", dadoDeVida: "1d6" };
  withMocks(t, target, { classLookup: () => mago });
  const res = mockRes();
  await characterController.sync({ user: PLAYER, body: { id: target.id, classId: CLASS_UUID, updatedAt: target.updated_at.toISOString() } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
});

test("update: mestre (perfil) PODE trocar a classe de uma ficha com classe", async (t) => {
  const target = makeTarget();
  const bardo = { id: OUTRA_CLASS_UUID, slug: "bardo", nome: "Bardo", dadoDeVida: "1d8" };
  withMocks(t, target, { classLookup: () => bardo });
  const res = mockRes();
  await characterController.update({ user: MASTER, params: { id: target.id }, body: { classId: OUTRA_CLASS_UUID } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(target.classeId, OUTRA_CLASS_UUID);
});

test("update: mestre pode LIMPAR a classe (classId null desfaz o vínculo)", async (t) => {
  const target = makeTarget();
  withMocks(t, target);
  const res = mockRes();
  await characterController.update({ user: MASTER, params: { id: target.id }, body: { classId: null } }, res);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(target.classeId, null);
  assert.equal(target.dadosExtras.class, null);
});
