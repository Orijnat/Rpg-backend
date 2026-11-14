#!/usr/bin/env node
/**
 * Runner de migrações do banco — sem sequelize-cli (ESM/CJS frágil).
 *
 * Etapas (todas idempotentes):
 *   1. Se a tabela `usuarios` NÃO existir, aplica database/banco.sql (baseline,
 *      em transação; pula completamente em bancos já provisionados).
 *   2. Aplica database/banco_v2.sql (auto-transacional, IF NOT EXISTS em tudo).
 *   3. Aplica as migrações incrementais versionadas em database/migrations/.
 *   4. Registra as etapas aplicadas em `sequelize_meta` (compatível com sequelize-cli).
 *
 * Uso: node database/migrate.js   (usa DATABASE_URL do ambiente/.env)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha";
const isSupabase = /supabase\.co|supabase\.com|pooler\.supabase\.com/.test(dbUrl);
const useSsl = process.env.DB_SSL === "true" || isSupabase;

const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");
const BANCO_SQL = path.resolve(__dirname, "banco.sql");
const BANCO_V2_SQL = path.resolve(__dirname, "banco_v2.sql");

async function main() {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  console.log("🔌 Conectado ao PostgreSQL.");

  // 1. Baseline — somente em banco novo/vazio de schema da aplicação
  const { rows } = await client.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') AS existe",
  );
  if (rows[0]?.existe) {
    console.log("✅ Baseline (banco.sql) já aplicada — pulando (evita apagar tabelas legadas por engano).");
  } else {
    console.log("🆕 Banco sem schema: aplicando baseline banco.sql em transação...");
    const sql = fs.readFileSync(BANCO_SQL, "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "CREATE TABLE IF NOT EXISTS sequelize_meta (name varchar(255) PRIMARY KEY)",
      );
      await client.query(
        "INSERT INTO sequelize_meta (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
        ["20261104120000-inicial.js"],
      );
      await client.query("COMMIT");
      console.log("✅ Baseline aplicada.");
    } catch (error) {
      await client.query("ROLLBACK");
      throw new Error(`Falha na baseline (rollback feito): ${error.message}`);
    }
  }

  // 2. Reformulação v2 (arquivo auto-transacional e idempotente)
  console.log("🔁 Aplicando banco_v2.sql...");
  await client.query(fs.readFileSync(BANCO_V2_SQL, "utf8"));
  await client.query("CREATE TABLE IF NOT EXISTS sequelize_meta (name varchar(255) PRIMARY KEY)");
  await client.query(
    "INSERT INTO sequelize_meta (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
    ["20261106150000-banco-v2-reformulacao.js"],
  );
  console.log("✅ banco_v2.sql aplicada.");

  // 3. Migrações incrementais (ordem alfabética = ordem cronológica pelos prefixos de data)
  const incrementais = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".js"))
    .filter((file) => !["20261104120000-inicial.js", "20261106150000-banco-v2-reformulacao.js"].includes(file))
    .sort();

  for (const file of incrementais) {
    console.log(`🔁 Aplicando migração incremental ${file}...`);
    const migration = await import(path.resolve(MIGRATIONS_DIR, file));
    const queryInterface = {
      query: (sql, options) => client.query(sql),
      sequelize: { query: (sql) => client.query(sql) },
    };
    await migration.up(queryInterface);
    await client.query(
      "INSERT INTO sequelize_meta (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [file],
    );
    console.log(`✅ ${file} aplicada.`);
  }

  await client.end();
  console.log("🎉 Migrações concluídas.");
}

main().catch((error) => {
  console.error("❌ Falha nas migrações:", error.message);
  process.exit(1);
});
