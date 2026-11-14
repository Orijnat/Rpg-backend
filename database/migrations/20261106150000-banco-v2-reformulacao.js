import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));

export async function up(queryInterface) {
  const sql = await fs.readFile(path.resolve(diretorioAtual, "..", "banco_v2.sql"), "utf8");
  // Executa o script banco_v2.sql idempotente
  await queryInterface.sequelize.query(sql);
}

export async function down(queryInterface) {
  // Reversibilidade conforme skill banco-de-dados-ops
  await queryInterface.sequelize.query(`
    DROP TABLE IF EXISTS auditoria CASCADE;
    DROP TABLE IF EXISTS iniciativas CASCADE;
    DROP TABLE IF EXISTS encontros CASCADE;
    DROP TABLE IF EXISTS npcs CASCADE;
    DROP TABLE IF EXISTS sessoes_jogo CASCADE;
    DROP TABLE IF EXISTS cofres CASCADE;
    DROP TABLE IF EXISTS itens_inventario CASCADE;
    DROP TABLE IF EXISTS pericias_personagem CASCADE;
  `);
}
