import { Rolagem, Character, Campaign, CampaignMember, Encounter } from "../models/index.js";
import { getCampaignAccess } from "../services/campaignAccess.js";
import { Op } from "sequelize";

// Histórico de rolagens persistidas. Dono vê as próprias;
// mestre dono da campanha vê todas da mesa; ninguém vê de campanha alheia.
export const rolagemController = {
  async registrar(req, res) {
    try {
      const {
        formula, expressao, resultados, kept, modifier = 0, total,
        modo = "normal", critico = false, falhaCritica = false,
        contexto, personagemId, encontroId,
      } = req.body;
      let { campanhaId } = req.body;

      let character = null;
      if (personagemId) {
        character = await Character.findByPk(personagemId, { attributes: ["id", "userId", "campanhaId", "dadosExtras"] });
        if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
        const isOwner = character.userId === req.user.id;
        let isTableMaster = false;
        if (!isOwner && character.campanhaId) {
          const access = await getCampaignAccess(req.user, character.campanhaId);
          isTableMaster = access.isOwner;
        }
        if (!isOwner && !isTableMaster) {
          return res.status(403).json({ error: "Rolagens deste personagem pertencem à ficha." });
        }
        campanhaId = campanhaId ?? character.campanhaId ?? null;
      }

      if (campanhaId) {
        const access = await getCampaignAccess(req.user, campanhaId);
        if (!access.permitido) {
          return res.status(403).json({ error: "Você não participa desta mesa." });
        }
      }

      if (encontroId) {
        const encontro = await Encounter.findByPk(encontroId, { attributes: ["id", "campanhaId"] });
        if (!encontro) return res.status(404).json({ error: "Encontro não encontrado." });
        if (campanhaId && encontro.campanhaId !== campanhaId) {
          return res.status(400).json({ error: "O encontro informado pertence a outra campanha." });
        }
      }

      const rolagem = await Rolagem.create({
        usuarioId: req.user.id,
        personagemId: personagemId || null,
        campanhaId: campanhaId || null,
        encontroId: encontroId || null,
        formula,
        expressao: expressao ?? null,
        resultados: Array.isArray(resultados) ? resultados : [],
        kept: kept ?? null,
        modifier: Number(modifier) || 0,
        total: Number(total),
        modo,
        critico: Boolean(critico),
        falhaCritica: Boolean(falhaCritica),
        contexto: contexto ?? null,
      });
      return res.status(201).json(rolagem);
    } catch (error) {
      console.error("Erro ao registrar rolagem:", error);
      return res.status(500).json({ error: "Erro ao registrar rolagem." });
    }
  },

  async listar(req, res) {
    try {
      const { campanhaId, personagemId, limit = "50" } = req.query;
      const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

      if (campanhaId) {
        const access = await getCampaignAccess(req.user, campanhaId);
        if (!access.permitido) {
          return res.status(403).json({ error: "Você não participa desta mesa." });
        }
        const where = access.isOwner
          ? { campanhaId } // mestre dono vê todas
          : { campanhaId, usuarioId: req.user.id }; // membro vê só as próprias
        const rolagens = await Rolagem.findAll({ where, order: [["created_at", "DESC"]], limit: safeLimit });
        return res.json(rolagens);
      }

      if (personagemId) {
        const character = await Character.findByPk(personagemId, { attributes: ["id", "userId", "campanhaId"] });
        if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
        const isOwner = character.userId === req.user.id;
        let isTableMaster = false;
        if (character.campanhaId) {
          const access = await getCampaignAccess(req.user, character.campanhaId);
          isTableMaster = access.isOwner;
        }
        if (!isOwner && !isTableMaster) {
          return res.status(403).json({ error: "Rolagens deste personagem pertencem à ficha." });
        }
        const where = isOwner && !isTableMaster
          ? { personagemId, usuarioId: req.user.id } // dono vê as próprias
          : { personagemId };
        const rolagens = await Rolagem.findAll({ where, order: [["created_at", "DESC"]], limit: safeLimit });
        return res.json(rolagens);
      }

      // Sem filtro: apenas as próprias rolagens
      const rolagens = await Rolagem.findAll({
        where: { usuarioId: req.user.id },
        order: [["created_at", "DESC"]],
        limit: safeLimit,
      });
      return res.json(rolagens);
    } catch (error) {
      console.error("Erro ao listar rolagens:", error);
      return res.status(500).json({ error: "Erro ao listar rolagens." });
    }
  },
};
