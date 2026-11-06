import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import bcrypt from "bcryptjs";

// Os atributos (forca, destreza…) vivem em `atributos_personagem` (hasOne).
// Dados flexíveis legados (bankSlots, notas, montaria, moedas, itens, etc.)
// ficam no JSONB `dados_extras` para não exigir migrations adicionais imediatas.
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
      references: { model: "usuarios", key: "id" },
      onDelete: "CASCADE",
    },
    campanhaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "campanha_id",
    },
    // ── Identidade ─────────────────────────────────────────────────────────
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      field: "nome",
      defaultValue: "Novo Herói",
    },
    descricao: { type: DataTypes.TEXT,        allowNull: true },
    // ── Vida ───────────────────────────────────────────────────────────────
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
    // ── Progressão ─────────────────────────────────────────────────────────
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
    experiencia: { type: DataTypes.INTEGER, defaultValue: 0 },
    // ── Descrição física ───────────────────────────────────────────────────
    age:        { type: DataTypes.STRING(80),  field: "idade",   defaultValue: "" },
    eyes:       { type: DataTypes.STRING(80),  field: "olhos",   defaultValue: "" },
    height:     { type: DataTypes.STRING(40),  field: "altura",  defaultValue: "" },
    skin:       { type: DataTypes.STRING(80),  field: "pele",    defaultValue: "" },
    weight:     { type: DataTypes.STRING(40),  field: "peso",    defaultValue: "" },
    hair:       { type: DataTypes.STRING(80),  field: "cabelo",  defaultValue: "" },
    appearance: { type: DataTypes.TEXT,        field: "aparencia", defaultValue: "" },
    // ── Extensões flexíveis (legado + extras) ──────────────────────────────
    // Tudo que ainda não tem coluna própria vai em dados_extras:
    // bankSlots, bankPassword, notes, roomNotes, mountName/HP/HpMax/Notes,
    // moedas/currencies, itensInventario, contratosDados, pericias/skills,
    // imagensAnotacoes, jogadores, npcs, attributes (mirror), customClass…
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
