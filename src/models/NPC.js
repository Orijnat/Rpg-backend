import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const NPC = sequelize.define(
  "NPC",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
      references: {
        model: "campanhas",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "criado_por_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    papel: {
      type: DataTypes.STRING(120),
      allowNull: true,
      defaultValue: "NPC",
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: "pontos_vida",
    },
    hpMax: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: "pontos_vida_maximo",
    },
    dadosExtras: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "dados_extras",
    },
  },
  {
    tableName: "npcs",
    underscored: true,
    timestamps: true,
  }
);
