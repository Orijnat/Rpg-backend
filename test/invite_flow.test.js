import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { campanhaController } from "../src/controllers/campanhaController.js";
import { authController } from "../src/controllers/authController.js";
import { Campaign, User, Character, CampaignMember, SessaoAutenticacao, Race, Class } from "../src/models/index.js";

test("Fluxo de Convites de Mesa — Controller Unit Tests", async (t) => {
  await t.test("1. consultarConvitePublico rejeita código vazio", async () => {
    let statusCode = 200;
    let jsonBody = null;
    const req = { params: { codigo: "   " } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonBody = data;
        return this;
      },
    };

    await campanhaController.consultarConvitePublico(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody.valido, false);
    assert.match(jsonBody.error, /não informado/i);
  });

  await t.test("2. consultarConvitePublico retorna 404 quando mesa não existe", async () => {
    const originalFindOne = Campaign.findOne;
    Campaign.findOne = async () => null;
    const originalRaceFindOne = Race.findOne;
    Race.findOne = async ({ where } = {}) => ({ id: "11111111-1111-1111-1111-111111111111", slug: where?.slug ?? "humano", nome: "Humano", dadoDeVida: "1d8", dado_de_vida: "1d8" });

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = { params: { codigo: "INV-INEXISTENTE" } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        },
      };

      await campanhaController.consultarConvitePublico(req, res);
      assert.equal(statusCode, 404);
      assert.equal(jsonBody.valido, false);
      assert.match(jsonBody.error, /Nenhuma mesa de RPG encontrada/i);
    } finally {
      Campaign.findOne = originalFindOne;
    }
  });

  await t.test("3. consultarConvitePublico rejeita mesa encerrada", async () => {
    const originalFindOne = Campaign.findOne;
    Campaign.findOne = async () => ({
      id: "camp-123",
      nome: "Campanha Concluída",
      estado: "encerrada",
      codigoConvite: "INV-FIM",
    });

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = { params: { codigo: "INV-FIM" } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        },
      };

      await campanhaController.consultarConvitePublico(req, res);
      assert.equal(statusCode, 400);
      assert.equal(jsonBody.valido, false);
      assert.match(jsonBody.error, /encerrada/i);
    } finally {
      Campaign.findOne = originalFindOne;
    }
  });

  await t.test("4. consultarConvitePublico retorna dados da mesa ativa com sucesso", async () => {
    const originalFindOne = Campaign.findOne;
    Campaign.findOne = async () => ({
      id: "camp-999",
      nome: "A Lenda de Valdor",
      descricao: "Aventuras no reino esquecido",
      estado: "ativa",
      codigoConvite: "INV-VAL-10",
      proprietario: { id: "usr-mestre", username: "GandalfMestre" },
    });

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = { params: { codigo: "inv-val-10" } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        },
      };

      await campanhaController.consultarConvitePublico(req, res);
      assert.equal(statusCode, 200);
      assert.equal(jsonBody.valido, true);
      assert.equal(jsonBody.campanha.nome, "A Lenda de Valdor");
      assert.equal(jsonBody.campanha.mestre, "GandalfMestre");
      assert.equal(jsonBody.campanha.codigoConvite, "INV-VAL-10");
    } finally {
      Campaign.findOne = originalFindOne;
    }
  });

  await t.test("5. authController.register vincula usuário à mesa quando convite fornecido", async () => {
    const originalCampaignFind = Campaign.findOne;
    const originalUserFind = User.findOne;
    const originalUserCreate = User.create;
    const originalCharCreate = Character.create;
    const originalMemberCreate = CampaignMember.create;
    const originalSessaoCreate = SessaoAutenticacao.create;
    const originalClassFindAll = Class.findAll;
    const originalClassCreate = Class.create;
    const originalRaceFindOne = Race.findOne;
    Race.findOne = async ({ where } = {}) => ({ id: "11111111-1111-1111-1111-111111111111", slug: where?.slug ?? "humano", nome: "Humano", dadoDeVida: "1d8", dado_de_vida: "1d8" });

    let memberCreatedWith = null;
    let characterCreatedWith = null;

    SessaoAutenticacao.create = async () => ({}); // registro de sessão server-side mockado
    // Catálogo de classes: "Bárbaro" casa com a classe seed (match sem acento/caixa)
    Class.findAll = async () => [
      { id: "barbaro-test-1", slug: "barbaro", nome: "Bárbaro", dadoDeVida: "1d12", dado_de_vida: "1d12", ordem: 30 },
    ];
    Class.create = async (data) => {
      throw new Error(`Class.create não deveria ser chamado no registro com classe catalogada (recebeu: ${JSON.stringify(data)})`);
    };

    Campaign.findOne = async ({ where }) => {
      if (where.codigoConvite === "INV-CONVITE-OK") {
        return {
          id: "camp-alvo-1",
          nome: "Mesa dos Bravos",
          estado: "ativa",
          codigoConvite: "INV-CONVITE-OK",
        };
      }
      return null;
    };

    User.findOne = async () => null; // Ninguém cadastrado com este e-mail/username
    User.create = async (userData) => ({
      id: "usr-novo-1",
      ...userData,
    });

    Character.create = async (charData) => {
      characterCreatedWith = charData;
      return {
        id: "char-novo-1",
        ...charData,
      };
    };

    CampaignMember.create = async (memberData) => {
      memberCreatedWith = memberData;
      return memberData;
    };

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = {
        body: {
          username: "novoGuerreiro",
          email: "guerreiro@rpg.com",
          password: "senhaSegura123",
          characterName: "Thorgar",
          characterJob: "Bárbaro",
          race: "humano",
          FOR: 12, DES: 10, CON: 12, SAB: 10, ESP: 10, CAR: 10, INT: 10,
          hitDie: "1d10",
          inviteCode: "inv-convite-ok",
        },
        ip: "127.0.0.1",
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        },
      };

      await authController.register(req, res);

      assert.equal(statusCode, 201);
      assert.ok(jsonBody?.token, "registro emite token (login automático)");
      assert.equal(jsonBody.user.username, "novoGuerreiro");
      assert.equal(jsonBody.character.name, "Thorgar");

      // Vínculo com a mesa
      assert.ok(characterCreatedWith, "Personagem deve ser criado");
      assert.equal(characterCreatedWith.campanhaId, "camp-alvo-1", "Personagem deve ter campanhaId preenchido");

      assert.ok(memberCreatedWith, "CampaignMember deve ser criado");
      assert.equal(memberCreatedWith.campanhaId, "camp-alvo-1");
      assert.equal(memberCreatedWith.usuarioId, "usr-novo-1");
      assert.equal(memberCreatedWith.papel, "jogador");
    } finally {
      Campaign.findOne = originalCampaignFind;
      User.findOne = originalUserFind;
      User.create = originalUserCreate;
      Character.create = originalCharCreate;
      CampaignMember.create = originalMemberCreate;
    SessaoAutenticacao.create = originalSessaoCreate;
    Race.findOne = originalRaceFindOne;
    Class.findAll = originalClassFindAll;
    Class.create = originalClassCreate;
    }
  });

  await t.test("6. authController.register rejeita código de convite inválido com 404", async () => {
    const originalCampaignFind = Campaign.findOne;
    Campaign.findOne = async () => null;
    const originalRaceFindOne2 = Race.findOne;
    Race.findOne = async ({ where } = {}) => ({ id: "11111111-1111-1111-1111-111111111111", slug: where?.slug ?? "humano", nome: "Humano", dadoDeVida: "1d8", dado_de_vida: "1d8" });

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = {
        body: {
          username: "outroGuerreiro",
          email: "outro@rpg.com",
          password: "senhaSegura123",
          characterName: "Outro",
          characterJob: "Guerreiro",
          race: "humano",
          inviteCode: "CODIGO-INVALIDO",
        },
        ip: "127.0.0.1",
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonBody = data;
          return this;
        },
      };

      await authController.register(req, res);
      assert.equal(statusCode, 404);
      assert.match(jsonBody.error, /Nenhuma mesa de RPG encontrada/i);
    } finally {
      Campaign.findOne = originalCampaignFind;
      Race.findOne = originalRaceFindOne2;
    }
  });
});
