import { Character, InventoryItem, Contract } from "../models/index.js";

export const characterController = {
  // Lista todos os personagens
  async list(req, res) {
    try {
      const characters = await Character.findAll({
        attributes: ["id", "name", "level", "job", "hp", "hpMax", "updatedAt"],
        order: [["updatedAt", "DESC"]],
      });
      return res.json(characters);
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

      return res.json(character);
    } catch (error) {
      console.error("Erro ao buscar personagem:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagem." });
    }
  },

  // Cria um novo personagem
  async create(req, res) {
    try {
      const data = req.body;
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

      await character.update(req.body);
      return res.json(character);
    } catch (error) {
      console.error("Erro ao atualizar personagem:", error);
      return res.status(400).json({ error: "Erro ao atualizar personagem." });
    }
  },

  // Sincronização completa da ficha (upsert ideal para frontend)
  async sync(req, res) {
    try {
      const payload = req.body;
      const id = payload.id;

      let character;
      if (id) {
        character = await Character.findByPk(id);
      }

      if (character) {
        await character.update(payload);
      } else {
        character = await Character.create(payload);
      }

      return res.json({
        success: true,
        message: "Ficha sincronizada com sucesso.",
        character,
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

      await character.destroy();
      return res.json({ success: true, message: "Personagem removido." });
    } catch (error) {
      console.error("Erro ao remover personagem:", error);
      return res.status(500).json({ error: "Erro ao remover personagem." });
    }
  },
};
