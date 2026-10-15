import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Character = sequelize.define(
  "Character",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: "Novo Herói",
    },
    hp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
    },
    hpMax: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 70,
    },
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    job: {
      type: DataTypes.STRING(80),
      defaultValue: "",
    },
    age: {
      type: DataTypes.STRING(20),
      defaultValue: "",
    },
    eyes: {
      type: DataTypes.STRING(50),
      defaultValue: "",
    },
    height: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    skin: {
      type: DataTypes.STRING(50),
      defaultValue: "",
    },
    weight: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    hair: {
      type: DataTypes.STRING(50),
      defaultValue: "",
    },
    appearance: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    attributes: {
      type: DataTypes.JSONB,
      defaultValue: {
        FOR: 14,
        DES: 16,
        CON: 14,
        SAB: 12,
        ESP: 14,
        CAR: 10,
        INT: 10,
      },
    },
    skills: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    currencies: {
      type: DataTypes.JSONB,
      defaultValue: {
        latina: 0,
        ouro: 0,
        prata: 0,
        cobre: 0,
      },
    },
    bankSlots: {
      type: DataTypes.JSONB,
      defaultValue: Array.from({ length: 80 }, () => ({ item: "" })),
    },
    bankPassword: {
      type: DataTypes.STRING(50),
      defaultValue: "133313",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    roomNotes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    mountName: {
      type: DataTypes.STRING(100),
      defaultValue: "",
    },
    mountHP: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
    },
    mountHPMax: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
    },
    mountNotes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  },
  {
    tableName: "characters",
    timestamps: true,
  }
);
