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
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    reward: {
      type: DataTypes.STRING(100),
      defaultValue: "???",
    },
    done: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "contracts",
    timestamps: true,
  }
);
