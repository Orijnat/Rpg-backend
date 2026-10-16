import { sequelize } from "../config/database.js";
import { User } from "./User.js";
import { Character } from "./Character.js";
import { InventoryItem } from "./InventoryItem.js";
import { Contract } from "./Contract.js";

// Relacionamentos Usuário <-> Personagem
User.hasMany(Character, {
  foreignKey: "userId",
  as: "characters",
  onDelete: "CASCADE",
});

User.prototype.isMestre = function isMestre() {
  return this.perfil === "mestre" || this.role === "master";
};

Character.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// Relacionamentos
Character.hasMany(InventoryItem, {
  foreignKey: "characterId",
  as: "inventory",
  onDelete: "CASCADE",
});

InventoryItem.belongsTo(Character, {
  foreignKey: "characterId",
  as: "character",
});

Character.hasMany(Contract, {
  foreignKey: "characterId",
  as: "contracts",
  onDelete: "CASCADE",
});

Contract.belongsTo(Character, {
  foreignKey: "characterId",
  as: "character",
});

export { sequelize, User, Character, InventoryItem, Contract };
