require("dotenv").config();

const dbUrl = process.env.DATABASE_URL || "";
const isSupabase = typeof dbUrl === "string" && (
  dbUrl.includes("supabase.co") ||
  dbUrl.includes("supabase.com") ||
  dbUrl.includes("pooler.supabase.com")
);
const useSsl = process.env.DB_SSL === "true" || isSupabase;
const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

module.exports = {
  development: {
    url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha",
    dialect: "postgres",
    logging: false,
    dialectOptions,
  },
  test: {
    url: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha_test",
    dialect: "postgres",
    logging: false,
    dialectOptions,
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    logging: false,
    dialectOptions,
  },
};
