import { Character, InventoryItem, Contract } from "../models/index.js";

function canManageCharacter(user, character) {
  return user?.perfil === "mestre" || user?.role === "master" || character.userId === user?.id;
}

function publicCharacter(character) {
  const data = character.toJSON ? character.toJSON() : { ...character };
  data.FOR = data.forca ?? data.FOR ?? data.attributes?.FOR ?? 10;
  data.DES = data.destreza ?? data.DES ?? data.attributes?.DES ?? 10;
  data.CON = data.constituicao ?? data.CON ?? data.attributes?.CON ?? 10;
  data.SAB = data.sabedoria ?? data.SAB ?? data.attributes?.SAB ?? 10;
  data.ESP = data.espirito ?? data.ESP ?? data.attributes?.ESP ?? 10;
  data.CAR = data.carisma ?? data.CAR ?? data.attributes?.CAR ?? 10;
  data.INT = data.inteligencia ?? data.INT ?? data.attributes?.INT ?? 10;
  data.skills = data.pericias?.length ? data.pericias : data.skills || [];
  data.inventory = data.itensInventario?.length ? data.itensInventario : data.inventory || [];
  data.contracts = data.contratosDados?.length ? data.contratosDados : data.contracts || [];
  data.players = data.jogadores || [];
  data.npcs = data.npcs || [];
  data.notesImages = data.imagensAnotacoes || [];
  delete data.bankPassword;
  return data;
}

function normalizeCharacterPayload(payload) {
  const data = { ...payload };
  const atributos = {
    FOR: data.FOR ?? data.attributes?.FOR,
    DES: data.DES ?? data.attributes?.DES,
    CON: data.CON ?? data.attributes?.CON,
    SAB: data.SAB ?? data.attributes?.SAB,
    ESP: data.ESP ?? data.attributes?.ESP,
    CAR: data.CAR ?? data.attributes?.CAR,
    INT: data.INT ?? data.attributes?.INT,
  };
  if (atributos.FOR != null) data.forca = atributos.FOR;
  if (atributos.DES != null) data.destreza = atributos.DES;
  if (atributos.CON != null) data.constituicao = atributos.CON;
  if (atributos.SAB != null) data.sabedoria = atributos.SAB;
  if (atributos.ESP != null) data.espirito = atributos.ESP;
  if (atributos.CAR != null) data.carisma = atributos.CAR;
  if (atributos.INT != null) data.inteligencia = atributos.INT;
  if (data.skills) data.pericias = data.skills;
  if (data.inventory) data.itensInventario = data.inventory;
  if (data.contracts) data.contratosDados = data.contracts;
  if (data.players) data.jogadores = data.players;
  if (data.notesImages) data.imagensAnotacoes = data.notesImages;
  if (Object.values(atributos).every((valor) => valor != null)) data.attributes = atributos;
  return data;
}

export const characterController = {
  // Lista todos os personagens
  async list(req, res) {
    try {
      const characters = await Character.findAll({
        where: req.user.perfil === "mestre" || req.user.role === "master" ? undefined : { userId: req.user.id },
        attributes: ["id", "userId", "name", "level", "job", "hp", "hpMax", "updatedAt"],
        order: [["updatedAt", "DESC"]],
      });
      return res.json(characters.map(publicCharacter));
    } catch (error) {
      console.error("Erro ao listar personagens:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagens." });
    }
  },

  // Busca um personagem completo por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id, {
        include: [
          { model: InventoryItem, as: "inventory" },
          { model: Contract, as: "contracts" },
        ],
      });

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      if (!canManageCharacter(req.user, character)) {
        return res.status(403).json({ error: "Este personagem não pertence ao seu perfil." });
      }

      return res.json(publicCharacter(character));
    } catch (error) {
      console.error("Erro ao buscar personagem:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagem." });
    }
  },

  // Cria um novo personagem
  async create(req, res) {
    try {
      const data = normalizeCharacterPayload(req.body);
      if (req.user.role !== "master") {
        data.userId = req.user.id;
      }
      const newCharacter = await Character.create(data);
      return res.status(201).json(newCharacter);
    } catch (error) {
      console.error("Erro ao criar personagem:", error);
      return res.status(400).json({ error: error.message || "Erro ao criar personagem." });
    }
  },

  // Atualiza um personagem existente
  async update(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      if (!canManageCharacter(req.user, character)) {
        return res.status(403).json({ error: "Este personagem não pertence ao seu perfil." });
      }

      await character.update(normalizeCharacterPayload(req.body));
      return res.json(publicCharacter(character));
    } catch (error) {
      console.error("Erro ao atualizar personagem:", error);
      return res.status(400).json({ error: "Erro ao atualizar personagem." });
    }
  },

  // Sincronização completa da ficha (upsert ideal para frontend)
  async sync(req, res) {
    try {
      const payload = normalizeCharacterPayload(req.body);
      const id = payload.id;

      let character;
      if (id) {
        character = await Character.findByPk(id);
      }

      if (character) {
        if (!canManageCharacter(req.user, character)) {
          return res.status(403).json({ error: "Este personagem não pertence ao seu perfil." });
        }
        await character.update(payload);
      } else {
        if (req.user && !payload.userId) {
          payload.userId = req.user.id;
        }
        character = await Character.create(payload);
      }

      return res.json({
        success: true,
        message: "Ficha sincronizada com sucesso.",
        character: publicCharacter(character),
      });
    } catch (error) {
      console.error("Erro ao sincronizar personagem:", error);
      return res.status(500).json({ error: "Falha na sincronização da ficha." });
    }
  },

  // Verificação de senha do cofre bancário
  async verifyBankPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      const character = await Character.findByPk(id, {
        attributes: ["id", "bankPassword"],
      });

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      if (!canManageCharacter(req.user, character)) {
        return res.status(403).json({ error: "Este personagem não pertence ao seu perfil." });
      }

      const isValid = String(character.bankPassword) === String(password);
      return res.json({ valid: isValid });
    } catch (error) {
      console.error("Erro ao verificar senha bancária:", error);
      return res.status(500).json({ error: "Erro ao validar senha bancária." });
    }
  },

  // Deleta um personagem
  async delete(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      if (!canManageCharacter(req.user, character)) {
        return res.status(403).json({ error: "Este personagem não pertence ao seu perfil." });
      }

      await character.destroy();
      return res.json({ success: true, message: "Personagem removido." });
    } catch (error) {
      console.error("Erro ao remover personagem:", error);
      return res.status(500).json({ error: "Erro ao remover personagem." });
    }
  },
};
