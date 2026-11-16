import { Campaign, CampaignMember, Encounter, LogBatalha } from "../models/index.js";
import { getCampaignAccess, requireCampaignAccess } from "../services/campaignAccess.js";
import {
  registrarEventoBatalha,
  resolverCampanhasPermitidas,
  resolverEncontroParaLog,
  serializeBatalhaLogEntry,
} from "../services/batalhaLog.js";
import { TIPOS_LOG_BATALHA_MESTRE } from "../schemas/apiSchemas.js";

export const batalhaLogController = {
  // GET /campanhas/:campanhaId/batalha/log?encontroId=&limit=
  // Qualquer membro ativo da mesa lê o log; visitantes de fora recebem 403.
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      const { encontroId, limit = "200" } = req.query;
      const safeLimit = Math.min(500, Math.max(1, parseInt(limit, 10) || 200));

      let permittedCampaignIds;
      let access = null;
      if (campanhaId && campanhaId !== "ativa") {
        access = await requireCampaignAccess(req, res, campanhaId);
        if (!access) return;
        permittedCampaignIds = [campanhaId];
      } else {
        permittedCampaignIds = await resolverCampanhasPermitidas(Campaign, CampaignMember, req.user, campanhaId);
        if (!permittedCampaignIds.length) {
          return res.status(403).json({ error: "Você não participa de nenhuma campanha." });
        }
      }

      const encontro = await resolverEncontroParaLog(Encounter, permittedCampaignIds, encontroId || null);
      if (!encontro) {
        return res.json({ encontro: null, entradas: [] });
      }

      if (!access || access.campanha?.id !== encontro.campanhaId) {
        access = await getCampaignAccess(req.user, encontro.campanhaId);
        if (!access.permitido) {
          return res.status(403).json({ error: "Você não tem acesso a esta campanha." });
        }
      }

      const rows = await LogBatalha.findAll({
        where: { encontroId: encontro.id },
        order: [["created_at", "DESC"]],
        limit: safeLimit,
      });
      rows.reverse();

      return res.json({
        encontro: {
          id: encontro.id,
          nome: encontro.nome,
          tipo: encontro.tipo,
          ativo: encontro.ativo,
          rodadaAtual: Number(encontro.dadosExtras?.combatRound) || 1,
        },
        entradas: rows.map(serializeBatalhaLogEntry),
      });
    } catch (error) {
      console.error("Erro ao listar log de batalha:", error);
      return res.status(500).json({ error: "Erro ao listar o log de batalha." });
    }
  },

  // POST /campanhas/:campanhaId/batalha/log
  // Qualquer membro ativo registra uma ação própria no encontro ativo.
  // Tipos reservados ao mestre (turno/encontro/recursos) exigem posse da mesa.
  async registrar(req, res) {
    try {
      const { campanhaId } = req.params;
      const { tipo, mensagem, dados, encontroId } = req.body;

      let permittedCampaignIds;
      let access = null;
      if (campanhaId && campanhaId !== "ativa") {
        access = await requireCampaignAccess(req, res, campanhaId);
        if (!access) return;
        permittedCampaignIds = [campanhaId];
      } else {
        permittedCampaignIds = await resolverCampanhasPermitidas(Campaign, CampaignMember, req.user, campanhaId);
        if (!permittedCampaignIds.length) {
          return res.status(403).json({ error: "Você não participa de nenhuma campanha." });
        }
      }

      const encontro = await resolverEncontroParaLog(Encounter, permittedCampaignIds, encontroId || null);
      if (!encontro) {
        return res.status(404).json({ error: "Nenhum encontro ativo. O mestre precisa iniciar o combate na Sala de Guerra." });
      }

      if (!access || access.campanha?.id !== encontro.campanhaId) {
        access = await getCampaignAccess(req.user, encontro.campanhaId);
        if (!access.permitido) {
          return res.status(403).json({ error: "Você não tem acesso a esta campanha." });
        }
      }

      const papel = access.isOwner ? "mestre" : "jogador";
      if (!access.isOwner && TIPOS_LOG_BATALHA_MESTRE.includes(tipo)) {
        return res.status(403).json({ error: "Apenas o mestre da mesa pode registrar este tipo de evento." });
      }

      const entry = await registrarEventoBatalha({
        encontro,
        usuarioId: req.user.id,
        autor: req.user.username,
        papel,
        tipo,
        mensagem,
        dados,
      });

      if (!entry) {
        return res.status(500).json({ error: "Erro ao registrar o evento no log de batalha." });
      }
      return res.status(201).json(serializeBatalhaLogEntry(entry));
    } catch (error) {
      console.error("Erro ao registrar evento no log de batalha:", error);
      return res.status(500).json({ error: "Erro ao registrar o evento no log de batalha." });
    }
  },
};
