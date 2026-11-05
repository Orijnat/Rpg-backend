import { Character, InventoryItem, Contract, User, Campaign, CampaignMember, registrarAuditoria } from "../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { parsePaginationQuery } from "../services/pagination.js";

const bankAttempts = new Map();
const BANK_MAX_ATTEMPTS = 5;
const BANK_LOCK_MS = 15 * 60 * 1000;

async function canManageCharacter(user, character) {
  if (!user || !character) return false;
  // Dono da ficha sempre pode gerenciar
  if (character.userId === user.id) return true;

  // Se for mestre, restringe às próprias campanhas (isolamento horizontal de mestres)
  if (user.perfil === "mestre" || user.role === "master") {
    if (character.campanhaId) {
      const campanha = await Campaign.findByPk(character.campanhaId);
      return campanha?.proprietarioId === user.id;
    }
    // Personagem sem campanha só pode ser editado pelo dono
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
  const preferArray = (canonical, legacy) =>
    Array.isArray(canonical) && canonical.length > 0 ? canonical : (Array.isArray(legacy) ? legacy : []);
  data.FOR = data.forca ?? data.FOR ?? data.attributes?.FOR ?? 10;
  data.DES = data.destreza ?? data.DES ?? data.attributes?.DES ?? 10;
  data.CON = data.constituicao ?? data.CON ?? data.attributes?.CON ?? 10;
  data.SAB = data.sabedoria ?? data.SAB ?? data.attributes?.SAB ?? 10;
  data.ESP = data.espirito ?? data.ESP ?? data.attributes?.ESP ?? 10;
  data.CAR = data.carisma ?? data.CAR ?? data.attributes?.CAR ?? 10;
  data.INT = data.inteligencia ?? data.INT ?? data.attributes?.INT ?? 10;
  // Os campos em português são os nomes persistidos; os aliases em inglês e
  // abreviados são o contrato consumido pelas telas antigas.
  data.pericias = preferArray(data.pericias, data.skills);
  data.skills = data.pericias;
  data.itensInventario = preferArray(data.itensInventario, data.inventory);
  data.inventory = data.itensInventario;
  data.contratosDados = preferArray(data.contratosDados, data.contracts);
  data.contracts = data.contratosDados;
  data.players = data.jogadores || [];
  data.npcs = data.npcs || [];
  data.imagensAnotacoes = data.imagensAnotacoes ?? data.notesImages ?? [];
  data.notesImages = data.imagensAnotacoes;
  data.customClass = data.customClass ?? data.dadosExtras?.customClass ?? "";
  if (data.user) {
    data.owner = {
      id: data.user.id,
      username: data.user.username,
      email: data.user.email,
      perfil: data.user.perfil,
    };
  }
  const moedas = Object.keys(data.moedas || {}).length ? data.moedas : data.currencies || {};
  data.latina = data.latina ?? moedas.latina ?? moedas.platina ?? 0;
  data.ouro = data.ouro ?? moedas.ouro ?? 0;
  data.prata = data.prata ?? moedas.prata ?? 0;
  data.cobre = data.cobre ?? moedas.cobre ?? 0;
  data.moedas = { latina: data.latina, ouro: data.ouro, prata: data.prata, cobre: data.cobre };
  data.currencies = data.moedas;
  delete data.bankPassword;
  return data;
}

function normalizeCharacterPayload(payload, user) {
  const data = { ...payload };
  // Identidade, dono e segredo do cofre são controlados pelo servidor.
  delete data.id;
  delete data.userId;
  delete data.bankPassword;
  const atributos = {
    FOR: data.FOR ?? data.attributes?.FOR,
    DES: data.DES ?? data.attributes?.DES,
    CON: data.CON ?? data.attributes?.CON,
    SAB: data.SAB ?? data.attributes?.SAB,
    ESP: data.ESP ?? data.attributes?.ESP,
    CAR: data.CAR ?? data.attributes?.CAR,
    INT: data.INT ?? data.attributes?.INT,
  };
  if (atributos.FOR != null) data.forca = atributos.FOR;
  if (atributos.DES != null) data.destreza = atributos.DES;
  if (atributos.CON != null) data.constituicao = atributos.CON;
  if (atributos.SAB != null) data.sabedoria = atributos.SAB;
  if (atributos.ESP != null) data.espirito = atributos.ESP;
  if (atributos.CAR != null) data.carisma = atributos.CAR;
  if (atributos.INT != null) data.inteligencia = atributos.INT;
  if (data.skills !== undefined && data.pericias === undefined) data.pericias = data.skills;
  if (data.inventory !== undefined && data.itensInventario === undefined) data.itensInventario = data.inventory;
  if (data.contracts !== undefined && data.contratosDados === undefined) data.contratosDados = data.contracts;
  if (data.players !== undefined && data.jogadores === undefined) data.jogadores = data.players;
  if (data.notesImages !== undefined && data.imagensAnotacoes === undefined) data.imagensAnotacoes = data.notesImages;

  // Rastreamento de alteração: quem alterou cada dado e quando
  const extras = {
    ...(data.dadosExtras || {}),
    customClass: data.customClass ?? data.dadosExtras?.customClass ?? "",
  };
  if (user) {
    extras.lastModifiedBy = { id: user.id, name: user.username, role: user.role };
    extras.lastModifiedAt = new Date().toISOString();
  }
  data.dadosExtras = extras;

  const moedaFonte = data.moedas || data.currencies || {};
  const moedas = {
    latina: data.latina ?? moedaFonte.latina ?? moedaFonte.platina,
    ouro: data.ouro ?? moedaFonte.ouro,
    prata: data.prata ?? moedaFonte.prata,
    cobre: data.cobre ?? moedaFonte.cobre,
  };
  if (Object.values(moedas).some((valor) => valor != null)) {
    data.moedas = { ...moedas };
    data.currencies = { ...moedas };
  }
  if (Object.values(atributos).every((valor) => valor != null)) data.attributes = atributos;
  return data;
}

export const characterController = {
  // Lista todos os personagens respeitando o isolamento horizontal por campanha
  async list(req, res) {
    try {
      const isMaster = req.user.perfil === "mestre" || req.user.role === "master";
      let whereClause;

      if (!isMaster) {
        whereClause = { userId: req.user.id };
      } else {
        // Mestre só tem acesso às próprias campanhas e aos personagens criados por ele
        const campanhasProprias = await Campaign.findAll({
          where: { proprietarioId: req.user.id },
          attributes: ["id"],
        });
        const campaignIds = campanhasProprias.map((c) => c.id);

        whereClause = {
          [Op.or]: [
            { userId: req.user.id },
            { campanhaId: campaignIds },
          ],
        };
      }

      if (req.query.campanhaId) {
        whereClause = {
          [Op.and]: [
            whereClause,
            { campanhaId: req.query.campanhaId },
          ],
        };
      }

      const pagination = parsePaginationQuery(req.query, { searchFields: ["name", "job"] });
      if (pagination.search) {
        whereClause = {
          [Op.and]: [
            whereClause,
            { [Op.or]: [
              { name: { [Op.iLike]: `%${pagination.search}%` } },
              { job: { [Op.iLike]: `%${pagination.search}%` } },
            ] },
          ],
        };
      }

      const query = {
        where: whereClause,
        attributes: ["id", "userId", "campanhaId", "name", "level", "job", "hp", "hpMax", "dadosExtras"],
        include: [{
          model: User,
          as: "user",
          attributes: ["id", "username", "email", "perfil"],
        }],
        order: [["updated_at", "DESC"]],
      };
      if (pagination.requested) {
        query.limit = pagination.limit;
        query.offset = pagination.offset;
      }
      const result = pagination.requested
        ? await Character.findAndCountAll(query)
        : { rows: await Character.findAll(query), count: null };
      const data = result.rows.map(publicCharacter);
      if (!pagination.requested) return res.json(data);
      return res.json({
        characters: data,
        pagination: { page: pagination.page, limit: pagination.limit, total: result.count,
          totalPages: Math.ceil(result.count / pagination.limit) },
      });
    } catch (error) {
      console.error("Erro ao listar personagens:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagens." });
    }
  },

  // Busca um personagem completo por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id, {
        include: [
          { model: InventoryItem, as: "inventory" },
          { model: Contract, as: "contracts" },
        ],
      });

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) {
        return res.status(403).json({ error: "Este personagem não pertence às suas campanhas ou perfil." });
      }

      return res.json(publicCharacter(character));
    } catch (error) {
      console.error("Erro ao buscar personagem:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagem." });
    }
  },

  // Cria um novo personagem
  async create(req, res) {
    try {
      const data = normalizeCharacterPayload(req.body, req.user);
      data.userId = req.user.id;
      if (req.body.campanhaId) {
        if (!(await canUseCampaign(req.user, req.body.campanhaId))) {
          return res.status(403).json({ error: "Você não pode vincular o personagem a esta campanha." });
        }
        data.campanhaId = req.body.campanhaId;
      }
      const newCharacter = await Character.create(data);

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: newCharacter.campanhaId,
        acao: "CRIAR_PERSONAGEM",
        entidade: "personagens",
        entidadeId: newCharacter.id,
        dados: { nome: newCharacter.name },
        ip: req.ip,
      });

      return res.status(201).json(publicCharacter(newCharacter));
    } catch (error) {
      console.error("Erro ao criar personagem:", error);
      return res.status(400).json({ error: error.message || "Erro ao criar personagem." });
    }
  },

  // Atualiza um personagem existente
  async update(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) {
        return res.status(403).json({ error: "Permissão negada para atualizar este personagem." });
      }

      if (req.body.campanhaId !== undefined &&
          !(await canUseCampaign(req.user, req.body.campanhaId))) {
        return res.status(403).json({ error: "Você não pode vincular o personagem a esta campanha." });
      }
      await character.update(normalizeCharacterPayload(req.body, req.user));

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: character.campanhaId,
        acao: "ATUALIZAR_PERSONAGEM",
        entidade: "personagens",
        entidadeId: character.id,
        dados: { nome: character.name, alteracoes: req.body },
        ip: req.ip,
      });

      return res.json(publicCharacter(character));
    } catch (error) {
      console.error("Erro ao atualizar personagem:", error);
      return res.status(400).json({ error: "Erro ao atualizar personagem." });
    }
  },

  // Sincronização completa da ficha
  async sync(req, res) {
    try {
      const id = req.body?.id;
      const payload = normalizeCharacterPayload(req.body, req.user);

      let character;
      if (id) {
        character = await Character.findByPk(id);
      }

      if (character) {
        const canManage = await canManageCharacter(req.user, character);
        if (!canManage) {
          return res.status(403).json({ error: "Permissão negada para sincronizar este personagem." });
        }
        await character.update(payload);
      } else {
        payload.userId = req.user.id;
        character = await Character.create(payload);
      }

      return res.json({
        success: true,
        message: "Ficha sincronizada com sucesso.",
        character: publicCharacter(character),
      });
    } catch (error) {
      console.error("Erro ao sincronizar personagem:", error);
      return res.status(500).json({ error: "Falha na sincronização da ficha." });
    }
  },

  // Verificação de senha do cofre bancário
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

      const character = await Character.findByPk(id, {
        attributes: ["id", "bankPassword"],
      });

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) {
        return res.status(403).json({ error: "Permissão negada para acessar o cofre deste personagem." });
      }

      const storedPassword = String(character.bankPassword || "");
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

  // Deleta um personagem
  async delete(req, res) {
    try {
      const { id } = req.params;
      const character = await Character.findByPk(id);

      if (!character) {
        return res.status(404).json({ error: "Personagem não encontrado." });
      }
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) {
        return res.status(403).json({ error: "Permissão negada para excluir este personagem." });
      }

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: character.campanhaId,
        acao: "EXCLUIR_PERSONAGEM",
        entidade: "personagens",
        entidadeId: character.id,
        dados: { nome: character.name },
        ip: req.ip,
      });

      await character.destroy();
      return res.json({ success: true, message: "Personagem removido." });
    } catch (error) {
      console.error("Erro ao remover personagem:", error);
      return res.status(500).json({ error: "Erro ao remover personagem." });
    }
  },
};
