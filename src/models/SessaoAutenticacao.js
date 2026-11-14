import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Sessão server-side (hash do token) — permite revogação e expiração reais do JWT.
export const SessaoAutenticacao = sequelize.define(
  "SessaoAutenticacao",
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
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: "token_hash",
    },
    ip: {
      type: DataTypes.INET,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "user_agent",
    },
    expiraAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expira_at",
    },
    revogadaAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "revogada_at",
    },
  },
  {
    tableName: "sessoes_autenticacao",
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
