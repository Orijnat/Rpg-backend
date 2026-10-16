import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Contract = sequelize.define(
  "Contract",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    characterId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "personagem_id",
      references: {
        model: "personagens",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
    },
    title: {
      type: DataTypes.STRING(180),
      allowNull: false,
      field: "titulo",
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reward: {
      type: DataTypes.TEXT,
      defaultValue: "???",
      field: "recompensa",
    },
    estado: {
      type: DataTypes.ENUM({
        values: ["rascunho", "ativo", "concluido", "cancelado"],
        name: "estado_contrato",
      }),
      defaultValue: "ativo",
      field: "estado",
    },
    done: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("estado") === "concluido";
      },
      set(val) {
        this.setDataValue("estado", val ? "concluido" : "ativo");
      },
    },
  },
  {
    tableName: "contratos",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

Contract.prototype.toJSON = function () {
  const values = { ...this.get() };
  values.done = this.estado === "concluido";
  return values;
};
