import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Tabela `classes` (ver migration 20261117120000-classes.js): catálogo global
// de classes; qualquer mestre pode criar/editar/remover (referência dinâmica
// para fichas — trocar/editar o catálogo reflete em quem usa a classe).
export const Class = sequelize.define(
  "Class",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    nome: { type: DataTypes.STRING(80), allowNull: false },
    dadoDeVida: { type: DataTypes.STRING(10), allowNull: false, field: "dado_de_vida" },
    atributoPrimario: { type: DataTypes.STRING(3), allowNull: true, field: "atributo_primario" },
    atributoSecundario: { type: DataTypes.STRING(3), allowNull: true, field: "atributo_secundario" },
    descricao: { type: DataTypes.TEXT, allowNull: true },
    ordem: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    criadoPor: { type: DataTypes.UUID, allowNull: true, field: "criado_por" },
  },
  {
    tableName: "classes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
