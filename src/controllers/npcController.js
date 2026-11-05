import { Op } from "sequelize";
import { NPC, Campaign, CampaignMember, registrarAuditoria } from "../models/index.js";

async function podeGerenciarCampanha(user, campanhaId) {
  if (!campanhaId) return user?.perfil === "mestre" || user?.role === "master";
  const campanha = await Campaign.findByPk(campanhaId);
  return Boolean(campanha && campanha.proprietarioId === user.id &&
    (user.perfil === "mestre" || user.role === "master"));
}

async function podeLerCampanha(user, campanhaId) {
  if (!campanhaId) return user?.perfil === "mestre" || user?.role === "master";
  const campanha = await Campaign.findByPk(campanhaId);
  if (!campanha) return false;
  if (campanha.proprietarioId === user.id) return true;
  const membro = await CampaignMember.findOne({
    where: { campanhaId, usuarioId: user.id, bloqueado: false },
  });
  return Boolean(membro);
}

export const npcController = {
  // Listar NPCs com busca, filtros de tags, status, atitude e ordenação
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      const { q, tag, status, attitude, sort } = req.query;

      const where = {};
      if (campanhaId && campanhaId !== "todas") {
        if (!(await podeLerCampanha(req.user, campanhaId))) {
          return res.status(403).json({ error: "Acesso restrito aos membros desta campanha." });
        }
        where.campanhaId = campanhaId;
      } else {
        const campanhas = await Campaign.findAll({
          where: { proprietarioId: req.user.id },
          attributes: ["id"],
        });
        where[Op.or] = [
          { criadoPorId: req.user.id },
          { campanhaId: campanhas.map((campanha) => campanha.id) },
        ];
      }

      if (q && q.trim()) {
        const queryTerm = `%${q.trim()}%`;
        where[Op.or] = [
          { nome: { [Op.iLike]: queryTerm } },
          { papel: { [Op.iLike]: queryTerm } },
          { descricao: { [Op.iLike]: queryTerm } },
        ];
      }

      let order = [["updated_at", "DESC"]];
      if (sort === "nome_asc") order = [["nome", "ASC"]];
      if (sort === "nome_desc") order = [["nome", "DESC"]];
      if (sort === "hp_desc") order = [["pontos_vida", "DESC"]];
      if (sort === "hp_asc") order = [["pontos_vida", "ASC"]];

      let npcs = await NPC.findAll({
        where,
        order,
      });

      // Filtros em memória para JSONB (tags, status, atitude)
      if (tag) {
        npcs = npcs.filter((n) => {
          const tags = n.dadosExtras?.tags || [];
          return Array.isArray(tags) && tags.some((t) => t.toLowerCase() === tag.toLowerCase());
        });
      }

      if (status) {
        npcs = npcs.filter((n) => {
          const st = n.dadosExtras?.status || "Ativo";
          return st.toLowerCase() === status.toLowerCase();
        });
      }

      if (attitude) {
        npcs = npcs.filter((n) => {
          const att = n.dadosExtras?.attitude || "Neutro";
          return att.toLowerCase() === attitude.toLowerCase();
        });
      }

      return res.json(npcs);
    } catch (error) {
      console.error("Erro ao listar NPCs:", error);
      return res.status(500).json({ error: "Erro ao listar NPCs." });
    }
  },

  // Criar NPC com formulário e campos específicos do mestre
  async criar(req, res) {
    try {
      const { campanhaId } = req.params;
      const {
        nome,
        papel,
        descricao,
        hp,
        hpMax,
        ca,
        iniciativa,
        avatar,
        tags,
        status,
        attitude,
        acoes,
        notasMestre,
      } = req.body;

      if (!nome || !nome.trim()) {
        return res.status(400).json({ error: "O nome do NPC é obrigatório." });
      }
      if (!(await podeGerenciarCampanha(req.user, campanhaId || req.body.campanhaId))) {
        return res.status(403).json({ error: "Apenas o mestre proprietário da campanha pode gerenciar NPCs." });
      }

      const dadosExtras = {
        ca: Number(ca) || 10,
        iniciativa: Number(iniciativa) || 0,
        avatar: avatar || "",
        tags: Array.isArray(tags) ? tags : [],
        status: status || "Ativo",
        attitude: attitude || "Hostil",
        acoes: Array.isArray(acoes) ? acoes : [],
        notasMestre: notasMestre || "",
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      const finalHp = Math.max(0, Number(hp ?? hpMax ?? 10));
      const finalHpMax = Math.max(1, Number(hpMax ?? hp ?? 10));

      const npc = await NPC.create({
        campanhaId: campanhaId || req.body.campanhaId || null,
        criadoPorId: req.user.id,
        nome: nome.trim(),
        papel: papel || "Inimigo",
        descricao: descricao || "",
        hp: Math.min(finalHp, finalHpMax),
        hpMax: finalHpMax,
        dadosExtras,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: npc.campanhaId,
        acao: "CRIAR_NPC",
        entidade: "npcs",
        entidadeId: npc.id,
        dados: { nome: npc.nome, papel: npc.papel },
        ip: req.ip,
      });

      return res.status(201).json(npc);
    } catch (error) {
      console.error("Erro ao criar NPC:", error);
      return res.status(500).json({ error: "Erro ao criar NPC." });
    }
  },

  // Obter detalhes do NPC
  async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const npc = await NPC.findByPk(id);
      if (!npc) return res.status(404).json({ error: "NPC não encontrado." });
      if (!(await podeLerCampanha(req.user, npc.campanhaId)) ||
          !(await podeGerenciarCampanha(req.user, npc.campanhaId))) {
        return res.status(403).json({ error: "Você não pode acessar este NPC." });
      }
      return res.json(npc);
    } catch (error) {
      console.error("Erro ao obter NPC:", error);
      return res.status(500).json({ error: "Erro ao obter NPC." });
    }
  },

  // Atualizar NPC existente
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const npc = await NPC.findByPk(id);
      if (!npc) return res.status(404).json({ error: "NPC não encontrado." });
      if (!(await podeGerenciarCampanha(req.user, npc.campanhaId))) {
        return res.status(403).json({ error: "Apenas o mestre proprietário pode alterar este NPC." });
      }

      const {
        nome,
        papel,
        descricao,
        hp,
        hpMax,
        ca,
        iniciativa,
        avatar,
        tags,
        status,
        attitude,
        acoes,
        notasMestre,
      } = req.body;

      const dadosExtras = {
        ...(npc.dadosExtras || {}),
        ...(ca !== undefined ? { ca: Number(ca) } : {}),
        ...(iniciativa !== undefined ? { iniciativa: Number(iniciativa) } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
        ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags : [] } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(attitude !== undefined ? { attitude } : {}),
        ...(acoes !== undefined ? { acoes: Array.isArray(acoes) ? acoes : [] } : {}),
        ...(notasMestre !== undefined ? { notasMestre } : {}),
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      const newHpMax = hpMax !== undefined ? Math.max(1, Number(hpMax)) : npc.hpMax;
      const newHp = hp !== undefined ? Math.max(0, Math.min(newHpMax, Number(hp))) : npc.hp;

      await npc.update({
        nome: nome !== undefined ? nome.trim() : npc.nome,
        papel: papel !== undefined ? papel : npc.papel,
        descricao: descricao !== undefined ? descricao : npc.descricao,
        hp: newHp,
        hpMax: newHpMax,
        dadosExtras,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: npc.campanhaId,
        acao: "ATUALIZAR_NPC",
        entidade: "npcs",
        entidadeId: npc.id,
        dados: { alteracoes: req.body },
        ip: req.ip,
      });

      return res.json(npc);
    } catch (error) {
      console.error("Erro ao atualizar NPC:", error);
      return res.status(500).json({ error: "Erro ao atualizar NPC." });
    }
  },

  // Duplicar NPC e gerar variante com ajustes automáticos
  async duplicar(req, res) {
    try {
      const { id } = req.params;
      const { variantSuffix = " (Cópia)", hpMultiplier = 1, addTags = [] } = req.body;

      const original = await NPC.findByPk(id);
      if (!original) return res.status(404).json({ error: "NPC original não encontrado." });
      if (!(await podeGerenciarCampanha(req.user, original.campanhaId))) {
        return res.status(403).json({ error: "Apenas o mestre proprietário pode duplicar este NPC." });
      }

      const newHpMax = Math.round(original.hpMax * Number(hpMultiplier || 1));
      const existingTags = Array.isArray(original.dadosExtras?.tags) ? original.dadosExtras.tags : [];
      const updatedTags = Array.from(new Set([...existingTags, ...(Array.isArray(addTags) ? addTags : [])]));

      const novoNpc = await NPC.create({
        campanhaId: original.campanhaId,
        criadoPorId: req.user.id,
        nome: `${original.nome}${variantSuffix}`.trim(),
        papel: original.papel,
        descricao: original.descricao,
        hp: newHpMax,
        hpMax: newHpMax,
        dadosExtras: {
          ...(original.dadosExtras || {}),
          tags: updatedTags,
          lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
          lastModifiedAt: new Date().toISOString(),
          duplicadoDe: original.id,
        },
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: novoNpc.campanhaId,
        acao: "DUPLICAR_NPC",
        entidade: "npcs",
        entidadeId: novoNpc.id,
        dados: { de: original.nome, para: novoNpc.nome },
        ip: req.ip,
      });

      return res.status(201).json(novoNpc);
    } catch (error) {
      console.error("Erro ao duplicar NPC:", error);
      return res.status(500).json({ error: "Erro ao duplicar NPC." });
    }
  },

  // Excluir NPC com registro em auditoria
  async remover(req, res) {
    try {
      const { id } = req.params;
      const npc = await NPC.findByPk(id);
      if (!npc) return res.status(404).json({ error: "NPC não encontrado." });
      if (!(await podeGerenciarCampanha(req.user, npc.campanhaId))) {
        return res.status(403).json({ error: "Apenas o mestre proprietário pode excluir este NPC." });
      }

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: npc.campanhaId,
        acao: "EXCLUIR_NPC",
        entidade: "npcs",
        entidadeId: npc.id,
        dados: { nome: npc.nome },
        ip: req.ip,
      });

      await npc.destroy();
      return res.json({ success: true, message: "NPC excluído com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir NPC:", error);
      return res.status(500).json({ error: "Erro ao excluir NPC." });
    }
  },
};
