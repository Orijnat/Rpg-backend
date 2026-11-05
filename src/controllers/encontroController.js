import { Encounter, Campaign, CampaignMember, registrarAuditoria } from "../models/index.js";
import { requireCampaignAccess } from "../services/campaignAccess.js";

export const encontroController = {
  // Listar encontros da campanha
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      if (!(await requireCampaignAccess(req, res, campanhaId))) return;
      const encontros = await Encounter.findAll({
        where: { campanhaId },
        order: [["created_at", "DESC"]],
      });
      return res.json(encontros);
    } catch (error) {
      console.error("Erro ao listar encontros:", error);
      return res.status(500).json({ error: "Erro ao listar encontros." });
    }
  },

  // Criar novo encontro tático
  async criar(req, res) {
    try {
      const { campanhaId } = req.params;
      if (!(await requireCampaignAccess(req, res, campanhaId, { ownerOnly: true }))) return;
      const { nome, tipo, inimigos, recursos, ativo, dadosExtras } = req.body;

      if (!nome || !nome.trim()) {
        return res.status(400).json({ error: "O nome do encontro é obrigatório." });
      }

      const initialLog = [
        {
          timestamp: new Date().toISOString(),
          autor: req.user.username,
          evento: `Encontro "${nome.trim()}" criado.`,
        },
      ];

      const encontro = await Encounter.create({
        campanhaId,
        criadoPorId: req.user.id,
        nome: nome.trim(),
        tipo: tipo || "combate",
        ativo: Boolean(ativo),
        dadosExtras: {
          ...(dadosExtras || {}),
          combatRound: 1,
          activeTurnIndex: 0,
          iniciativa: [],
          inimigos: Array.isArray(inimigos) ? inimigos : [],
          recursos: recursos || { xp: 0, tesouro: "" },
          logHistorico: initialLog,
          lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
          lastModifiedAt: new Date().toISOString(),
        },
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId,
        acao: "CRIAR_ENCONTRO",
        entidade: "encontros",
        entidadeId: encontro.id,
        dados: { nome: encontro.nome, tipo: encontro.tipo },
        ip: req.ip,
      });

      return res.status(201).json(encontro);
    } catch (error) {
      console.error("Erro ao criar encontro:", error);
      return res.status(500).json({ error: "Erro ao criar encontro." });
    }
  },

  // Obter detalhes do encontro
  async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const encontro = await Encounter.findByPk(id);
      if (!encontro) return res.status(404).json({ error: "Encontro não encontrado." });
      if (!(await requireCampaignAccess(req, res, encontro.campanhaId))) return;
      return res.json(encontro);
    } catch (error) {
      console.error("Erro ao obter encontro:", error);
      return res.status(500).json({ error: "Erro ao obter encontro." });
    }
  },

  // Atualizar encontro (rodadas, ordem de iniciativa, PV, condições e histórico de alterações)
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const encontro = await Encounter.findByPk(id);
      if (!encontro) return res.status(404).json({ error: "Encontro não encontrado." });
      if (!(await requireCampaignAccess(req, res, encontro.campanhaId, { ownerOnly: true }))) return;

      const { nome, tipo, ativo, dadosExtras, novoEventoLog } = req.body;

      const logExistente = Array.isArray(encontro.dadosExtras?.logHistorico)
        ? encontro.dadosExtras.logHistorico
        : [];

      const logAtualizado = [...logExistente];
      if (novoEventoLog) {
        logAtualizado.push({
          timestamp: new Date().toISOString(),
          autor: req.user.username,
          evento: novoEventoLog,
        });
      }

      const mergedExtras = {
        ...(encontro.dadosExtras || {}),
        ...(dadosExtras || {}),
        logHistorico: logAtualizado.slice(-100), // Mantém até 100 eventos no histórico
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      await encontro.update({
        nome: nome !== undefined ? nome.trim() : encontro.nome,
        tipo: tipo !== undefined ? tipo : encontro.tipo,
        ativo: ativo !== undefined ? Boolean(ativo) : encontro.ativo,
        dadosExtras: mergedExtras,
      });

      return res.json(encontro);
    } catch (error) {
      console.error("Erro ao atualizar encontro:", error);
      return res.status(500).json({ error: "Erro ao atualizar encontro." });
    }
  },

  // Sincronização direta de iniciativa disparada pela ficha do jogador
  async receberIniciativaFicha(req, res) {
    try {
      const { campanhaId } = req.params;
      const { characterId, name, initiative, hp, hpMax } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Dados da ficha insuficientes para sincronizar iniciativa." });
      }

      let permittedCampaignIds;
      if (campanhaId && campanhaId !== "ativa") {
        if (!(await requireCampaignAccess(req, res, campanhaId))) return;
        permittedCampaignIds = [campanhaId];
      } else {
        const owned = await Campaign.findAll({
          where: { proprietarioId: req.user.id }, attributes: ["id"],
        });
        const memberships = await CampaignMember.findAll({
          where: { usuarioId: req.user.id, bloqueado: false }, attributes: ["campanhaId"],
        });
        permittedCampaignIds = [...new Set([
          ...owned.map((item) => item.id),
          ...memberships.map((item) => item.campanhaId),
        ])];
        if (!permittedCampaignIds.length) {
          return res.status(403).json({ error: "Você não participa de nenhuma campanha." });
        }
      }
      const searchWhere = { campanhaId: permittedCampaignIds };

      // Procura o encontro ativo da campanha ou o mais recente
      let encontro = await Encounter.findOne({
        where: { ...searchWhere, ativo: true },
        order: [["updated_at", "DESC"]],
      });

      if (!encontro) {
        encontro = await Encounter.findOne({
          where: searchWhere,
          order: [["updated_at", "DESC"]],
        });
      }

      // Se não existir encontro, busca campanha válida ou cria um encontro
      let targetCampanhaId = campanhaId && campanhaId !== "ativa" ? campanhaId : null;
      if (!targetCampanhaId) {
        const anyCamp = await Campaign.findOne({
          where: { id: permittedCampaignIds },
          order: [["updated_at", "DESC"]],
        });
        targetCampanhaId = anyCamp?.id || null;
      }

      if (!encontro && targetCampanhaId) {
        encontro = await Encounter.create({
          campanhaId: targetCampanhaId,
          criadoPorId: req.user.id,
          nome: "Combate Tático",
          tipo: "combate",
          ativo: true,
          dadosExtras: {
            combatRound: 1,
            activeTurnIndex: 0,
            iniciativa: [],
            logHistorico: [],
          },
        });
      }

      if (!encontro) {
        return res.status(404).json({ error: "Nenhum encontro ou campanha ativa encontrada para sincronizar iniciativa." });
      }

      const iniciativaList = Array.isArray(encontro.dadosExtras?.iniciativa)
        ? [...encontro.dadosExtras.iniciativa]
        : [];

      const combatantId = `pc-${characterId || req.user.id}`;
      const existingIndex = iniciativaList.findIndex((item) => item.id === combatantId);

      const combatantData = {
        id: combatantId,
        name: name.trim(),
        type: "Herói",
        initiative: Number(initiative) || 0,
        hp: Number(hp) || 10,
        hpMax: Number(hpMax) || Number(hp) || 10,
        conditions: existingIndex >= 0 ? iniciativaList[existingIndex].conditions || [] : [],
      };

      if (existingIndex >= 0) {
        iniciativaList[existingIndex] = { ...iniciativaList[existingIndex], ...combatantData };
      } else {
        iniciativaList.push(combatantData);
      }

      // Reordena combatentes por iniciativa decrescente
      iniciativaList.sort((a, b) => Number(b.initiative) - Number(a.initiative));

      const logExistente = Array.isArray(encontro.dadosExtras?.logHistorico)
        ? encontro.dadosExtras.logHistorico
        : [];

      logExistente.push({
        timestamp: new Date().toISOString(),
        autor: req.user.username,
        evento: `${name} enviou iniciativa ${combatantData.initiative} diretamente da ficha.`,
      });

      await encontro.update({
        dadosExtras: {
          ...(encontro.dadosExtras || {}),
          iniciativa: iniciativaList,
          logHistorico: logExistente.slice(-100),
          lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
          lastModifiedAt: new Date().toISOString(),
        },
      });

      return res.json({
        success: true,
        message: `Iniciativa de ${name} (${combatantData.initiative}) atualizada no encontro!`,
        encontro,
      });
    } catch (error) {
      console.error("Erro ao sincronizar iniciativa da ficha:", error);
      return res.status(500).json({ error: "Erro ao sincronizar iniciativa da ficha." });
    }
  },

  // Excluir encontro
  async remover(req, res) {
    try {
      const { id } = req.params;
      const encontro = await Encounter.findByPk(id);
      if (!encontro) return res.status(404).json({ error: "Encontro não encontrado." });
      if (!(await requireCampaignAccess(req, res, encontro.campanhaId, { ownerOnly: true }))) return;

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: encontro.campanhaId,
        acao: "EXCLUIR_ENCONTRO",
        entidade: "encontros",
        entidadeId: encontro.id,
        dados: { nome: encontro.nome },
        ip: req.ip,
      });

      await encontro.destroy();
      return res.json({ success: true, message: "Encontro excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir encontro:", error);
      return res.status(500).json({ error: "Erro ao excluir encontro." });
    }
  },
};
