import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));

// Aplica banco_v2.sql (idempotente) dentro de UMA transação.
// Qualquer falha aborta tudo; sem estados parciais.
export async function up(queryInterface) {
  const sql = await fs.readFile(path.resolve(diretorioAtual, "..", "banco_v2.sql"), "utf8");
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(sql, { transaction });
  });
}

// Sem down destrutivo: reverter aqui apagaria dados reais do jogador/mestre.
// Restauração deve vir de backup (ver skill banco-de-dados-ops).
export async function down() {
  throw new Error("Migration de reformulação não possui down automático — restaure a partir de backup.");
}
