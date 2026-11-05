import { CampaignResource, Campaign, registrarAuditoria } from "../models/index.js";
import { requireCampaignAccess } from "../services/campaignAccess.js";

export const recursoMapaController = {
  // Listar mapas com controle estrito de visibilidade e áreas ocultas para jogadores
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      const access = await requireCampaignAccess(req, res, campanhaId);
      if (!access) return;
      const isMestre = access.isOwner;

      const mapas = await CampaignResource.findAll({
        where: { campanhaId, tipo: "mapa" },
        order: [["created_at", "DESC"]],
      });

      if (isMestre) {
        return res.json(mapas);
      }

      // Se for jogador, retorna apenas mapas públicos e remove marcadores ocultos
      const mapasVisiveis = mapas
        .filter((m) => m.publica)
        .map((mapa) => {
          const raw = mapa.toJSON();
          const markers = Array.isArray(raw.metadados?.markers)
            ? raw.metadados.markers.filter((marker) => !marker.hidden)
            : [];
          return {
            ...raw,
            metadados: {
              ...(raw.metadados || {}),
              markers,
            },
          };
        });

      return res.json(mapasVisiveis);
    } catch (error) {
      console.error("Erro ao listar mapas:", error);
      return res.status(500).json({ error: "Erro ao listar mapas." });
    }
  },

  // Criar novo mapa tático
  async criar(req, res) {
    try {
      const { campanhaId } = req.params;
      if (!(await requireCampaignAccess(req, res, campanhaId, { ownerOnly: true }))) return;
      const { titulo, descricao, url, publica, metadados } = req.body;

      if (!titulo || !titulo.trim()) {
        return res.status(400).json({ error: "O título do mapa é obrigatório." });
      }

      if (!url || !url.trim()) {
        return res.status(400).json({ error: "A URL ou imagem do mapa é obrigatória." });
      }

      const dadosMetadados = {
        markers: [],
        fogOfWar: [],
        grid: { enabled: true, size: 50 },
        ...(metadados || {}),
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      const mapa = await CampaignResource.create({
        campanhaId,
        criadoPorId: req.user.id,
        tipo: "mapa",
        titulo: titulo.trim(),
        descricao: descricao || "",
        url: url.trim(),
        publica: Boolean(publica),
        metadados: dadosMetadados,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId,
        acao: "CRIAR_MAPA",
        entidade: "recursos_campanha",
        entidadeId: mapa.id,
        dados: { titulo: mapa.titulo, publica: mapa.publica },
        ip: req.ip,
      });

      return res.status(201).json(mapa);
    } catch (error) {
      console.error("Erro ao criar mapa:", error);
      return res.status(500).json({ error: "Erro ao criar mapa." });
    }
  },

  // Obter detalhes do mapa por ID
  async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const mapa = await CampaignResource.findByPk(id);
      if (!mapa) return res.status(404).json({ error: "Mapa não encontrado." });

      const campanha = await Campaign.findByPk(mapa.campanhaId);
      const access = await requireCampaignAccess(req, res, mapa.campanhaId);
      if (!access) return;
      const isMestre = access.isOwner;

      if (!isMestre && !mapa.publica) {
        return res.status(403).json({ error: "Este mapa ainda não foi revelado pelo mestre." });
      }

      if (isMestre) return res.json(mapa);

      const raw = mapa.toJSON();
      const markers = Array.isArray(raw.metadados?.markers)
        ? raw.metadados.markers.filter((m) => !m.hidden)
        : [];

      return res.json({
        ...raw,
        metadados: {
          ...(raw.metadados || {}),
          markers,
        },
      });
    } catch (error) {
      console.error("Erro ao obter mapa:", error);
      return res.status(500).json({ error: "Erro ao obter mapa." });
    }
  },

  // Atualizar mapa (marcadores, névoa de guerra e visibilidade pública)
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const mapa = await CampaignResource.findByPk(id);
      if (!mapa) return res.status(404).json({ error: "Mapa não encontrado." });
      if (!(await requireCampaignAccess(req, res, mapa.campanhaId, { ownerOnly: true }))) return;

      const { titulo, descricao, url, publica, metadados } = req.body;

      const mergedMetadados = {
        ...(mapa.metadados || {}),
        ...(metadados || {}),
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      await mapa.update({
        titulo: titulo !== undefined ? titulo.trim() : mapa.titulo,
        descricao: descricao !== undefined ? descricao : mapa.descricao,
        url: url !== undefined ? url.trim() : mapa.url,
        publica: publica !== undefined ? Boolean(publica) : mapa.publica,
        metadados: mergedMetadados,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: mapa.campanhaId,
        acao: "ATUALIZAR_MAPA",
        entidade: "recursos_campanha",
        entidadeId: mapa.id,
        dados: { titulo: mapa.titulo, publica: mapa.publica },
        ip: req.ip,
      });

      return res.json(mapa);
    } catch (error) {
      console.error("Erro ao atualizar mapa:", error);
      return res.status(500).json({ error: "Erro ao atualizar mapa." });
    }
  },

  // Excluir mapa
  async remover(req, res) {
    try {
      const { id } = req.params;
      const mapa = await CampaignResource.findByPk(id);
      if (!mapa) return res.status(404).json({ error: "Mapa não encontrado." });
      if (!(await requireCampaignAccess(req, res, mapa.campanhaId, { ownerOnly: true }))) return;

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: mapa.campanhaId,
        acao: "EXCLUIR_MAPA",
        entidade: "recursos_campanha",
        entidadeId: mapa.id,
        dados: { titulo: mapa.titulo },
        ip: req.ip,
      });

      await mapa.destroy();
      return res.json({ success: true, message: "Mapa excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir mapa:", error);
      return res.status(500).json({ error: "Erro ao excluir mapa." });
    }
  },
};
