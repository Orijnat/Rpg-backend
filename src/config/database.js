import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha";

export const sequelize = new Sequelize(dbUrl, {
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? (msg) => console.log(`[SQL] ${msg}`) : false,
  dialectOptions: {
    ssl: process.env.DB_SSL === "true" ? { require: true, rejectUnauthorized: false } : false,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexão com o PostgreSQL estabelecida com sucesso.");
    return true;
  } catch (error) {
    console.error("❌ Erro ao conectar ao PostgreSQL:", error.message);
    return false;
  }
}
