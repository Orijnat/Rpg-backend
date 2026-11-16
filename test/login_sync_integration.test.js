// Integração: cadastro → /me (sessão server-side) → sync da ficha → leitura.
// Modelos Sequelize mockados no mesmo padrão de test/invite_flow.test.js.
import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { authController } from "../src/controllers/authController.js";
import { characterController } from "../src/controllers/characterController.js";
import {
  User, Character, Campaign, CampaignMember, AtributosPersonagem, SessaoAutenticacao,
} from "../src/models/index.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

test("login → personagem → sincronização (com JWT + sessão server-side)", async (t) => {
  const ORG = {
    userCreate: User.create,
    userFindOne: User.findOne,
    userFindByPk: User.findByPk,
    characterCreate: Character.create,
    characterFindAll: Character.findAll,
    characterFindByPk: Character.findByPk,
    atributosFindOne: AtributosPersonagem.findOne,
    campanhaFind: Campaign.findOne,
    membroCreate: CampaignMember.create,
    sessaoCreate: SessaoAutenticacao.create,
    sessaoFindOne: SessaoAutenticacao.findOne,
  };

  const created = { user: null, character: null, sessao: null, updates: [] };

  User.create = async (data) => {
    created.user = { id: "usr-int-1", ...data, save: async () => created.user };
    return created.user;
  };
  User.findOne = async () => null; // sem duplicidade de username/email
  Character.create = async (data) => {
    const ch = {
      id: "char-int-1",
      ...data,
      toJSON() { return { ...ch }; },
    };
    ch.update = async (patch) => { created.updates.push(patch); Object.assign(ch, patch); return ch; };
    created.character = ch;
    return ch;
  };
  Character.findAll = async () => [created.character];
  Character.findByPk = async () => created.character;
  AtributosPersonagem.findOne = async () => ({ personagemId: "char-int-1", update: async () => ({}) });
  Campaign.findOne = async () => null;
  CampaignMember.create = async () => ({});
  SessaoAutenticacao.create = async (data) => { created.sessao = data; return data; };
  SessaoAutenticacao.findOne = async () => ({ revogadaAt: null, expiraAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });

  t.after(() => {
    Object.assign(User, { create: ORG.userCreate, findOne: ORG.userFindOne, findByPk: ORG.userFindByPk });
    Character.create = ORG.characterCreate;
    Character.findAll = ORG.characterFindAll;
    Character.findByPk = ORG.characterFindByPk;
    AtributosPersonagem.findOne = ORG.atributosFindOne;
    Campaign.findOne = ORG.campanhaFind;
    CampaignMember.create = ORG.membroCreate;
    SessaoAutenticacao.create = ORG.sessaoCreate;
    SessaoAutenticacao.findOne = ORG.sessionFindOne || ORG.sessaoFindOne;
  });

  // 1. Registro
  const reqRegister = {
    body: { username: "integrante", email: "int@rpg.dev", password: "senhaIntegracao1", characterName: "Integ", characterJob: "Bárbaro", race: "humano" },
    ip: "127.0.0.1",
    headers: {},
  };
  const resRegister = mockRes();
  await authController.register(reqRegister, resRegister);
  assert.equal(resRegister.statusCode, 201);
  assert.ok(resRegister.body?.token, "register emite token");
  assert.ok(created.sessao?.tokenHash, "register cria sessão server-side");
  assert.ok(resRegister.body?.characters?.[0]?.id, "character retornado no register");

  // 2. /me (token decodificado como faria o middleware real)
  const payload = JSON.parse(Buffer.from(resRegister.body.token.split(".")[1], "base64url").toString());
  User.findByPk = async () => created.user;
  const resMe = mockRes();
  await authController.me({ user: created.user, tokenPayload: payload }, resMe);
  assert.equal(resMe.statusCode, 200);
  assert.equal(resMe.body?.user?.username, "integrante");
  assert.ok(Array.isArray(resMe.body?.characters));

  // 3. Sincronização da ficha (contrato do frontend: id + updatedAt do servidor)
  const syncBody = {
    id: created.character.id,
    name: "Integ (atualizada)",
    FOR: 14,
    hp: 55,
    updatedAt: new Date().toISOString(),
  };
  const resSync = mockRes();
  await characterController.sync({ user: created.user, body: syncBody }, resSync);
  assert.equal(resSync.statusCode, 200, JSON.stringify(resSync.body));
  assert.equal(resSync.body?.success, true);
  assert.equal(resSync.body?.character?.name, "Integ (atualizada)");
  assert.equal(resSync.body?.character?.forca ?? resSync.body?.character?.FOR, 14);
});
