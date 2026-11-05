import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "usuario_id",
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
      references: {
        model: "campanhas",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    acao: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entidade: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    entidadeId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "entidade_id",
    },
    dados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    tableName: "auditoria",
    underscored: true,
    timestamps: true,
    updatedAt: false,
  }
);

export async function registrarAuditoria({ usuarioId, campanhaId, acao, entidade, entidadeId, dados = {}, ip = null }) {
  try {
    return await AuditLog.create({
      usuarioId,
      campanhaId,
      acao,
      entidade,
      entidadeId,
      dados,
      ip,
    });
  } catch (err) {
    console.error("Falha ao registrar auditoria:", err.message);
    return null;
  }
}
