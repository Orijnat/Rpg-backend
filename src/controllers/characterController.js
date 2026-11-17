import { Character, AtributosPersonagem, Race, InventoryItem, Contract, User, Campaign, CampaignMember, registrarAuditoria, sequelize } from "../models/index.js";
import { Op } from "sequelize";
import bcrypt from "bcryptjs";
import { parsePaginationQuery } from "../services/pagination.js";
import { publicCharacter, DEFAULT_ATRIBUTOS } from "../services/characterPublic.js";
import { resolveRaca, racaExtras, hitDieMax } from "../services/racaService.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bankAttempts = new Map();
const BANK_MAX_ATTEMPTS = 5;
const BANK_LOCK_MS = 15 * 60 * 1000;

async function canManageCharacter(user, character) {
  if (!user || !character) return false;
  if (character.userId === user.id) return true;
  if (user.perfil === "mestre" || user.role === "master") {
    // Uma única consulta cobre tanto o dono da campanha do personagem
    // quanto o caso "membro de mesa do mestre" (sem idas e voltas por candidato).
    const campanhasProprias = await Campaign.findAll({
      where: { proprietarioId: user.id },
      attributes: ["id"],
    });
    const campaignIds = campanhasProprias.map((c) => c.id);
    if (character.campanhaId && campaignIds.includes(character.campanhaId)) return true;
    if (campaignIds.length > 0) {
      const membro = await CampaignMember.findOne({
        where: { usuarioId: character.userId, campanhaId: campaignIds, bloqueado: false },
      });
      if (membro) return true;
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

// Apenas os atributos PRESENTES no payload (updates parciais nunca zeram os demais)
function atributosPatchFromPayload(payload) {
  const patch = {};
  const pick = (key, aliases) => {
    for (const alias of aliases) {
      if (payload[alias] !== undefined) {
        patch[key] = Math.max(1, Math.min(30, Number(payload[alias]) || DEFAULT_ATRIBUTOS[key]));
        return;
      }
    }
  };
  pick("forca", ["FOR", "forca"]);
  pick("destreza", ["DES", "destreza"]);
  pick("constituicao", ["CON", "constituicao"]);
  pick("sabedoria", ["SAB", "sabedoria"]);
  pick("espirito", ["ESP", "espirito"]);
  pick("carisma", ["CAR", "carisma"]);
  pick("inteligencia", ["INT", "inteligencia"]);
  return patch;
}

const ATRIBUTO_ALIAS = {
  forca: "FOR", destreza: "DES", constituicao: "CON",
  sabedoria: "SAB", espirito: "ESP", carisma: "CAR", inteligencia: "INT",
};

function normalizeCharacterPayload(payload, user, existingExtras = {}) {
  const data = { ...payload };
  delete data.id;
  delete data.userId;
  delete data.bankPassword;
  delete data.updatedAt;
  delete data.updated_at;
  delete data.createdAt;
  delete data.created_at;
  delete data.force;

  // Campos que vão para a tabela personagens
  if (data.name !== undefined)      data.name = data.name;
  if (data.hp  !== undefined)       data.hp   = data.hp;
  if (data.hpMax !== undefined)     data.hpMax = data.hpMax;
  if (data.level !== undefined)     data.level = data.level;
  if (data.job !== undefined)       data.job   = data.job;
  if (data.customClass !== undefined && data.job === undefined) data.job = data.customClass;
  if (data.xp !== undefined || data.experiencia !== undefined) {
    data.experiencia = Math.max(0, Number(data.xp ?? data.experiencia) || 0);
  }
  delete data.xp;

  // Vínculo com a raça (FK para racas.id); null desfaz o vínculo
  if (payload.raceId !== undefined) {
    const value = payload.raceId === null ? null : String(payload.raceId).trim();
    if (value && UUID_RE.test(value)) {
      data.racaId = value;
    } else if (value === null || value === "") {
      data.racaId = null;
    }
  }

  // Tudo mais vai para dados_extras (merge sobre o existente para não apagar campos preservados no servidor)
  const extras = { ...(existingExtras || {}), ...(payload.dadosExtras || {}) };
  delete extras.bankPassword;
  delete extras.bankPasswordHash;

  // Atributos escalares → delegados para AtributosPersonagem (tratados no create/update)
  // updates parciais só mexem nos atributos enviados; mirror no extras só para os informados
  const atributosPatch = atributosPatchFromPayload(payload);
  for (const [key, value] of Object.entries(atributosPatch)) {
    extras[key] = value;
    extras[ATRIBUTO_ALIAS[key]] = value;
  }

  // Arrays e campos legados
  if (payload.pericias        !== undefined) extras.pericias        = payload.pericias;
  if (payload.skills          !== undefined) extras.pericias        = payload.skills;
  if (payload.itensInventario !== undefined) extras.itensInventario = payload.itensInventario;
  if (payload.inventory       !== undefined) extras.itensInventario = payload.inventory;
  if (payload.contratosDados  !== undefined) extras.contratosDados  = payload.contratosDados;
  if (payload.contracts       !== undefined) extras.contratosDados  = payload.contracts;
  if (payload.jogadores       !== undefined) extras.jogadores       = payload.jogadores;
  if (payload.players         !== undefined) extras.jogadores       = payload.players;
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
  if (payload.race           != null) {
    const slug = String(payload.race).trim().toLowerCase();
    if (slug) extras.race = slug.slice(0, 40);
  }
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
  return { characterData: data, atributosPatch };
}

// ── Helpers para upsert de atributos ────────────────────────────────────────
async function upsertAtributos(personagemId, atributosData) {
  const existing = await AtributosPersonagem.findByPk(personagemId);
  if (existing) {
    if (Object.keys(atributosData).length === 0) return existing;
    await existing.update(atributosData);
    return existing;
  }
  return AtributosPersonagem.create({ personagemId, ...DEFAULT_ATRIBUTOS, ...atributosData });
}

// ── Include padrão para busca com atributos ──────────────────────────────────
const includeAtributos = { model: AtributosPersonagem, as: "atributos", required: false };
const includeRaca = { model: Race, as: "raca", attributes: ["id", "slug", "nome", "dado_de_vida"] };
// Nunca selecionar `password` aqui: o hash vazaria nos payloads de personagem.
// A verificação do cofre busca o hash do dono separadamente quando necessário.
const includeUser = { model: User, as: "user", attributes: ["id", "username", "email", "perfil"] };

export const characterController = {
  async list(req, res) {
    try {
      const isMaster = req.user.perfil === "mestre" || req.user.role === "master";
      let whereClause;

      // Validação de campanha quando filtrada por campanhaId
      let campaignFilter = null;
      let isOwnerMaster = false;
      if (req.query.campanhaId) {
        const campanha = await Campaign.findByPk(req.query.campanhaId, {
          attributes: ["id", "proprietarioId"],
        });
        if (!campanha) {
          return res.status(404).json({ error: "Campanha não encontrada." });
        }
        isOwnerMaster = isMaster && campanha.proprietarioId === req.user.id;
        if (!isOwnerMaster) {
          const membro = await CampaignMember.findOne({
            where: { campanhaId: campanha.id, usuarioId: req.user.id, bloqueado: false },
          });
          if (!membro) {
            return res.status(403).json({ error: "Acesso restrito a esta campanha." });
          }
        }
        campaignFilter = campanha.id;
      }

      if (campaignFilter && !isOwnerMaster) {
        // Membro comum: só a própria ficha nesta campanha
        whereClause = { userId: req.user.id, campanhaId: campaignFilter };
      } else if (!isMaster) {
        // Heróis compartilhados pelo mestre com a mesa: membros veem a ficha (somente leitura)
        const memberships = await CampaignMember.findAll({
          where: { usuarioId: req.user.id, bloqueado: false },
          attributes: ["campanhaId"],
        });
        const campaignIds = [...new Set(memberships.map((m) => m.campanhaId))];
        if (campaignIds.length > 0) {
          const sharedLiteral = sequelize.literal(`"dados_extras" ->> 'sharedWithPlayers' = 'true'`);
          whereClause = {
            [Op.or]: [
              { userId: req.user.id },
              { [Op.and]: [{ campanhaId: campaignIds }, sharedLiteral] },
            ],
          };
        } else {
          whereClause = { userId: req.user.id };
        }
      } else {
        const campanhasProprias = await Campaign.findAll({
          where: { proprietarioId: req.user.id },
          attributes: ["id"],
        });
        const campaignIds = campanhasProprias.map((c) => c.id);

        let memberUserIds = [];
        if (campaignIds.length > 0) {
          const membros = await CampaignMember.findAll({
            where: {
              campanhaId: campaignFilter || campaignIds,
              bloqueado: false,
            },
            attributes: ["usuarioId"],
          });
          memberUserIds = membros.map((m) => m.usuarioId);
        }

        if (campaignFilter) {
          whereClause = {
            [Op.or]: [
              { campanhaId: campaignFilter },
              { userId: memberUserIds },
            ],
          };
        } else {
          whereClause = {
            [Op.or]: [
              { userId: req.user.id },
              { campanhaId: campaignIds },
              { userId: memberUserIds },
            ],
          };
        }
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
        include: [includeUser, includeAtributos, includeRaca],
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
        include: [includeAtributos, includeUser, includeRaca,
          { model: InventoryItem, as: "inventory" },
          { model: Contract,      as: "contracts" },
        ],
      });
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      let canManage = await canManageCharacter(req.user, character);
      if (!canManage && character.dadosExtras?.sharedWithPlayers === true && character.campanhaId) {
        const membro = await CampaignMember.findOne({
          where: { campanhaId: character.campanhaId, usuarioId: req.user.id, bloqueado: false },
        });
        canManage = Boolean(membro);
      }
      if (!canManage) return res.status(403).json({ error: "Este personagem não pertence às suas campanhas ou perfil." });
      const publicData = publicCharacter(character);
      publicData.readOnly = !(await canManageCharacter(req.user, character));
      return res.json(publicData);
    } catch (error) {
      console.error("Erro ao buscar personagem:", error);
      return res.status(500).json({ error: "Erro interno ao buscar personagem." });
    }
  },

  async create(req, res) {
    try {
      const hasRaceInput = (req.body.raceId !== undefined && req.body.raceId !== null && req.body.raceId !== "")
        || (req.body.race !== undefined && req.body.race !== null && req.body.race !== "");
      if (hasRaceInput) {
        const raca = await resolveRaca(req.body);
        if (!raca) return res.status(400).json({ error: "Raça inválida ou não encontrada." });
        req.body = { ...req.body, ...racaExtras(raca), raceId: raca.id };
        if (req.body.hp === undefined && req.body.hpMax === undefined) {
          const maxHp = hitDieMax(raca.dadoDeVida, 70);
          req.body.hp = maxHp;
          req.body.hpMax = maxHp;
        }
      }
      const { characterData, atributosPatch } = normalizeCharacterPayload(req.body, req.user);
      characterData.userId = req.user.id;

      if (req.body.campanhaId) {
        if (!(await canUseCampaign(req.user, req.body.campanhaId)))
          return res.status(403).json({ error: "Você não pode vincular o personagem a esta campanha." });
        characterData.campanhaId = req.body.campanhaId;
      }

      const newCharacter = await Character.create(characterData);
      await upsertAtributos(newCharacter.id, atributosPatch);

      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: newCharacter.campanhaId,
        acao: "CRIAR_PERSONAGEM", entidade: "personagens", entidadeId: newCharacter.id,
        dados: { nome: newCharacter.name }, ip: req.ip,
      });

      const full = await Character.findByPk(newCharacter.id, { include: [includeAtributos, includeRaca] });
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

      const hasRaceInput = (req.body.raceId !== undefined && req.body.raceId !== null && req.body.raceId !== "")
        || (req.body.race !== undefined && req.body.race !== null && req.body.race !== "");
      if (hasRaceInput) {
        const raca = await resolveRaca(req.body);
        if (!raca) return res.status(400).json({ error: "Raça inválida ou não encontrada." });
        req.body = { ...req.body, ...racaExtras(raca), raceId: raca.id };
      }
      const { characterData, atributosPatch } = normalizeCharacterPayload(req.body, req.user, character.dadosExtras || {});
      await character.update(characterData);
      await upsertAtributos(id, atributosPatch);

      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: character.campanhaId,
        acao: "ATUALIZAR_PERSONAGEM", entidade: "personagens", entidadeId: character.id,
        dados: { nome: character.name, alteracoes: req.body }, ip: req.ip,
      });

      const full = await Character.findByPk(id, { include: [includeAtributos, includeRaca] });
      return res.json(publicCharacter(full));
    } catch (error) {
      console.error("Erro ao atualizar personagem:", error);
      return res.status(400).json({ error: "Erro ao atualizar personagem." });
    }
  },

  async sync(req, res) {
    try {
      const id = req.body?.id;

      // Sincronização exige o id da ficha (o cliente sempre o possui após o registro/hidratação).
      // Sem id, recusa em vez de adivinhar o alvo e sobrescrever a ficha errada.
      if (!id) {
        return res.status(400).json({ error: "ID da ficha ausente para sincronização. Recarregue a página." });
      }

      const target = await Character.findByPk(id);
      if (!target) {
        return res.status(404).json({ error: "Personagem não encontrado para sincronização." });
      }
      const canManage = await canManageCharacter(req.user, target);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para sincronizar este personagem." });

      // Concorrência otimista: o cliente informa a versão remota que ele viu (`updatedAt`).
      // Comparação estrita em milissegundos: qualquer gravação no servidor entre a leitura
      // do cliente e este save invalida a versão ecoada.
      const hasRaceInput = (req.body.raceId !== undefined && req.body.raceId !== null && req.body.raceId !== "")
        || (req.body.race !== undefined && req.body.race !== null && req.body.race !== "");
      if (hasRaceInput) {
        const raca = await resolveRaca(req.body);
        if (!raca) return res.status(400).json({ error: "Raça inválida ou não encontrada." });
        req.body = { ...req.body, ...racaExtras(raca), raceId: raca.id };
      }
      if (!req.body?.force && req.body?.updatedAt) {
        const seen = Date.parse(req.body.updatedAt);
        const serverUpdatedAt = target.updated_at ?? target.updatedAt;
        const current = serverUpdatedAt instanceof Date ? serverUpdatedAt.getTime() : Date.parse(serverUpdatedAt);
        if (!Number.isNaN(seen) && !Number.isNaN(current) && seen !== current) {
          const fullRemote = await Character.findByPk(id, { include: [includeAtributos, includeRaca] });
          return res.status(409).json({
            error: "A ficha foi alterada no servidor desde a sua última sincronização.",
            conflict: true,
            serverCharacter: publicCharacter(fullRemote),
          });
        }
      }

      const { characterData, atributosPatch } = normalizeCharacterPayload(req.body, req.user, target.dadosExtras || {});
      await target.update(characterData);
      await upsertAtributos(id, atributosPatch);

      const character = target;
      const full = await Character.findByPk(character.id, { include: [includeAtributos, includeRaca] });
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

      const character = await Character.findByPk(id, {
        attributes: ["id", "dadosExtras", "userId", "campanhaId"],
      });
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para acessar o cofre deste personagem." });

      // Senha personalizada da ficha, se definida; senão, a senha do login do DONO da ficha
      // (mestre não abre o cofre do jogador com a própria senha).
      const customHash = character.dadosExtras?.bankPasswordHash;
      let isValid = false;
      if (customHash && String(customHash).startsWith("$2")) {
        isValid = await bcrypt.compare(String(password ?? ""), String(customHash));
      } else {
        const owner = await User.findByPk(character.userId, { attributes: ["id", "password"] });
        if (owner?.password) {
          isValid = await bcrypt.compare(String(password ?? ""), owner.password);
        }
      }

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

  // Definir/remover a senha personalizada do cofre da ficha
  async setBankPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body || {};
      const character = await Character.findByPk(id);
      if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
      const canManage = await canManageCharacter(req.user, character);
      if (!canManage) return res.status(403).json({ error: "Permissão negada para alterar a senha do cofre." });

      const extras = { ...(character.dadosExtras || {}) };
      if (password === undefined || password === "") {
        delete extras.bankPasswordHash;
        delete extras.bankPassword;
      } else {
        const salt = await bcrypt.genSalt(10);
        extras.bankPasswordHash = await bcrypt.hash(String(password), salt);
        delete extras.bankPassword;
        extras.lastModifiedBy = { id: req.user.id, name: req.user.username, role: req.user.role };
        extras.lastModifiedAt = new Date().toISOString();
      }

      await character.update({ dadosExtras: extras });
      await registrarAuditoria({
        usuarioId: req.user.id, campanhaId: character.campanhaId,
        acao: "ALTERAR_SENHA_COFRE", entidade: "personagens", entidadeId: character.id,
        dados: { nome: character.name, personalizada: Boolean(password) }, ip: req.ip,
      });
      return res.json({ success: true, custom: Boolean(password), message: password ? "Senha do cofre atualizada." : "Senha personalizada removida; o cofre agora usa a senha do login do dono da ficha." });
    } catch (error) {
      console.error("Erro ao alterar senha do cofre:", error);
      return res.status(500).json({ error: "Erro ao alterar a senha do cofre." });
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
