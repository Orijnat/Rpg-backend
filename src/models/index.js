import { sequelize } from "../config/database.js";
import { Character } from "./Character.js";
import { InventoryItem } from "./InventoryItem.js";
import { Contract } from "./Contract.js";

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

export { sequelize, Character, InventoryItem, Contract };
