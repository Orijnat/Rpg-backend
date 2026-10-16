import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const InventoryItem = sequelize.define(
  "InventoryItem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    characterId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "personagem_id",
      references: {
        model: "personagens",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      field: "nome",
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 1,
      field: "quantidade",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
      field: "descricao",
    },
    peso: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      defaultValue: 0,
    },
    equipado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    propriedades: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    tableName: "itens_inventario",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
