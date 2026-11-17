import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

// Tabela `classe_habilidades`: habilidades de nível fixas por classe/nível.
// A ficha apenas as referencia (não são copiadas).
export const ClassAbility = sequelize.define(
  "ClassAbility",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    classeId: { type: DataTypes.UUID, allowNull: false, field: "classe_id" },
    nivel: { type: DataTypes.SMALLINT, allowNull: false },
    nome: { type: DataTypes.STRING(120), allowNull: false },
    tipo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "ativa" },
    custo: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "" },
    atributo: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "ESP" },
    formula: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
    danoTipo: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "", field: "dano_tipo" },
    alcance: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
    descricao: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "classe_habilidades",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
