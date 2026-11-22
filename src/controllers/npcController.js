import { Op } from "sequelize";
import crypto from "node:crypto";
import { NPC, Campaign, CampaignMember, registrarAuditoria, sequelize } from "../models/index.js";

async function podeGerenciarCampanha(user, campanhaId) {
  if (!campanhaId) return user?.perfil === "mestre" || user?.role === "master";
  const campanha = await Campaign.findByPk(campanhaId);
  return Boolean(campanha && campanha.proprietarioId === user.id &&
    (user.perfil === "mestre" || user.role === "master"));
}

const ATRIBUTOS_NPC = [
  ["FOR", "forca"], ["DES", "destreza"], ["CON", "constituicao"], ["SAB", "sabedoria"],
  ["ESP", "espirito"], ["CAR", "carisma"], ["INT", "inteligencia"],
];

// Atributos do NPC: clamp 1..30, espelho nas duas grafias (legado e curta) + attributes{}
function atributosParaExtras(input) {
  const base = input && typeof input === "object" ? input : {};
  const extras = {};
  const attributes = {};
  for (const [curto, longo] of ATRIBUTOS_NPC) {
    const raw = base[curto] ?? base[longo] ?? 10;
    const valor = Math.max(1, Math.min(30, Math.floor(Number(raw)) || 10));
    extras[curto] = valor;
    extras[longo] = valor;
    attributes[curto] = valor;
  }
  extras.attributes = attributes;
  return extras;
}

// Habilidades do NPC: mesmo esquema dos heróis (lib/abilities). Garante id/aprovação do mestre.
function abilitiesParaExtras(input) {
  if (!Array.isArray(input)) return [];
  const now = () => new Date().toISOString();
  return input.slice(0, 60).map((ability) => {
    const item = ability && typeof ability === "object" ? { ...ability } : {};
    if (!item.id || typeof item.id !== "string") item.id = crypto.randomUUID();
    if (!item.name) item.name = "Habilidade";
    item.type = typeof item.type === "string" ? item.type : "ativa";
    item.reqLevel = Math.max(1, Math.floor(Number(item.reqLevel) || 1));
    item.trainingHours = Math.max(0, Math.floor(Number(item.trainingHours) || 0));
    if (!item.approvalStatus) item.approvalStatus = "aprovada";
    if (!item.submittedBy) item.submittedBy = "mestre";
    if (!item.requestedAt) item.requestedAt = now();
    item.updatedAt = now();
    return item;
  });
}

const DADOS_MESTRE_KEYS = ["notasMestre", "secret", "segredo", "notas_mestre"];

// Remove notas privadas do mestre de NPCs visíveis a quem não é proprietário
function npcParaMembro(npc, user) {
  if (!npc) return npc;
  const isOwnerMaster = user?.perfil === "mestre" && (
    npc.criadoPorId === user.id || user?.isCampanhaOwner
  );
  const data = npc.toJSON ? npc.toJSON() : { ...npc };
  if (isOwnerMaster) return data;
  const extras = data.dadosExtras || {};
  for (const key of DADOS_MESTRE_KEYS) {
    if (extras[key] !== undefined) delete extras[key];
  }
  // O proprietário da campanha também enxerga tudo: filtramos só quando o usuário NÃO é dono da campanha.
  // Nota: a checagem fina por campanha é feita pelo chamador via podeLerCampanha/podeGerenciarCampanha.
  data.dadosExtras = extras;
  return data;
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
      const campanhaId = req.params.campanhaId || req.query.campanhaId || undefined;
      const { q, tag, status, attitude, sort } = req.query;

      const andClauses = [];
      if (campanhaId && campanhaId !== "todas") {
        if (!(await podeLerCampanha(req.user, campanhaId))) {
          return res.status(403).json({ error: "Acesso restrito aos membros desta campanha." });
        }
        andClauses.push({ campanhaId });
        const campanha = await Campaign.findByPk(campanhaId, { attributes: ["id", "proprietarioId"] });
        const isOwnerMaster = (req.user?.perfil === "mestre" || req.user?.role === "master") && campanha?.proprietarioId === req.user.id;
        if (!isOwnerMaster) {
          andClauses.push(sequelize.literal(`dados_extras @> '{"sharedWithPlayers": true}'::jsonb`));
        }
      } else {
        const campanhas = await Campaign.findAll({
          where: { proprietarioId: req.user.id },
          attributes: ["id"],
        });
        andClauses.push({
          [Op.or]: [
            { criadoPorId: req.user.id },
            { campanhaId: campanhas.map((campanha) => campanha.id) },
          ],
        });
      }

      if (q && q.trim()) {
        const queryTerm = `%${q.trim()}%`;
        andClauses.push({
          [Op.or]: [
            { nome: { [Op.iLike]: queryTerm } },
            { papel: { [Op.iLike]: queryTerm } },
            { descricao: { [Op.iLike]: queryTerm } },
          ],
        });
      }

      const where = andClauses.length > 1 ? { [Op.and]: andClauses } : (andClauses[0] || {});

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

      // Visitantes (não proprietários da campanha) não veem notas do mestre
      const isMestreOwner = req.user?.perfil === "mestre" || req.user?.role === "master";
      const visible = [];
      for (const n of npcs) {
        const camp = n.campanhaId ? await Campaign.findByPk(n.campanhaId, { attributes: ["id", "proprietarioId"] }) : null;
        const canSeeAll = isMestreOwner && (n.criadoPorId === req.user.id || camp?.proprietarioId === req.user.id);
        visible.push(canSeeAll ? n : npcParaMembro(n, req.user));
      }
      return res.json(visible);
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
        sharedWithPlayers,
        atributos,
        abilities,
        pericias,
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
        sharedWithPlayers: Boolean(sharedWithPlayers),
        ...atributosParaExtras(atributos),
        abilities: abilitiesParaExtras(abilities),
        pericias: Array.isArray(pericias) ? pericias.slice(0, 100) : [],
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
      if (!(await podeLerCampanha(req.user, npc.campanhaId))) {
        return res.status(403).json({ error: "Você não pode acessar este NPC." });
      }
      const isMasterOwner = (req.user?.perfil === "mestre" || req.user?.role === "master") &&
        (npc.criadoPorId === req.user.id || (npc.campanhaId && (await Campaign.findByPk(npc.campanhaId, { attributes: ["proprietarioId"] }))?.proprietarioId === req.user.id));
      return res.json(isMasterOwner ? npc : npcParaMembro(npc, req.user));
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
        sharedWithPlayers,
        atributos,
        abilities,
        pericias,
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
        ...(atributos !== undefined ? atributosParaExtras(atributos) : {}),
        ...(abilities !== undefined ? { abilities: abilitiesParaExtras(abilities) } : {}),
        ...(pericias !== undefined ? { pericias: Array.isArray(pericias) ? pericias : [] } : {}),
        ...(notasMestre !== undefined ? { notasMestre } : {}),
        ...(sharedWithPlayers !== undefined ? { sharedWithPlayers: Boolean(sharedWithPlayers) } : {}),
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
