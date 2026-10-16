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
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "usuario_id",
      references: {
        model: "usuarios",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      field: "nome",
      defaultValue: "Novo Herói",
    },
    descricao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "pontos_vida",
      defaultValue: 70,
    },
    hpMax: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "pontos_vida_maximo",
      defaultValue: 70,
    },
    level: {
      type: DataTypes.INTEGER,
      field: "nivel",
      defaultValue: 1,
    },
    job: {
      type: DataTypes.STRING(100),
      field: "classe",
      defaultValue: "",
    },
    experiencia: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    forca: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    destreza: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 16 },
    constituicao: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    sabedoria: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 12 },
    espirito: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    carisma: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    inteligencia: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    age: {
      type: DataTypes.STRING(80),
      field: "idade",
      defaultValue: "",
    },
    eyes: {
      type: DataTypes.STRING(80),
      field: "olhos",
      defaultValue: "",
    },
    height: {
      type: DataTypes.STRING(40),
      field: "altura",
      defaultValue: "",
    },
    skin: {
      type: DataTypes.STRING(80),
      field: "pele",
      defaultValue: "",
    },
    weight: {
      type: DataTypes.STRING(40),
      field: "peso",
      defaultValue: "",
    },
    hair: {
      type: DataTypes.STRING(80),
      field: "cabelo",
      defaultValue: "",
    },
    appearance: {
      type: DataTypes.TEXT,
      field: "aparencia",
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
    pericias: {
      type: DataTypes.JSONB,
      allowNull: false,
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
    moedas: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { latina: 0, ouro: 0, prata: 0, cobre: 0 },
    },
    itensInventario: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "itens_inventario",
      defaultValue: [],
    },
    contratosDados: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "contratos_dados",
      defaultValue: [],
    },
    jogadores: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    npcs: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    imagensAnotacoes: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "imagens_anotacoes",
      defaultValue: [],
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
    dadosExtras: {
      type: DataTypes.JSONB,
      field: "dados_extras",
      defaultValue: {},
    },
  },
  {
    tableName: "personagens",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);
