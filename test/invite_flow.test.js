import test from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-de-pelo-menos-32-chars-long";

import { campanhaController } from "../src/controllers/campanhaController.js";
import { authController } from "../src/controllers/authController.js";
import { Campaign, User, Character, CampaignMember } from "../src/models/index.js";

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

    let memberCreatedWith = null;
    let characterCreatedWith = null;

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
      assert.ok(jsonBody.token);
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
    }
  });

  await t.test("6. authController.register rejeita código de convite inválido com 404", async () => {
    const originalCampaignFind = Campaign.findOne;
    Campaign.findOne = async () => null;

    try {
      let statusCode = 200;
      let jsonBody = null;
      const req = {
        body: {
          username: "outroGuerreiro",
          email: "outro@rpg.com",
          password: "senhaSegura123",
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
    }
  });
});
