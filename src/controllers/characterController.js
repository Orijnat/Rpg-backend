import { Character, AtributosPersonagem, InventoryItem, Contract, User, Campaign, CampaignMember, registrarAuditoria } from "../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { parsePaginationQuery } from "../services/pagination.js";

const bankAttempts = new Map();
const BANK_MAX_ATTEMPTS = 5;
const BANK_LOCK_MS = 15 * 60 * 1000;

// ── Atributos padrão ────────────────────────────────────────────────────────
const DEFAULT_ATRIBUTOS = {
  forca: 10, destreza: 10, constituicao: 10,
  sabedoria: 10, espirito: 10, carisma: 10, inteligencia: 10,
};

function atributosFromPayload(payload) {
  return {
    forca:        payload.FOR ?? payload.forca        ?? DEFAULT_ATRIBUTOS.forca,
    destreza:     payload.DES ?? payload.destreza     ?? DEFAULT_ATRIBUTOS.destreza,
    constituicao: payload.CON ?? payload.constituicao ?? DEFAULT_ATRIBUTOS.constituicao,
    sabedoria:    payload.SAB ?? payload.sabedoria     ?? DEFAULT_ATRIBUTOS.sabedoria,
    espirito:     payload.ESP ?? payload.espirito      ?? DEFAULT_ATRIBUTOS.espirito,
    carisma:      payload.CAR ?? payload.carisma       ?? DEFAULT_ATRIBUTOS.carisma,
    inteligencia: payload.INT ?? payload.inteligencia  ?? DEFAULT_ATRIBUTOS.inteligencia,
  };
}

function atributosToPublic(atributos) {
  if (!atributos) return DEFAULT_ATRIBUTOS;
  const a = atributos.toJSON ? atributos.toJSON() : atributos;
  return {
    forca: a.forca, destreza: a.destreza, constituicao: a.constituicao,
    sabedoria: a.sabedoria, espirito: a.espirito, carisma: a.carisma,
    inteligencia: a.inteligencia,
    // aliases abreviados consumidos pelo frontend
    FOR: a.forca, DES: a.destreza, CON: a.constituicao,
    SAB: a.sabedoria, ESP: a.espirito, CAR: a.carisma, INT: a.inteligencia,
  };
}

async function canManageCharacter(user, character) {
  if (!user || !character) return false;
  if (character.userId === user.id) return true;
  if (user.perfil === "mestre" || user.role === "master") {
    if (character.campanhaId) {
      const campanha = await Campaign.findByPk(character.campanhaId);
      return campanha?.proprietarioId === user.id;
    }
    return false;
  }
  return false;
}

async function canUseCampaign(user, campanhaId) {
  if (!campanhaId) return true;
  const campanha = await Campaign.findByPk(campanhaId);
  if (!campanha) return false;
  if (campanha.proprietarioId === user.id) return true;
  if (user.perfil === "mestre" || user.role === "master") return false;
  const membro = await CampaignMember.findOne({
    where: { campanhaId, usuarioId: user.id, bloqueado: false },
  });
  return Boolean(membro);
}

function publicCharacter(character) {
  const data = character.toJSON ? character.toJSON() : { ...character };
  const extras = data.dadosExtras || {};

  // Atributos: vêm de `atributos` (associação) ou fallback em dadosExtras
  const atributos = data.atributos
    ? atributosToPublic(data.atributos)
    : {
        forca: extras.forca ?? 10, destreza: extras.destreza ?? 10,
        constituicao: extras.constituicao ?? 10, sabedoria: extras.sabedoria ?? 10,
        espirito: extras.espirito ?? 10, carisma: extras.carisma ?? 10,
        inteligencia: extras.inteligencia ?? 10,
        FOR: extras.FOR ?? extras.forca ?? 10, DES: extras.DES ?? extras.destreza ?? 10,
        CON: extras.CON ?? extras.constituicao ?? 10, SAB: extras.SAB ?? extras.sabedoria ?? 10,
        ESP: extras.ESP ?? extras.espirito ?? 10, CAR: extras.CAR ?? extras.carisma ?? 10,
        INT: extras.INT ?? extras.inteligencia ?? 10,
      };

  Object.assign(data, atributos);

  // Campos legados vivendo em dados_extras
  const preferArray = (a, b) => Array.isArray(a) && a.length > 0 ? a : (Array.isArray(b) ? b : []);
  data.pericias        = preferArray(extras.pericias, extras.skills);
  data.skills          = data.pericias;
  data.itensInventario = preferArray(extras.itensInventario, extras.inventory);
  data.inventory       = data.itensInventario;
  data.contratosDados  = preferArray(extras.contratosDados, extras.contracts);
  data.contracts       = data.contratosDados;
  data.jogadores       = extras.jogadores || [];
  data.npcs            = extras.npcs || [];
  data.imagensAnotacoes = extras.imagensAnotacoes ?? extras.notesImages ?? [];
  data.notesImages     = data.imagensAnotacoes;
  data.customClass     = extras.customClass ?? "";
  data.bankSlots       = extras.bankSlots ?? Array.from({ length: 80 }, () => ({ item: "" }));
  data.notes           = extras.notes ?? "";
  data.roomNotes       = extras.roomNotes ?? "";
  data.mountName       = extras.mountName ?? "";
  data.mountHP         = extras.mountHP ?? 20;
  data.mountHPMax      = extras.mountHPMax ?? 20;
  data.mountNotes      = extras.mountNotes ?? "";
  data.peMax           = extras.peMax ?? 0;
  data.pe              = extras.pe ?? 0;
  data.insanityMax     = extras.insanityMax ?? 0;
  data.insanity        = extras.insanity ?? 0;
  data.bpMax           = extras.bpMax ?? 0;
  data.bp              = extras.bp ?? 0;
  data.armorClass      = extras.armorClass ?? 10;
  data.initiative      = extras.initiative ?? 0;
  data.hitDie          = extras.hitDie ?? "d8";

  // Moedas
  const moedas = extras.moedas || extras.currencies || {};
  data.latina  = extras.latina  ?? moedas.latina  ?? moedas.platina ?? 0;
  data.ouro    = extras.ouro    ?? moedas.ouro    ?? 0;
  data.prata   = extras.prata   ?? moedas.prata   ?? 0;
  data.cobre   = extras.cobre   ?? moedas.cobre   ?? 0;
  data.moedas  = { latina: data.latina, ouro: data.ouro, prata: data.prata, cobre: data.cobre };
  data.currencies = data.moedas;

  if (data.user) {
    data.owner = {
      id: data.user.id, username: data.user.username,
      email: data.user.email, perfil: data.user.perfil,
    };
  }

  delete data.bankPassword;
  return data;
}

function normalizeCharacterPayload(payload, user) {
  const data = { ...payload };
  delete data.id;
  delete data.userId;
  delete data.bankPassword;

  // Campos que vão para a tabela personagens
  if (data.name !== undefined)      data.name = data.name;
  if (data.hp  !== undefined)       data.hp   = data.hp;
  if (data.hpMax !== undefined)     data.hpMax = data.hpMax;
  if (data.level !== undefined)     data.level = data.level;
  if (data.job !== undefined)       data.job   = data.job;
  if (data.customClass !== undefined && data.job === undefined) data.job = data.customClass;

  // Tudo mais vai para dados_extras (merge incremental)
  const extras = { ...(payload.dadosExtras || {}) };

  // Atributos escalares → delegados para AtributosPersonagem (tratados no create/update)
  // mas guardamos mirror no extras para leitura offline
  const atributos = atributosFromPayload(payload);
  extras.FOR  = atributos.forca;
  extras.DES  = atributos.destreza;
  extras.CON  = atributos.constituicao;
  extras.SAB  = atributos.sabedoria;
  extras.ESP  = atributos.espirito;
  extras.CAR  = atributos.carisma;
  extras.INT  = atributos.inteligencia;

  // Arrays e campos legados
  if (payload.pericias        !== undefined) extras.pericias        = payload.pericias;
  if (payload.skills          !== undefined) extras.pericias        = payload.skills;
  if (payload.itensInventario !== undefined) extras.itensInventario = payload.itensInventario;
  if (payload.inventory       !== undefined) extras.itensInventario = payload.inventory;
  if (payload.contratosDados  !== undefined) extras.contratosDados  = payload.contratosDados;
  if (payload.contracts       !== undefined) extras.contratosDados  = payload.contracts;
  if (payload.jogadores       !== undefined) extras.jogadores       = payload.jogadores;
  if (payload.npcs            !== undefined) extras.npcs            = payload.npcs;
  if (payload.imagensAnotacoes !== undefined) extras.imagensAnotacoes = payload.imagensAnotacoes;
  if (payload.notesImages     !== undefined) extras.imagensAnotacoes = payload.notesImages;
  if (payload.bankSlots       !== undefined) extras.bankSlots       = payload.bankSlots;
  if (payload.notes           !== undefined) extras.notes           = payload.notes;
  if (payload.roomNotes       !== undefined) extras.roomNotes       = payload.roomNotes;
  if (payload.mountName       !== undefined) extras.mountName       = payload.mountName;
  if (payload.mountHP         !== undefined) extras.mountHP         = payload.mountHP;
  if (payload.mountHPMax      !== undefined) extras.mountHPMax      = payload.mountHPMax;
  if (payload.mountNotes      !== undefined) extras.mountNotes      = payload.mountNotes;
  if (payload.customClass     !== undefined) extras.customClass     = payload.customClass;
  if (payload.peMax           !== undefined) extras.peMax           = payload.peMax;
  if (payload.pe              !== undefined) extras.pe              = payload.pe;
  if (payload.insanityMax     !== undefined) extras.insanityMax     = payload.insanityMax;
  if (payload.insanity        !== undefined) extras.insanity        = payload.insanity;
  if (payload.bpMax           !== undefined) extras.bpMax           = payload.bpMax;
  if (payload.bp              !== undefined) extras.bp              = payload.bp;
  if (payload.armorClass      !== undefined) extras.armorClass      = payload.armorClass;
  if (payload.initiative      !== undefined) extras.initiative      = payload.initiative;
  if (payload.hitDie          !== undefined) extras.hitDie          = payload.hitDie;

  // Moedas
  const moedaFonte = payload.moedas || payload.currencies || {};
  const moedas = {
    latina: payload.latina ?? moedaFonte.latina ?? moedaFonte.platina,
    ouro:   payload.ouro   ?? moedaFonte.ouro,
    prata:  payload.prata  ?? moedaFonte.prata,
    cobre:  payload.cobre  ?? moedaFonte.cobre,
  };
  if (Object.values(moedas).some((v) => v != null)) {
    extras.moedas    = moedas;
    extras.currencies = moedas;
  }

  if (user) {
    extras.lastModifiedBy = { id: user.id, name: user.username, role: user.role };
    extras.lastModifiedAt = new Date().toISOString();
  }

  data.dadosExtras = extras;
  return { characterData: data, atributosData: atributos };
}

// ── Helpers para upsert de atributos ────────────────────────────────────────
async function upsertAtributos(personagemId, atributosData) {
  const existing = await AtributosPersonagem.findByPk(personagemId);
  if (existing) {
    await existing.update(atributosData);
    return existing;
  }
  return AtributosPersonagem.create({ personagemId, ...atributosData });
}

// ── Include padrão para busca com atributos ──────────────────────────────────
const includeAtributos = { model: AtributosPersonagem, as: "atributos", required: false };
const includeUser = { model: User, as: "user", attributes: ["id", "username", "email", "perfil"] };

export const characterController = {
  async list(req, res) {
    try {
      const isMaster = req.user.perfil === "mestre" || req.user.role === "master";
      let whereClause;

      if (!isMaster) {
        whereClause = { userId: req.user.id };
      } else {
        const campanhasProprias = await Campaign.findAll({
          where: { proprietarioId: req.user.id },
          attributes: ["id"],
        });
        const campaignIds = campanhasProprias.map((c) => c.id);
        whereClause = { [Op.or]: [{ userId: req.user.id }, { campanhaId: campaignIds }] };
      }

      if (req.query.campanhaId) {
        whereClause = { [Op.and]: [whereClause, { campanhaId: req.query.campanhaId }] };
      }

      const pagination = parsePaginationQuery(req.query, { searchFields: ["name", "job"] });
      if (pagination.search) {
        whereClause = {
          [Op.and]: [whereClause, {
            [Op.or]: [
              { name: { [Op.iLike]: `%${pagination.search}%` } },
              { job:  { [Op.iLike]: `%${pagination.search}%` } },
            ],
          }],
        };
      }

      const query = {
        where: whereClause,
        attributes: ["id", "userId", "campanhaId", "name", "level", "job", "hp", "hpMax", "dadosExtras"],
        include: [includeUser, includeAtributos],
        order: [["updated_at", "DESC"]],
      };
      if (pagination.requested) { query.limit = pagination.limit; query.offset = pagination.offset; }
      const result = pagination.requested
        ? await Character.findAndCountAll(query)
        : { rows: await Character.findAll(query), count: null };

      const data = result.rows.map(publicCharacter);
      if (!pagination.requested) return res.json(data);
      return res.json({
        characters: data,
        pagination: {
          page: pagination.page, limit: pagination.limit,
          total: result.count, totalPages: Math.ceil(result.count / pagination.limit),
        },
      });
    } catch (error) {
      console.error("Erro ao listar personagens:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagens." });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id, {
        include: [includeAtributos, includeUser,
          { model: InventoryItem, as: "inventory" },
          { model: Contract,      as: "contracts" },
        ],
      });
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Este personagem não pertence às suas campanhas ou perfil." });
      return res.json(publicCharacter(character));
    } catch (error) {
      console.error("Erro ao buscar personagem:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagem." });
    }
  },

  async create(req, res) {
    try {
      const { characterData, atributosData } = normalizeCharacterPayload(req.body, req.user);
      characterData.userId = req.user.id;

      if (req.body.campanhaId) {
        if (!(await canUseCampaign(req.user, req.body.campanhaId)))
          return res.status(403).json({ error: "Você não pode vincular o personagem a esta campanha." });
        characterData.campanhaId = req.body.campanhaId;
      }

      const newCharacter = await Character.create(characterData);
      await upsertAtributos(newCharacter.id, atributosData);

      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: newCharacter.campanhaId,
        acao: "CRIAR_PERSONAGEM", entidade: "personagens", entidadeId: newCharacter.id,
        dados: { nome: newCharacter.name }, ip: req.ip,
      });

      const full = await Character.findByPk(newCharacter.id, { include: [includeAtributos] });
      return res.status(201).json(publicCharacter(full));
    } catch (error) {
      console.error("Erro ao criar personagem:", error);
      return res.status(400).json({ error: error.message || "Erro ao criar personagem." });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para atualizar este personagem." });

      if (req.body.campanhaId !== undefined && !(await canUseCampaign(req.user, req.body.campanhaId)))
        return res.status(403).json({ error: "Você não pode vincular o personagem a esta campanha." });

      const { characterData, atributosData } = normalizeCharacterPayload(req.body, req.user);
      await character.update(characterData);
      await upsertAtributos(id, atributosData);

      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: character.campanhaId,
        acao: "ATUALIZAR_PERSONAGEM", entidade: "personagens", entidadeId: character.id,
        dados: { nome: character.name, alteracoes: req.body }, ip: req.ip,
      });

      const full = await Character.findByPk(id, { include: [includeAtributos] });
      return res.json(publicCharacter(full));
    } catch (error) {
      console.error("Erro ao atualizar personagem:", error);
      return res.status(400).json({ error: "Erro ao atualizar personagem." });
    }
  },

  async sync(req, res) {
    try {
      const id = req.body?.id;
      const { characterData, atributosData } = normalizeCharacterPayload(req.body, req.user);

      let character;
      if (id) character = await Character.findByPk(id);

      if (character) {
        const canManage = await canManageCharacter(req.user, character);
        if (!canManage) return res.status(403).json({ error: "Permissão negada para sincronizar este personagem." });
        await character.update(characterData);
        await upsertAtributos(id, atributosData);
      } else {
        characterData.userId = req.user.id;
        character = await Character.create(characterData);
        await upsertAtributos(character.id, atributosData);
      }

      const full = await Character.findByPk(character.id, { include: [includeAtributos] });
      return res.json({ success: true, message: "Ficha sincronizada com sucesso.", character: publicCharacter(full) });
    } catch (error) {
      console.error("Erro ao sincronizar personagem:", error);
      return res.status(500).json({ error: "Falha na sincronização da ficha." });
    }
  },

  async verifyBankPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;
      const attemptKey = `${req.user.id}:${id}`;
      const attempt = bankAttempts.get(attemptKey);
      if (attempt?.lockedUntil > Date.now()) {
        return res.status(429).json({
          error: "Cofre temporariamente bloqueado após tentativas inválidas.",
          retryAfterSeconds: Math.ceil((attempt.lockedUntil - Date.now()) / 1000),
        });
      }

      const character = await Character.findByPk(id, { attributes: ["id", "dadosExtras", "userId", "campanhaId"] });
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para acessar o cofre deste personagem." });

      const storedPassword = String(character.dadosExtras?.bankPassword || "133313");
      const isValid = storedPassword.startsWith("$2")
        ? await bcrypt.compare(String(password ?? ""), storedPassword)
        : storedPassword === String(password ?? "");

      if (!isValid) {
        const failures = (attempt?.failures || 0) + 1;
        bankAttempts.set(attemptKey, {
          failures,
          lockedUntil: failures >= BANK_MAX_ATTEMPTS ? Date.now() + BANK_LOCK_MS : 0,
        });
      } else {
        bankAttempts.delete(attemptKey);
      }
      return res.json({ valid: isValid });
    } catch (error) {
      console.error("Erro ao verificar senha bancária:", error);
      return res.status(500).json({ error: "Erro ao validar senha bancária." });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para excluir este personagem." });

      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: character.campanhaId,
        acao: "EXCLUIR_PERSONAGEM", entidade: "personagens", entidadeId: character.id,
        dados: { nome: character.name }, ip: req.ip,
      });

      await character.destroy();
      return res.json({ success: true, message: "Personagem removido." });
    } catch (error) {
      console.error("Erro ao remover personagem:", error);
      return res.status(500).json({ error: "Erro ao remover personagem." });
    }
  },
};
