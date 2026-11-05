import { Session, Campaign, registrarAuditoria } from "../models/index.js";
import { requireCampaignAccess } from "../services/campaignAccess.js";

export const sessaoController = {
  // Listar sessões da campanha com ordenação por número
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      const { estado } = req.query;
      if (!(await requireCampaignAccess(req, res, campanhaId))) return;

      const where = { campanhaId };
      if (estado) where.estado = estado;

      const sessoes = await Session.findAll({
        where,
        order: [["numero", "ASC"]],
      });
      return res.json(sessoes);
    } catch (error) {
      console.error("Erro ao listar sessões:", error);
      return res.status(500).json({ error: "Erro ao listar sessões." });
    }
  },

  // Criar nova sessão com cenas, objetivos e recompensas
  async criar(req, res) {
    try {
      const { campanhaId } = req.params;
      if (!(await requireCampaignAccess(req, res, campanhaId, { ownerOnly: true }))) return;
      const { titulo, numero, estado, dataAgendada, resumo, cenas, objetivos, recompensas, dadosExtras } = req.body;

      if (!titulo || !titulo.trim()) {
        return res.status(400).json({ error: "O título da sessão é obrigatório." });
      }

      // Auto-numerar se não informado
      let numeroFinal = numero;
      if (!numeroFinal) {
        const ultima = await Session.findOne({
          where: { campanhaId },
          order: [["numero", "DESC"]],
        });
        numeroFinal = (ultima?.numero || 0) + 1;
      }

      const registroInicial = [
        {
          timestamp: new Date().toISOString(),
          autor: req.user.username,
          evento: `Sessão "${titulo.trim()}" criada.`,
        },
      ];

      const sessao = await Session.create({
        campanhaId,
        criadoPorId: req.user.id,
        titulo: titulo.trim(),
        numero: numeroFinal,
        estado: estado || "planejada",
        dataAgendada: dataAgendada || null,
        resumo: resumo || "",
        dadosExtras: {
          ...(dadosExtras || {}),
          cenas: Array.isArray(cenas)
            ? cenas.map((c, i) => ({
                titulo: c.titulo || `Cena ${i + 1}`,
                descricao: c.descricao || "",
                ordem: c.ordem ?? i + 1,
                concluida: Boolean(c.concluida),
              }))
            : [],
          objetivos: Array.isArray(objetivos)
            ? objetivos.map((o) => ({
                descricao: o.descricao || "",
                concluido: Boolean(o.concluido),
                tipo: o.tipo || "principal",
              }))
            : [],
          recompensas: recompensas || { xp: 0, itens: [], moedas: {}, descricao: "" },
          registro: registroInicial,
          lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
          lastModifiedAt: new Date().toISOString(),
        },
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId,
        acao: "CRIAR_SESSAO",
        entidade: "sessoes",
        entidadeId: sessao.id,
        dados: { titulo: sessao.titulo, numero: sessao.numero },
        ip: req.ip,
      });

      return res.status(201).json(sessao);
    } catch (error) {
      console.error("Erro ao criar sessão:", error);
      return res.status(500).json({ error: "Erro ao criar sessão." });
    }
  },

  // Obter detalhes de uma sessão
  async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const sessao = await Session.findByPk(id);
      if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });
      if (!(await requireCampaignAccess(req, res, sessao.campanhaId))) return;
      return res.json(sessao);
    } catch (error) {
      console.error("Erro ao obter sessão:", error);
      return res.status(500).json({ error: "Erro ao obter sessão." });
    }
  },

  // Atualizar sessão (cenas, objetivos, recompensas, estado e registro)
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const sessao = await Session.findByPk(id);
      if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });
      if (!(await requireCampaignAccess(req, res, sessao.campanhaId, { ownerOnly: true }))) return;

      const { titulo, numero, estado, dataAgendada, resumo, cenas, objetivos, recompensas, novoEvento, dadosExtras } = req.body;

      const registroExistente = Array.isArray(sessao.dadosExtras?.registro)
        ? sessao.dadosExtras.registro
        : [];

      const registroAtualizado = [...registroExistente];
      if (novoEvento) {
        registroAtualizado.push({
          timestamp: new Date().toISOString(),
          autor: req.user.username,
          evento: novoEvento,
        });
      }

      // Se o estado mudou, registra automaticamente
      if (estado && estado !== sessao.estado) {
        registroAtualizado.push({
          timestamp: new Date().toISOString(),
          autor: req.user.username,
          evento: `Estado alterado de "${sessao.estado}" para "${estado}".`,
        });
      }

      const mergedExtras = {
        ...(sessao.dadosExtras || {}),
        ...(dadosExtras || {}),
        ...(cenas !== undefined
          ? {
              cenas: Array.isArray(cenas)
                ? cenas.map((c, i) => ({
                    titulo: c.titulo || `Cena ${i + 1}`,
                    descricao: c.descricao || "",
                    ordem: c.ordem ?? i + 1,
                    concluida: Boolean(c.concluida),
                  }))
                : sessao.dadosExtras?.cenas || [],
            }
          : {}),
        ...(objetivos !== undefined
          ? {
              objetivos: Array.isArray(objetivos)
                ? objetivos.map((o) => ({
                    descricao: o.descricao || "",
                    concluido: Boolean(o.concluido),
                    tipo: o.tipo || "principal",
                  }))
                : sessao.dadosExtras?.objetivos || [],
            }
          : {}),
        ...(recompensas !== undefined ? { recompensas } : {}),
        registro: registroAtualizado.slice(-100),
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      await sessao.update({
        titulo: titulo !== undefined ? titulo.trim() : sessao.titulo,
        numero: numero !== undefined ? numero : sessao.numero,
        estado: estado !== undefined ? estado : sessao.estado,
        dataAgendada: dataAgendada !== undefined ? dataAgendada : sessao.dataAgendada,
        resumo: resumo !== undefined ? resumo : sessao.resumo,
        dadosExtras: mergedExtras,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: sessao.campanhaId,
        acao: "ATUALIZAR_SESSAO",
        entidade: "sessoes",
        entidadeId: sessao.id,
        dados: { titulo: sessao.titulo, estado: sessao.estado, alteracoes: req.body },
        ip: req.ip,
      });

      return res.json(sessao);
    } catch (error) {
      console.error("Erro ao atualizar sessão:", error);
      return res.status(500).json({ error: "Erro ao atualizar sessão." });
    }
  },

  // Excluir sessão (exige confirmação)
  async remover(req, res) {
    try {
      const { id } = req.params;
      const { confirmacao } = req.body;

      if (!confirmacao) {
        return res.status(400).json({
          error: "Exclusão requer confirmação.",
          mensagem: "Envie { \"confirmacao\": true } no corpo da requisição para confirmar a exclusão.",
        });
      }

      const sessao = await Session.findByPk(id);
      if (!sessao) return res.status(404).json({ error: "Sessão não encontrada." });
      if (!(await requireCampaignAccess(req, res, sessao.campanhaId, { ownerOnly: true }))) return;

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: sessao.campanhaId,
        acao: "EXCLUIR_SESSAO",
        entidade: "sessoes",
        entidadeId: sessao.id,
        dados: { titulo: sessao.titulo, numero: sessao.numero },
        ip: req.ip,
      });

      await sessao.destroy();
      return res.json({ success: true, message: "Sessão excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir sessão:", error);
      return res.status(500).json({ error: "Erro ao excluir sessão." });
    }
  },
};
