#!/usr/bin/env node
// Backup lógico do PostgreSQL via pg_dump (retenção configurável por BACKUP_RETENTION_DAYS, padrão 30).
// Uso: node database/backup.js            → gera backups/backup-AAAAMMDD-HHMMSS.sql.gz
//      node database/backup.js --restore arquivo.sql.gz   (restauração guiada; pede confirmação "RESTAURAR")
//      node database/backup.js --prune    → remove backups mais antigos que a retenção
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Transform } from "node:stream";

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/rpg_ficha";
const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || "backups");
const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));

const [, , flag] = process.argv;

if (flag === "--restore") {
  const arquivo = process.argv[3];
  if (!arquivo) {
    console.error("Uso: node database/backup.js --restore caminho/para/backup.sql.gz");
    process.exit(1);
  }
  console.error(`\n⚠️  A restauração SOBRESCREVE dados em ${dbUrl}.`);
  console.error('Para continuar, exporte CONFIRMO_RESTAURACAO="RESTAURAR" e rode novamente com --restore.\n');
  if (process.env.CONFIRMO_RESTAURACAO !== "RESTAURAR") process.exit(2);
  const gunzip = zlib.createGunzip();
  const input = fs.createReadStream(arquivo);
  const psql = spawn("psql", [dbUrl, "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "inherit", "inherit"] });
  // pg_dump de servidores mais novos pode emitir SET de GUCs desconhecidos em servidores antigos:
  // filtra as linhas "SET <guc> ..." que o servidor de destino não entende.
  const UNSUPPORTED_GUC_NAMES = ["transaction_timeout"];
  let pending = "";
  const filter = new Transform({
    transform(chunk, _encoding, callback) {
      const lines = (pending + chunk.toString("utf8")).split("\n");
      pending = lines.pop(); // guarda possível linha parcial para o próximo chunk
      const payload = lines
        .filter((line) => !UNSUPPORTED_GUC_NAMES.some((name) => line.trimStart().startsWith(`SET ${name}`)))
        .join("\n");
      callback(null, payload ? Buffer.from(payload + "\n") : Buffer.alloc(0));
    },
    flush(callback) {
      if (pending && !UNSUPPORTED_GUC_NAMES.some((name) => pending.trimStart().startsWith(`SET ${name}`))) {
        callback(null, Buffer.from(pending));
        return;
      }
      callback();
    },
  });
  input.pipe(gunzip).pipe(filter).pipe(psql.stdin);
  psql.on("exit", (code) => process.exit(code ?? 1));
} else if (flag === "--prune") {
  fs.mkdirSync(backupDir, { recursive: true });
  const limite = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removidos = 0;
  for (const nome of fs.readdirSync(backupDir)) {
    if (!nome.startsWith("backup-") || !nome.endsWith(".sql.gz")) continue;
    const stat = fs.statSync(path.join(backupDir, nome));
    if (stat.mtimeMs < limite) {
      fs.unlinkSync(path.join(backupDir, nome));
      console.log(`removido ${nome}`);
      removidos += 1;
    }
  }
  console.log(`\n${removidos} backup(s) removido(s) (retenção ${retentionDays} dias).`);
} else {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
  const destino = path.join(backupDir, `backup-${stamp}.sql.gz`);
  const dump = spawnSync("pg_dump", ["--no-owner", "--no-privileges", dbUrl], { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 });
  if (dump.status !== 0 || !dump.stdout) {
    console.error("pg_dump falhou:", dump.stderr?.toString());
    process.exit(1);
  }
  fs.writeFileSync(destino, zlib.gzipSync(dump.stdout, { level: 9 }));
  const sizeMb = (fs.statSync(destino).size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Backup criado: ${path.relative(process.cwd(), destino)} (${sizeMb} MB)`);
}
