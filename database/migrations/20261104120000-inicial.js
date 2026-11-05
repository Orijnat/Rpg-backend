import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));

export async function up(queryInterface) {
  const sql = await fs.readFile(path.resolve(diretorioAtual, "..", "banco.sql"), "utf8");
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(sql, { transaction });
  });
}

export async function down() {
  throw new Error("A migration inicial é baseline; restauração deve ser feita por backup.");
}
