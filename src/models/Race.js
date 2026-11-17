import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Tabela `racas` (ver migration 20261117000000-racas.js): a raça é a fonte
// de verdade dos status base, do Dado de Vida e das características.
export const Race = sequelize.define(
  "Race",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    slug: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    nome: { type: DataTypes.STRING(80), allowNull: false },
    dadoDeVida: { type: DataTypes.STRING(10), allowNull: false, field: "dado_de_vida" },
    forca: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    destreza: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    constituicao: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    sabedoria: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    espirito: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    carisma: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    inteligencia: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 10 },
    traco: { type: DataTypes.TEXT, allowNull: true },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "racas",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
