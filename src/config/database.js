import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha";
const isSupabase = typeof dbUrl === "string" && (dbUrl.includes("supabase.co") || dbUrl.includes("supabase.com") || dbUrl.includes("pooler.supabase.com"));
const useSsl = process.env.DB_SSL === "true" || isSupabase;

export const sequelize = new Sequelize(dbUrl, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: useSsl ? { require: true, rejectUnauthorized: false } : false,
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
