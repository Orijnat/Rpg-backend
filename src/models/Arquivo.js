import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Metadados de uploads (galeria de anotações, anexos de mesa).
export const Arquivo = sequelize.define(
  "Arquivo",
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
      onDelete: "SET NULL",
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
    nomeOriginal: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "nome_original",
    },
    nomeInterno: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      field: "nome_interno",
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "mime_type",
    },
    tamanhoBytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "tamanho_bytes",
    },
    hashSha256: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "hash_sha256",
    },
    contexto: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: "anotacao",
    },
  },
  {
    tableName: "arquivos",
    underscored: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);
