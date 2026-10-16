import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import bcrypt from "bcryptjs";

export const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
      },
    },
    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("player", "master"),
      allowNull: false,
      defaultValue: "player",
    },
    perfil: {
      type: DataTypes.ENUM("jogador", "mestre"),
      allowNull: false,
      defaultValue: "jogador",
    },
    dadosMestre: {
      type: DataTypes.JSONB,
      allowNull: false,
      field: "dados_mestre",
      defaultValue: {
        tituloSessao: "Próxima sessão",
        anotacoesSessao: "",
        npcs: [],
        iniciativa: [],
        imagensMapas: [],
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

// Método auxiliar de instância para validar senha
User.prototype.checkPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Oculta a senha ao serializar para JSON
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};
