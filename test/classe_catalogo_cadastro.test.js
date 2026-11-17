// Cadastro de jogador: a "Classe / Ocupação" digitada livremente é salva no
// catálogo GLOBAL de classes (match ou criação automática, 1d8) para que a
// classe fique visível e editável no /admin/classes (Classes & Níveis) do mestre.
import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { authController } from "../src/controllers/authController.js";
import {
  User, Character, Campaign, CampaignMember, AtributosPersonagem, SessaoAutenticacao, Race, Class,
} from "../src/models/index.js";

const SEED_CLASSES = [
  { id: "bruxeiro-1", slug: "bruxeiro", nome: "Bruxeiro", dadoDeVida: "1d10", ordem: 10 },
  { id: "barbaro-test-1", slug: "barbaro", nome: "Bárbaro", dadoDeVida: "1d12", ordem: 30 },
];

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
}

function withCatalogMocks(t, { catalogRows = SEED_CLASSES, catalogFindAll, onClassCreate = null } = {}) {
  const original = {
    userCreate: User.create,
    userFindOne: User.findOne,
    characterCreate: Character.create,
    atributosCreate: AtributosPersonagem.create,
    sessaoCreate: SessaoAutenticacao.create,
    sessaoFindOne: SessaoAutenticacao.findOne,
    raceFindByPk: Race.findByPk,
    raceFindOne: Race.findOne,
    classFindAll: Class.findAll,
    classCreate: Class.create,
    classFindOne: Class.findOne,
    campaignFind: Campaign.findOne,
    memberCreate: CampaignMember.create,
  };

  const created = { character: null, user: null };
  const classCreateCalls = [];

  User.create = async (data) => {
    created.user = { id: "usr-classe-1", ...data };
    return created.user;
  };
  User.findOne = async () => null;
  Character.create = async (data) => {
    const ch = {
      id: "char-classe-1",
      ...data,
      toJSON() { return { ...ch }; },
    };
    ch.update = async (patch) => Object.assign(ch, patch);
    created.character = ch;
    return ch;
  };
  AtributosPersonagem.create = async () => ({});
  SessaoAutenticacao.create = async (data) => data;
  SessaoAutenticacao.findOne = async () => ({ revogadaAt: null, expiraAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
  Race.findByPk = async () => null;
  Race.findOne = async () => null;
  Campaign.findOne = async () => null;
  CampaignMember.create = async () => ({});
  Class.findAll = typeof catalogFindAll === "function" ? catalogFindAll : async () => catalogRows;
  Class.findOne = async () => null; // uniqueSlug: slug base sempre livre
  Class.create = async (data) => {
    classCreateCalls.push(data);
    if (onClassCreate) return onClassCreate(data);
    return { id: `classe-nova-${classCreateCalls.length}`, ...data };
  };

  t.after(() => {
    User.create = original.userCreate;
    User.findOne = original.userFindOne;
    Character.create = original.characterCreate;
    AtributosPersonagem.create = original.atributosCreate;
    SessaoAutenticacao.create = original.sessaoCreate;
    SessaoAutenticacao.findOne = original.sessaoFindOne;
    Race.findByPk = original.raceFindByPk;
    Race.findOne = original.raceFindOne;
    Class.findAll = original.classFindAll;
    Class.create = original.classCreate;
    Class.findOne = original.classFindOne;
    Campaign.findOne = original.campaignFind;
    CampaignMember.create = original.memberCreate;
  });

  return { created, classCreateCalls };
}

const baseBody = {
  username: "jogadorClasse",
  email: "classe@rpg.dev",
  password: "senhaSegura123",
  characterName: "Herói do Catálogo",
};

test("classe nova digitada no cadastro é CRIADA no catálogo global (1d8) e vinculada à ficha", async (t) => {
  const { created, classCreateCalls } = withCatalogMocks(t, { catalogRows: SEED_CLASSES });
  const res = mockRes();
  await authController.register(
    { body: { ...baseBody, characterJob: "Necromante" }, ip: "127.0.0.1", headers: {} },
    res,
  );

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(classCreateCalls.length, 1, "Class.create deve ser chamado exatamente uma vez");
  const nova = classCreateCalls[0];
  assert.equal(nova.nome, "Necromante");
  assert.equal(nova.slug, "necromante");
  assert.equal(nova.dadoDeVida, "1d8", "classe automática nasce com 1d8 (o mestre calibra depois)");
  assert.equal(nova.ordem, 100);
  assert.equal(nova.criadoPor, "usr-classe-1", "classe registra quem a criou no cadastro");

  assert.equal(created.character.classeId, "classe-nova-1", "ficha vinculada à classe criada");
  assert.equal(created.character.hp, 8, "HP inicial = máximo do dado de vida da classe criada (1d8)");
  assert.equal(created.character.hpMax, 8);
  assert.deepEqual(created.character.dadosExtras.class, "necromante");
  assert.deepEqual(created.character.dadosExtras.hitDie, "1d8");
});

test("classe digitada com caixa/acentos diferentes REUTILIZA a do catálogo (sem criar)", async (t) => {
  const { created, classCreateCalls } = withCatalogMocks(t, { catalogRows: SEED_CLASSES });
  const res = mockRes();
  await authController.register(
    { body: { ...baseBody, characterJob: "  bárbaro " }, ip: "127.0.0.1", headers: {} },
    res,
  );

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(classCreateCalls.length, 0, "não deve criar classe duplicada no catálogo");
  assert.equal(created.character.classeId, "barbaro-test-1");
  assert.equal(created.character.hp, 12, "HP = máximo do dado da classe catalogada (1d12)");
});

test("job sem nenhum caractere alfanumérico não gera classe no catálogo", async (t) => {
  const { created, classCreateCalls } = withCatalogMocks(t, { catalogRows: SEED_CLASSES });
  const res = mockRes();
  await authController.register(
    { body: { ...baseBody, characterJob: "!!!" }, ip: "127.0.0.1", headers: {} },
    res,
  );

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(classCreateCalls.length, 0);
  assert.equal(created.character.classeId, null);
  assert.equal(created.character.hp, 70, "sem classe e sem raça: HP padrão 70");
});

test("corrida de cadastros com o mesmo nome: vence o vencedor da unique e reutiliza a classe", async (t) => {
  const uniqueError = Object.assign(new Error("duplicate slug"), { name: "SequelizeUniqueConstraintError" });
  // 1ª listagem: catálogo vazio (duas requisições passam da checagem ao mesmo tempo)
  // Depois da violação de unique, a re-resolução enxerga a classe criada pelo outro cadastro.
  const raceWinner = { id: "classe-race-1", slug: "necromante", nome: "Necromante", dadoDeVida: "1d8", ordem: 100 };
  let findAllCalls = 0;
  const catalogFindAll = async () => {
    findAllCalls += 1;
    return findAllCalls === 1 ? [] : [raceWinner];
  };

  const { created } = withCatalogMocks(t, {
    catalogFindAll,
    onClassCreate: () => { throw uniqueError; },
  });

  const res = mockRes();
  await authController.register(
    { body: { ...baseBody, characterJob: "Necromante" }, ip: "127.0.0.1", headers: {} },
    res,
  );

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(created.character.classeId, "classe-race-1", "ficha vinculada à classe criada pelo outro cadastro");
});
