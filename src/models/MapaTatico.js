import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Mapa tático compartilhado por campanha (fundo + tokens de combate).
export const MapaTatico = sequelize.define(
  "MapaTatico",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: "campanha_id",
      references: { model: "campanhas", key: "id" },
      onDelete: "CASCADE",
    },
    titulo: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: "Campo de Batalha",
    },
    arquivoFundoId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "arquivo_fundo_id",
      references: { model: "arquivos", key: "id" },
      onDelete: "SET NULL",
    },
    urlFundo: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "url_fundo",
    },
    gradePx: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 40,
      field: "grade_px",
      validate: { min: 10, max: 200 },
    },
    gradeVisivel: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "grade_visivel",
    },
    tokens: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    updatedPorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "updated_por_id",
      references: { model: "usuarios", key: "id" },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "mapa_tatico",
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
