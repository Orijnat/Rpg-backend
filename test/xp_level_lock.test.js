import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { characterController } from "../src/controllers/characterController.js";
import { Character, AtributosPersonagem, Race, Class, Campaign, CampaignMember, User } from "../src/models/index.js";

const PLAYER = { id: "user-xp-1", perfil: "jogador", role: "player", username: "leo" };
const MASTER = { id: "user-mestre-1", perfil: "mestre", role: "master", username: "mestre" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

function makeTarget({ dadosExtras = {}, campanhaId = null } = {}) {
  return {
    id: "char-xp-1",
    userId: PLAYER.id,
    campanhaId,
    classeId: null,
    racaId: null,
    updated_at: new Date("2026-11-17T12:00:00.000Z"),
    dadosExtras,
    captured: null,
    async update(patch) {
      this.captured = { ...(this.captured || {}), ...patch };
      Object.assign(this, patch);
      return this;
    },
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        campanhaId: this.campanhaId,
        classeId: this.classeId,
        racaId: this.racaId,
        name: "Herói XP",
        hp: 50,
        hpMax: 70,
        level: this.level ?? 5,
        dadosExtras: this.dadosExtras,
        attributes: {},
        created_at: new Date("2026-11-01T00:00:00.000Z"),
        updated_at: new Date("2026-11-17T12:00:00.000Z"),
      };
    },
  };
}

function withMocks(t, target, { campaigns = [] } = {}) {
  const original = {
    findByPk: Character.findByPk,
    atributosFindOne: AtributosPersonagem.findOne,
    atributosUpdate: AtributosPersonagem.update,
    atributosCreate: AtributosPersonagem.create,
    campaignFindAll: Campaign.findAll,
    memberFindOne: CampaignMember.findOne,
    userFindOne: User.findOne,
  };
  Character.findByPk = async (id) => {
    if (id === target.id) return target;
    return null;
  };
  AtributosPersonagem.findOne = async () => ({ update: async () => ({}) });
  AtributosPersonagem.update = async () => ([1]);
  AtributosPersonagem.create = async (data) => data;
  Campaign.findAll = async () => campaigns;
  CampaignMember.findOne = async () => null;
  User.findOne = async () => null;

  t.after(() => {
    Character.findByPk = original.findByPk;
    AtributosPersonagem.findOne = original.atributosFindOne;
    AtributosPersonagem.update = original.atributosUpdate;
    AtributosPersonagem.create = original.atributosCreate;
    Campaign.findAll = original.campaignFindAll;
    CampaignMember.findOne = original.memberFindOne;
    User.findOne = original.userFindOne;
  });
}

test("jogador sincroniza: XP e nível NÃO são alterados no servidor", async (t) => {
  const target = makeTarget({ dadosExtras: { xp: 1234, hitDie: "1d8" } });
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync(
    { params: { id: "char-xp-1" }, user: PLAYER, body: { id: "char-xp-1", xp: 99999, level: 20, experiencia: 99999, dadosExtras: { xp: 99999 } } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(target.captured?.experiencia, undefined, "experiencia não deve ser enviada para o banco");
  assert.equal(target.captured?.level, undefined, "level não deve ser enviado para o banco");
  assert.equal(target.dadosExtras.xp, 1234, "extras.xp legado preservado do servidor");
});

test("mestre sincroniza: XP e nível SÃO aplicados", async (t) => {
  const target = makeTarget({ dadosExtras: { xp: 100, hitDie: "1d8" }, campanhaId: "camp-1" });
  withMocks(t, target, { campaigns: [{ id: "camp-1" }] });
  const res = mockRes();
  await characterController.sync(
    { params: { id: "char-xp-1" }, user: MASTER, body: { id: "char-xp-1", xp: 4321, level: 12, dadosExtras: { xp: 4321 } } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(target.captured?.experiencia, 4321, "mestre altera xp");
  assert.equal(target.captured?.level, 12, "mestre altera nível");
  assert.equal(target.dadosExtras.xp, 4321, "extras.xp do mestre é aplicado");
});

test("jogador com apenas mudanças permitidas sincroniza normalmente", async (t) => {
  const target = makeTarget({});
  withMocks(t, target);
  const res = mockRes();
  await characterController.sync(
    { params: { id: "char-xp-1" }, user: PLAYER, body: { id: "char-xp-1", hp: 60 } },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(target.captured?.hp, 60, "hp comum continua livre para o dono");
});
