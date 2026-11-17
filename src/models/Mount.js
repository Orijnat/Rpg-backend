import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Tabela `montarias` do banco.sql (baseline da "reformulação" v2 que o app agora usa de fato).
// Dados flexíveis da montaria (atributos FOR..INT, alive, legadoId) ficam em dados_extras (JSONB).
export const Mount = sequelize.define(
  "Mount",
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
    nome: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: "nome",
    },
    especie: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "especie",
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "descricao",
    },
    hp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
      field: "pontos_vida",
      validate: { min: 0 },
    },
    hpMax: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 20,
      field: "pontos_vida_maximo",
      validate: { min: 1 },
    },
    dadosExtras: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "dados_extras",
    },
  },
  {
    tableName: "montarias",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
