import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Item em estoque no Mercado do Mundo (gerenciado pelo mestre).
// `regiao` e `vendedor` são desnormalizados no próprio item (o formulário
// aceita textos livres), por isso não há FK obrigatória com mercado_vendedores.
export const MercadoItem = sequelize.define(
  "MercadoItem",
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
    regiao: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    vendedor: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    quantidade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 0 },
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    moeda: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "ouro",
      validate: { isIn: [["ouro", "prata", "cobre", "latina"]] },
    },
    peso: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    raridade: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Comum",
      validate: { isIn: [["Comum", "Incomum", "Raro", "Muito Raro", "Lendário"]] },
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
    requisitos: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
  },
  {
    tableName: "mercado_itens",
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
