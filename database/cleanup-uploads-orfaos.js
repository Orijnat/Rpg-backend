#!/usr/bin/env node
// Remove arquivos órfãos (sem linha no banco) e metadados de arquivos ausentes no disco.
// Uso: node database/cleanup-uploads-orfaos.js [--dry-run]
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { sequelize } from "../src/config/database.js";
import { Arquivo } from "../src/models/index.js";
import { UPLOAD_ROOT } from "../src/services/uploadService.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  await sequelize.authenticate();
  const emDisco = await fs.readdir(UPLOAD_ROOT).catch(() => []);
  const noBanco = await Arquivo.findAll({ attributes: ["id", "nomeInterno"] });
  const noBancoSet = new Set(noBanco.map((a) => a.nomeInterno));

  let removidosDisco = 0;
  for (const arquivo of emDisco) {
    if (arquivo.startsWith(".")) continue;
    if (!noBancoSet.has(arquivo)) {
      console.log(`[órfão-em-disco] ${arquivo}`);
      if (!dryRun) await fs.unlink(path.join(UPLOAD_ROOT, arquivo)).catch(() => {});
      removidosDisco += 1;
    }
  }

  let removidosBanco = 0;
  for (const meta of noBanco) {
    if (!emDisco.includes(meta.nomeInterno)) {
      console.log(`[órfão-no-banco] ${meta.id} (${meta.nomeInterno})`);
      if (!dryRun) await Arquivo.destroy({ where: { id: meta.id } });
      removidosBanco += 1;
    }
  }

  console.log(`\nResumo${dryRun ? " (dry-run)" : ""}: ${removidosDisco} arquivo(s) órfão(s) em disco, ${removidosBanco} metadado(s) sem arquivo.`);
  await sequelize.close();
}

main().catch((error) => {
  console.error("Falha na limpeza de uploads:", error);
  process.exit(1);
});
