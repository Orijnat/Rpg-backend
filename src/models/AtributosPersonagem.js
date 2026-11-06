import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Espelha a tabela `atributos_personagem` do banco.sql
export const AtributosPersonagem = sequelize.define(
  "AtributosPersonagem",
  {
    personagemId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: "personagem_id",
      references: { model: "personagens", key: "id" },
      onDelete: "CASCADE",
    },
    forca:        { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    destreza:     { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    constituicao: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    sabedoria:    { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    espirito:     { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    carisma:      { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    inteligencia: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
  },
  {
    tableName: "atributos_personagem",
    timestamps: false,
    updatedAt: "updated_at",
  }
);
