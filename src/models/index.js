import { sequelize } from "../config/database.js";
import { User } from "./User.js";
import { Character } from "./Character.js";
import { AtributosPersonagem } from "./AtributosPersonagem.js";
import { InventoryItem } from "./InventoryItem.js";
import { Contract } from "./Contract.js";
import { Campaign } from "./Campaign.js";
import { CampaignMember } from "./CampaignMember.js";
import { NPC } from "./NPC.js";
import { Note } from "./Note.js";
import { Encounter } from "./Encounter.js";
import { Session } from "./Session.js";
import { CampaignResource } from "./CampaignResource.js";
import { AuditLog, registrarAuditoria } from "./AuditLog.js";

User.prototype.isMestre = function isMestre() {
  return this.perfil === "mestre" || this.role === "master";
};

// Relacionamentos Usuário <-> Personagem
User.hasMany(Character, {
  foreignKey: "userId",
  as: "characters",
  onDelete: "CASCADE",
});
Character.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Personagem <-> Atributos (1:1)
Character.hasOne(AtributosPersonagem, {
  foreignKey: "personagemId",
  as: "atributos",
  onDelete: "CASCADE",
});
AtributosPersonagem.belongsTo(Character, {
  foreignKey: "personagemId",
  as: "personagem",
});

// Relacionamentos Personagem <-> Itens de Inventário
Character.hasMany(InventoryItem, {
  foreignKey: "characterId",
  as: "inventory",
  onDelete: "CASCADE",
});
InventoryItem.belongsTo(Character, {
  foreignKey: "characterId",
  as: "character",
});

// Relacionamentos Personagem <-> Contratos
Character.hasMany(Contract, {
  foreignKey: "characterId",
  as: "contracts",
  onDelete: "CASCADE",
});
Contract.belongsTo(Character, {
  foreignKey: "characterId",
  as: "character",
});

// Campanhas <-> Usuário Proprietário
User.hasMany(Campaign, {
  foreignKey: "proprietarioId",
  as: "campanhasCriadas",
  onDelete: "RESTRICT",
});
Campaign.belongsTo(User, {
  foreignKey: "proprietarioId",
  as: "proprietario",
});

// Campanhas <-> Membros
Campaign.belongsToMany(User, {
  through: CampaignMember,
  foreignKey: "campanhaId",
  otherKey: "usuarioId",
  as: "membros",
});
User.belongsToMany(Campaign, {
  through: CampaignMember,
  foreignKey: "usuarioId",
  otherKey: "campanhaId",
  as: "campanhasParticipando",
});

Campaign.hasMany(CampaignMember, {
  foreignKey: "campanhaId",
  as: "membrosCampanha",
  onDelete: "CASCADE",
});
CampaignMember.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});
CampaignMember.belongsTo(User, {
  foreignKey: "usuarioId",
  as: "usuario",
});

// Campanhas <-> Personagens
Campaign.hasMany(Character, {
  foreignKey: "campanhaId",
  as: "personagens",
  onDelete: "SET NULL",
});
Character.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});

// Campanhas <-> NPCs
Campaign.hasMany(NPC, {
  foreignKey: "campanhaId",
  as: "npcs",
  onDelete: "CASCADE",
});
NPC.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});
NPC.belongsTo(User, {
  foreignKey: "criadoPorId",
  as: "criador",
});

// Campanhas <-> Notas
Campaign.hasMany(Note, {
  foreignKey: "campanhaId",
  as: "notas",
  onDelete: "CASCADE",
});
Note.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});
Note.belongsTo(User, {
  foreignKey: "autorId",
  as: "autor",
});

// Campanhas <-> Encontros
Campaign.hasMany(Encounter, {
  foreignKey: "campanhaId",
  as: "encontros",
  onDelete: "CASCADE",
});
Encounter.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});

// Campanhas <-> Sessões de Jogo
Campaign.hasMany(Session, {
  foreignKey: "campanhaId",
  as: "sessoes",
  onDelete: "CASCADE",
});
Session.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});
Session.belongsTo(User, {
  foreignKey: "criadoPorId",
  as: "criador",
});

// Campanhas <-> Recursos (Mapas / Handouts)
Campaign.hasMany(CampaignResource, {
  foreignKey: "campanhaId",
  as: "recursos",
  onDelete: "CASCADE",
});
CampaignResource.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});

// Campanhas <-> Auditoria
Campaign.hasMany(AuditLog, {
  foreignKey: "campanhaId",
  as: "auditoria",
  onDelete: "SET NULL",
});
AuditLog.belongsTo(Campaign, {
  foreignKey: "campanhaId",
  as: "campanha",
});
AuditLog.belongsTo(User, {
  foreignKey: "usuarioId",
  as: "usuario",
});

export {
  sequelize,
  User,
  Character,
  AtributosPersonagem,
  InventoryItem,
  Contract,
  Campaign,
  CampaignMember,
  NPC,
  Note,
  Encounter,
  Session,
  CampaignResource,
  AuditLog,
  registrarAuditoria,
};
