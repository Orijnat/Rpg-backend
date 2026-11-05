import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Campaign = sequelize.define(
  "Campaign",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    proprietarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "proprietario_id",
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "planejamento",
    },
    codigoConvite: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
      field: "codigo_convite",
    },
    dadosExtras: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "dados_extras",
    },
  },
  {
    tableName: "campanhas",
    underscored: true,
    timestamps: true,
  }
);
