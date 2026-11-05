import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const CampaignMember = sequelize.define(
  "CampaignMember",
  {
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: "campanha_id",
      references: {
        model: "campanhas",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      field: "usuario_id",
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    papel: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "jogador",
    },
    bloqueado: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    entrouAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "entrou_at",
    },
  },
  {
    tableName: "membros_campanha",
    underscored: true,
    timestamps: false,
  }
);
