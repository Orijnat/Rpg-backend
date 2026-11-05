import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Session = sequelize.define(
  "Session",
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
    titulo: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    numero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "planejada",
      // planejada | em_andamento | concluida | cancelada
    },
    dataAgendada: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "data_agendada",
    },
    resumo: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    dadosExtras: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "dados_extras",
      // Estrutura esperada:
      // {
      //   cenas: [{ titulo, descricao, ordem, concluida }],
      //   objetivos: [{ descricao, concluido, tipo }],
      //   recompensas: { xp, itens: [], moedas: {}, descricao },
      //   registro: [{ timestamp, autor, evento }],
      //   lastModifiedBy: { id, name, role },
      //   lastModifiedAt: "ISO string"
      // }
    },
  },
  {
    // "sessoes" não existe no banco canônico: sessoes_autenticacao é a tabela
    // de tokens. Esta entidade é a sessão de jogo da campanha.
    tableName: "sessoes_jogo",
    underscored: true,
    timestamps: true,
  }
);
