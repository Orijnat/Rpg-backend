import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { characterController } from "../src/controllers/characterController.js";
import { Character, Campaign, CampaignMember } from "../src/models/index.js";

const MASTER = { id: "user-mestre-list-1", perfil: "mestre", role: "master", username: "mestre" };

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

test("listagem de personagens seleciona experiencia (XP real nos payloads públicos)", async (t) => {
  const original = {
    findAll: Character.findAll,
    campaignFindAll: Campaign.findAll,
    memberFindAll: CampaignMember.findAll,
  };
  let captured = null;
  Character.findAll = async (query) => { captured = query; return []; };
  Campaign.findAll = async () => []; // mestre sem campanhas próprias
  CampaignMember.findAll = async () => [];

  t.after(() => {
    Character.findAll = original.findAll;
    Campaign.findAll = original.campaignFindAll;
    CampaignMember.findAll = original.memberFindAll;
  });

  const res = mockRes();
  await characterController.list({ query: {}, user: MASTER }, res);

  assert.equal(res.statusCode, 200);
  assert.ok(captured, "findAll deve ser chamado");
  assert.ok(Array.isArray(captured?.attributes), "listagem deve limitar atributos");
  assert.ok(captured.attributes.includes("experiencia"), "experiencia precisa ser selecionada para publicCharacter mapear xp");
  assert.ok(captured.attributes.includes("hpMax"), "atributos essenciais mantidos");
});
