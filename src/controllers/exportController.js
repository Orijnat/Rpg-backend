import { Campaign, CampaignMember, Character, NPC, Encounter, AtributosPersonagem, User } from "../models/index.js";
import { getCampaignAccess } from "../services/campaignAccess.js";
import { publicCharacter } from "../services/characterPublic.js";
import { toCsv, characterToSheetRows, npcToSheetRows, campaignToSheetRows } from "../services/csvExport.js";

const BOM = "﻿"; // Excel/Sheets PT-BR: abre com acentos corretos

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, max-age=60");
  res.send(BOM + csv);
}

function slug(value) {
  return String(value || "grimorium").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "grimorium";
}

export const exportController = {
  // Ficha de personagem → CSV (dono da ficha ou mestre dono da mesa)
  async characterCsv(req, res) {
    try {
      const character = await Character.findByPk(req.params.id, { include: [{ model: AtributosPersonagem, as: "atributos", required: false }] });
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const isOwner = character.userId === req.user.id;
      let isTableMaster = false;
      if (character.campanhaId) {
        const access = await getCampaignAccess(req.user, character.campanhaId);
        isTableMaster = access.isOwner;
      }
      if (!isOwner && !isTableMaster) {
        return res.status(403).json({ error: "Você só exporta a própria ficha ou fichas da sua mesa." });
      }
      const csv = toCsv(characterToSheetRows(publicCharacter(character)));
      return sendCsv(res, `ficha-${slug(character.name)}.csv`, csv);
    } catch (error) {
      console.error("Erro ao exportar ficha:", error);
      return res.status(500).json({ error: "Erro ao exportar a ficha." });
    }
  },

  // NPCs da mesa → CSV (apenas mestre dono; notas do mestre vão junto por design)
  async npcsCsv(req, res) {
    try {
      const { campanhaId } = req.query;
      if (!campanhaId) return res.status(400).json({ error: "Informe campanhaId." });
      const access = await getCampaignAccess(req.user, campanhaId);
      if (!access.permitido) return res.status(403).json({ error: "Você não participa desta mesa." });
      if (!access.isOwner) return res.status(403).json({ error: "Apenas o mestre dono exporta o bestiário." });
      const npcs = await NPC.findAll({ where: { campanhaId }, order: [["nome", "ASC"]] });
      const csv = toCsv(npcToSheetRows(npcs.map((n) => (n.toJSON ? n.toJSON() : n))));
      return sendCsv(res, `bestario-${String(campanhaId).slice(0, 8)}.csv`, csv);
    } catch (error) {
      console.error("Erro ao exportar NPCs:", error);
      return res.status(500).json({ error: "Erro ao exportar o bestiário." });
    }
  },

  // Resumo da campanha → CSV (apenas mestre dono)
  async campaignCsv(req, res) {
    try {
      const access = await getCampaignAccess(req.user, req.params.id);
      if (!access.permitido) return res.status(404).json({ error: "Campanha não encontrada." });
      if (!access.isOwner) return res.status(403).json({ error: "Apenas o mestre dono exporta o resumo da mesa." });
      const campanha = await Campaign.findByPk(req.params.id, { attributes: ["id", "nome", "cenario", "estado", "codigoConvite", "proprietarioId"] });
      const membros = await CampaignMember.findAll({ where: { campanhaId: campanha.id }, include: [{ model: User, as: "usuario", attributes: ["id", "username", "perfil"] }] });
      const personagens = await Character.findAll({ where: { campanhaId: campanha.id } });
      const [npcs, encontros] = await Promise.all([
        NPC.count({ where: { campanhaId: campanha.id } }),
        Encounter.count({ where: { campanhaId: campanha.id } }),
      ]);
      const csv = toCsv(campaignToSheetRows({
        campanha: campanha.toJSON ? campanha.toJSON() : campanha,
        membros: membros.map((m) => (m.toJSON ? m.toJSON() : m)),
        personagens: personagens.map((c) => (c.toJSON ? c.toJSON() : c)),
        contagens: { npcs, encontros },
      }));
      return sendCsv(res, `campanha-${slug(campanha.nome)}.csv`, csv);
    } catch (error) {
      console.error("Erro ao exportar campanha:", error);
      return res.status(500).json({ error: "Erro ao exportar a campanha." });
    }
  },
};
