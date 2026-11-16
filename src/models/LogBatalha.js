import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Log persistente de batalha: toda ação relevante feita por jogadores e pelo
// mestre durante um encontro (rolagens, dano/cura, iniciativa, condições, turnos).
// Diferente de dadosExtras.logHistorico (JSONB, teto de 100), esta tabela é a
// trilha definitiva da batalha e não expira.
export const LogBatalha = sequelize.define(
  "LogBatalha",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    encontroId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "encontro_id",
      references: { model: "encontros", key: "id" },
      onDelete: "CASCADE",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "campanha_id",
      references: { model: "campanhas", key: "id" },
      onDelete: "CASCADE",
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "usuario_id",
      references: { model: "usuarios", key: "id" },
      onDelete: "SET NULL",
    },
    autor: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    papel: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "jogador",
      validate: { isIn: [["mestre", "jogador", "sistema"]] },
    },
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      validate: {
        isIn: [[
          "rolagem", "dano", "cura", "iniciativa", "condicao", "turno",
          "entrada", "encontro", "recursos", "sistema",
        ]],
      },
    },
    mensagem: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    dados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    rodada: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 9999 },
    },
  },
  {
    tableName: "log_batalha",
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
