import { Mount, Character, CampaignMember } from "../models/index.js";
import { canManageCharacter } from "./characterController.js";

const ATTR_KEYS = ["FOR", "DES", "CON", "SAB", "ESP", "CAR", "INT"];
const ATTR_DEFAULTS = Object.fromEntries(ATTR_KEYS.map((key) => [key, 10]));
const clampAttr = (value) => Math.max(1, Math.min(30, Math.floor(Number(value)) || 10));
const clampHp = (value, max) => Math.max(0, Math.min(Math.max(1, Math.floor(Number(max)) || 1), Math.floor(Number(value)) || 0));

function atributosFrom(input, base) {
  const source = input && typeof input === "object" ? input : {};
  const previous = base && typeof base === "object" ? base : {};
  const out = {};
  for (const key of ATTR_KEYS) {
    out[key] = clampAttr(source[key] ?? previous[key] ?? ATTR_DEFAULTS[key]);
  }
  return out;
}

// Merge raso de dados_extras; atributos são mesclados por cima dos anteriores (parciais não apagam os demais).
function dadosExtrasFrom(input, previous) {
  const base = previous && typeof previous === "object" ? { ...previous } : {};
  const source = input && typeof input === "object" ? input : {};
  const merged = { ...base, ...source };
  const attrs = source.attributes ?? base.attributes;
  if (attrs || merged.attributes) {
    merged.attributes = atributosFrom(attrs, base.attributes);
  }
  if (merged.alive === undefined) merged.alive = true;
  if (merged.notes === undefined) merged.notes = "";
  return merged;
}

function dadosParaCriar({ atributos, dadosExtras, notes }) {
  const merged = dadosExtrasFrom({ ...(dadosExtras || {}), notes: notes ?? "" }, null);
  if (atributos) merged.attributes = atributosFrom(atributos);
  return merged;
}

const toPublic = (mount) => {
  const json = mount?.toJSON ? mount.toJSON() : mount;
  if (!json) return null;
  return {
    id: json.id,
    characterId: json.characterId,
    nome: json.nome,
    especie: json.especie ?? "",
    descricao: json.descricao ?? "",
    hp: json.hp,
    hpMax: json.hpMax,
    dadosExtras: json.dadosExtras ?? {},
    created_at: json.created_at ?? json.createdAt,
    updated_at: json.updated_at ?? json.updatedAt,
  };
};

// Leitura: dono/gerente pode tudo; espectador da mesa (sharedWithPlayers + membro) pode ler.
async function podeLerMontaria(user, character) {
  if (await canManageCharacter(user, character)) return true;
  if (character?.dadosExtras?.sharedWithPlayers === true && character?.campanhaId) {
    const membro = await CampaignMember.findOne({
      where: { campanhaId: character.campanhaId, usuarioId: user?.id, bloqueado: false },
    });
    return Boolean(membro);
  }
  return false;
}

export const mountController = {
  async list(req, res) {
    try {
      const character = await Character.findByPk(req.params.id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      if (!(await podeLerMontaria(req.user, character))) {
        return res.status(403).json({ error: "Você não pode acessar as montarias deste herói." });
      }
      const rows = await Mount.findAll({
        where: { characterId: character.id },
        order: [["created_at", "ASC"]],
      });
      return res.json(rows.map(toPublic));
    } catch (error) {
      console.error("Erro ao listar montarias:", error);
      return res.status(500).json({ error: "Erro ao listar montarias." });
    }
  },

  async create(req, res) {
    try {
      const character = await Character.findByPk(req.params.id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      if (!(await canManageCharacter(req.user, character))) {
        return res.status(403).json({ error: "Você não pode gerenciar as montarias deste herói." });
      }

      const { nome, especie, descricao, hp, hpMax, atributos, dadosExtras, notes } = req.body || {};
      const nomeLimpo = typeof nome === "string" ? nome.trim().slice(0, 120) : "";
      if (!nomeLimpo) {
        return res.status(400).json({ error: "O nome da montaria é obrigatório." });
      }

      const max = Math.max(1, Math.min(999, Math.floor(Number(hpMax) || 20)));
      const vida = clampHp(hp ?? max, max);
      const mount = await Mount.create({
        characterId: character.id,
        nome: nomeLimpo,
        especie: typeof especie === "string" ? especie.trim().slice(0, 100) : "",
        descricao: typeof descricao === "string" ? descricao.slice(0, 5000) : "",
        hp: vida,
        hpMax: max,
        dadosExtras: dadosParaCriar({ atributos, dadosExtras, notes }),
      });
      return res.status(201).json(toPublic(mount));
    } catch (error) {
      console.error("Erro ao criar montaria:", error);
      return res.status(500).json({ error: "Erro ao criar montaria." });
    }
  },

  async update(req, res) {
    try {
      const mount = await Mount.findOne({ where: { id: req.params.mountId, characterId: req.params.id } });
      if (!mount) return res.status(404).json({ error: "Montaria não encontrada nesta ficha." });

      const character = await Character.findByPk(req.params.id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      if (!(await canManageCharacter(req.user, character))) {
        return res.status(403).json({ error: "Você não pode gerenciar as montarias deste herói." });
      }

      const body = req.body || {};
      const patch = {};
      if (body.nome !== undefined) {
        const nomeLimpo = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "";
        if (!nomeLimpo) return res.status(400).json({ error: "O nome da montaria não pode ficar vazio." });
        patch.nome = nomeLimpo;
      }
      if (body.especie !== undefined) {
        patch.especie = typeof body.especie === "string" ? body.especie.trim().slice(0, 100) : "";
      }
      if (body.descricao !== undefined) {
        patch.descricao = typeof body.descricao === "string" ? body.descricao.slice(0, 5000) : "";
      }

      const max = body.hpMax !== undefined
        ? Math.max(1, Math.min(999, Math.floor(Number(body.hpMax) || 1)))
        : mount.hpMax;
      const vida = body.hp !== undefined || body.hpMax !== undefined
        ? clampHp(body.hp !== undefined ? body.hp : mount.hp, max)
        : mount.hp;
      patch.hp = vida;
      patch.hpMax = max;

      const shouldUpdateExtras =
        body.atributos !== undefined ||
        body.dadosExtras !== undefined ||
        body.notes !== undefined ||
        body.alive !== undefined;
      if (shouldUpdateExtras) {
        patch.dadosExtras = dadosExtrasFrom(
          {
            ...(body.dadosExtras && typeof body.dadosExtras === "object" ? body.dadosExtras : {}),
            ...(body.atributos ? { attributes: body.atributos } : {}),
            ...(body.notes !== undefined ? { notes: String(body.notes).slice(0, 5000) } : {}),
            ...(body.alive !== undefined ? { alive: Boolean(body.alive) } : {}),
          },
          mount.dadosExtras
        );
      }

      await mount.update(patch);
      return res.json(toPublic(mount));
    } catch (error) {
      console.error("Erro ao atualizar montaria:", error);
      return res.status(500).json({ error: "Erro ao atualizar montaria." });
    }
  },

  async remove(req, res) {
    try {
      const mount = await Mount.findOne({ where: { id: req.params.mountId, characterId: req.params.id } });
      if (!mount) return res.status(404).json({ error: "Montaria não encontrada nesta ficha." });

      const character = await Character.findByPk(req.params.id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      if (!(await canManageCharacter(req.user, character))) {
        return res.status(403).json({ error: "Você não pode gerenciar as montarias deste herói." });
      }

      await mount.destroy();
      return res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover montaria:", error);
      return res.status(500).json({ error: "Erro ao remover montaria." });
    }
  },
};
