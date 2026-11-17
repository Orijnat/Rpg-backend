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
      type: DataTypes.STRING(120),
      allowNull: false,
      field: "nome",
      validate: {
        len: [1, 120],
      },
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "senha_hash",
    },
    perfil: {
      type: DataTypes.ENUM({
        values: ["jogador", "mestre"],
        name: "perfil_usuario",
      }),
      allowNull: false,
      defaultValue: "jogador",
      field: "perfil",
    },
    role: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("perfil") === "mestre" ? "master" : "player";
      },
      set(val) {
        this.setDataValue("perfil", val === "master" || val === "mestre" ? "mestre" : "jogador");
      },
    },
    ativo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "ativo",
    },
    ultimoLoginAt: {
      type: DataTypes.DATE,
      field: "ultimo_login_at",
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
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "email_verified",
    },
    verificationTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: null,
      field: "verification_token_hash",
    },
    verificationExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "verification_expires_at",
    },
    verificationCodeHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: null,
      field: "verification_code_hash",
    },
    verificationCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "verification_code_expires_at",
    },
    verificationAttempts: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      defaultValue: 0,
      field: "verification_attempts",
    },
    resetTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: true,
      defaultValue: null,
      field: "reset_token_hash",
    },
    resetTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "reset_token_expires_at",
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
      field: "password_changed_at",
    },
  },
  {
    tableName: "usuarios",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    hooks: {
      beforeCreate: async (user) => {
        if (user.password && !user.password.startsWith("$2a$") && !user.password.startsWith("$2b$") && !user.password.startsWith("$2y$")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          if (user.password && !user.password.startsWith("$2a$") && !user.password.startsWith("$2b$") && !user.password.startsWith("$2y$")) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
          }
        }
      },
    },
  }
);

// Método auxiliar de instância para validar senha
User.prototype.checkPassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Oculta segredos ao serializar para JSON e expõe role
User.prototype.toJSON = function () {
  const values = { ...this.get() };
  values.role = values.perfil === "mestre" ? "master" : "player";
  delete values.password;
  delete values.senha_hash;
  delete values.verificationTokenHash;
  delete values.verificationExpiresAt;
  delete values.verificationCodeHash;
  delete values.verificationCodeExpiresAt;
  delete values.verificationAttempts;
  delete values.resetTokenHash;
  delete values.resetTokenExpiresAt;
  return values;
};
