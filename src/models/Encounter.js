import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Encounter = sequelize.define(
  "Encounter",
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
    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "combate",
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    dadosExtras: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "dados_extras",
    },
  },
  {
    tableName: "encontros",
    underscored: true,
    timestamps: true,
  }
);
