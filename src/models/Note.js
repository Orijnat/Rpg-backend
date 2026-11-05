import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Note = sequelize.define(
  "Note",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    autorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "autor_id",
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    personagemId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "personagem_id",
      references: {
        model: "personagens",
        key: "id",
      },
      onDelete: "CASCADE",
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
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "anotacao",
    },
    titulo: {
      type: DataTypes.STRING(180),
      allowNull: true,
    },
    conteudo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    privada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "anotacoes",
    underscored: true,
    timestamps: true,
  }
);
