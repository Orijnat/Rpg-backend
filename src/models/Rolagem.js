import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Histórico de rolagens de dados (auditoria de mesa e registro de sessão).
export const Rolagem = sequelize.define(
  "Rolagem",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "usuario_id",
      references: { model: "usuarios", key: "id" },
      onDelete: "CASCADE",
    },
    personagemId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "personagem_id",
      references: { model: "personagens", key: "id" },
      onDelete: "CASCADE",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
      references: { model: "campanhas", key: "id" },
      onDelete: "CASCADE",
    },
    encontroId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "encontro_id",
      references: { model: "encontros", key: "id" },
      onDelete: "SET NULL",
    },
    formula: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    expressao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    resultados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    kept: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    modifier: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    modo: {
      type: DataTypes.STRING(15),
      allowNull: false,
      defaultValue: "normal",
      validate: { isIn: [["normal", "advantage", "disadvantage"]] },
    },
    critico: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    falhaCritica: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "falha_critica",
    },
    contexto: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
  },
  {
    tableName: "rolagens",
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
