import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Vendedor/tenda gerenciado pelo mestre no Mercado do Mundo.
export const MercadoVendedor = sequelize.define(
  "MercadoVendedor",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    criadoPorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "criado_por_id",
      references: { model: "usuarios", key: "id" },
      onDelete: "CASCADE",
    },
    nome: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(160),
      allowNull: true,
      defaultValue: "",
    },
    regiao: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    humor: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    especialidade: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: "",
    },
  },
  {
    tableName: "mercado_vendedores",
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
