import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const CampaignResource = sequelize.define(
  "CampaignResource",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: false,
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
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "mapa",
    },
    titulo: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    publica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    metadados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "recursos_campanha",
    underscored: true,
    timestamps: true,
  }
);
