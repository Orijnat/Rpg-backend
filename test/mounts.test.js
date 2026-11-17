import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { mountController } from "../src/controllers/mountController.js";
import { Mount, Character, Campaign, CampaignMember } from "../src/models/index.js";

const OWNER = { id: "user-dono-1", perfil: "jogador", role: "player", username: "dono" };
const MASTER = { id: "user-mestre-1", perfil: "mestre", role: "master", username: "mestre" };
const OUTSIDER = { id: "user-outro-1", perfil: "jogador", role: "player", username: "outro" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

function mockCharacter({ campanhaId = null, sharedWithPlayers = false } = {}) {
  return {
    id: "char-1",
    userId: OWNER.id,
    campanhaId,
    dadosExtras: { sharedWithPlayers },
  };
}

function mockMount(overrides = {}) {
  const mount = {
    id: "mount-1",
    characterId: "char-1",
    nome: "Fantasma Negro",
    especie: "Corcel",
    descricao: "",
    hp: 12,
    hpMax: 20,
    dadosExtras: { attributes: { FOR: 15, DES: 14, CON: 12, SAB: 10, ESP: 10, CAR: 10, INT: 10 }, alive: true, notes: "" },
    created_at: new Date("2026-11-17T10:00:00Z"),
    updated_at: new Date("2026-11-17T10:00:00Z"),
    ...overrides,
    async update(patch) { Object.assign(this, patch); return this; },
    async destroy() { return this; },
    toJSON() {
      const { update, destroy, toJSON, ...rest } = this;
      return rest;
    },
  };
  return mount;
}

function withMocks(t, character, { mounts = [], mount = null, member = null } = {}) {
  const original = {
    findByPk: Character.findByPk,
    findAll: Mount.findAll,
    findOne: Mount.findOne,
    create: Mount.create,
    campaignFindAll: Campaign.findAll,
    memberFindOne: CampaignMember.findOne,
  };
  Character.findByPk = async () => character;
  Mount.findAll = async ({ where } = {}) => mounts.filter((m) => m.characterId === (where?.characterId ?? character?.id));
  Mount.findOne = async ({ where } = {}) => {
    if (mount && where?.id === mount.id) return mount;
    return mounts.find((m) => m.id === where?.id) ?? null;
  };
  Mount.create = async (data) => mockMount({ ...data, id: "mount-novo" });
  Campaign.findAll = async () => [{ id: "camp-1" }];
  CampaignMember.findOne = async () => member;

  t.after(() => {
    Character.findByPk = original.findByPk;
    Mount.findAll = original.findAll;
    Mount.findOne = original.findOne;
    Mount.create = original.create;
    Campaign.findAll = original.campaignFindAll;
    CampaignMember.findOne = original.memberFindOne;
  });
}

test("list: dono recebe as montarias da ficha", async (t) => {
  const rows = [mockMount()];
  withMocks(t, mockCharacter(), { mounts: rows });
  const res = mockRes();
  await mountController.list({ params: { id: "char-1" }, user: OWNER }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].nome, "Fantasma Negro");
});

test("list: terceiro sem vínculo recebe 403", async (t) => {
  withMocks(t, mockCharacter(), { mounts: [], member: null });
  const res = mockRes();
  await mountController.list({ params: { id: "char-1" }, user: OUTSIDER }, res);
  assert.equal(res.statusCode, 403);
});

test("list: membro da mesa lê ficha compartilhada", async (t) => {
  withMocks(t, mockCharacter({ campanhaId: "camp-1", sharedWithPlayers: true }), { mounts: [mockMount()], member: { id: "member-1" } });
  const res = mockRes();
  await mountController.list({ params: { id: "char-1" }, user: OUTSIDER }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.length, 1);
});

test("create: mestre da campanha do personagem cria montaria", async (t) => {
  withMocks(t, mockCharacter({ campanhaId: "camp-1" }), { mounts: [] });
  const res = mockRes();
  await mountController.create(
    { params: { id: "char-1" }, user: MASTER, body: { nome: "Grifo", especie: "Grifo", hp: 99, hpMax: 40, atributos: { CON: 99 } } },
    res
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.hp, 40); // vida limitada ao máximo
  assert.equal(res.body.dadosExtras.attributes.CON, 30); // clamp 1..30
  assert.equal(res.body.dadosExtras.alive, true);
});

test("create: sem nome retorna 400", async (t) => {
  withMocks(t, mockCharacter(), { mounts: [] });
  const res = mockRes();
  await mountController.create(
    { params: { id: "char-1" }, user: OWNER, body: { nome: "   " } },
    res
  );
  assert.equal(res.statusCode, 400);
});

test("create: terceiro recebe 403", async (t) => {
  withMocks(t, mockCharacter(), { mounts: [] });
  const res = mockRes();
  await mountController.create(
    { params: { id: "char-1" }, user: OUTSIDER, body: { nome: "Grifo" } },
    res
  );
  assert.equal(res.statusCode, 403);
});

test("update: montante troca HP respeitando o máximo e preserva atributos", async (t) => {
  const existing = mockMount();
  withMocks(t, mockCharacter(), { mount: existing });
  const res = mockRes();
  await mountController.update(
    { params: { id: "char-1", mountId: "mount-1" }, user: OWNER, body: { hp: 999 } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.hp, 20);
  assert.equal(res.body.dadosExtras.attributes.FOR, 15);
});

test("update: montante de outra ficha retorna 404", async (t) => {
  withMocks(t, mockCharacter(), { mounts: [] });
  const res = mockRes();
  await mountController.update(
    { params: { id: "char-1", mountId: "mount-x" }, user: OWNER, body: { hp: 5 } },
    res
  );
  assert.equal(res.statusCode, 404);
});

test("update: terceiro recebe 403", async (t) => {
  const existing = mockMount();
  withMocks(t, mockCharacter(), { mount: existing });
  const res = mockRes();
  await mountController.update(
    { params: { id: "char-1", mountId: "mount-1" }, user: OUTSIDER, body: { hp: 5 } },
    res
  );
  assert.equal(res.statusCode, 403);
});

test("update: merge raso de dadosExtras preserva alive e notes anteriores", async (t) => {
  const existing = mockMount({ dadosExtras: { attributes: { FOR: 18, DES: 14 }, alive: false, notes: "fez xixi" } });
  withMocks(t, mockCharacter(), { mount: existing });
  const res = mockRes();
  await mountController.update(
    { params: { id: "char-1", mountId: "mount-1" }, user: OWNER, body: { atributos: { FOR: 11 } } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.dadosExtras.attributes.FOR, 11); // clamp 1..30 aplicado; os demais atributos foram preservados
  assert.equal(res.body.dadosExtras.attributes.DES, 14); // preservado do registro anterior
  assert.equal(res.body.dadosExtras.alive, false); // preservado do anterior
  assert.equal(res.body.dadosExtras.notes, "fez xixi");
});

test("remove: dono exclui a montaria", async (t) => {
  const existing = mockMount();
  withMocks(t, mockCharacter(), { mount: existing });
  const res = mockRes();
  await mountController.remove({ params: { id: "char-1", mountId: "mount-1" }, user: OWNER }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
});
