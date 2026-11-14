import test from "node:test";
import assert from "node:assert/strict";
import { toCsv, csvEscape, characterToSheetRows, npcToSheetRows, campaignToSheetRows } from "../src/services/csvExport.js";

test("csvEscape trata aspas e delimitadores", () => {
  assert.equal(csvEscape("plain"), "plain");
  assert.equal(csvEscape('com "aspas"'), '"com ""aspas"""');
  assert.equal(csvEscape("a;b"), '"a;b"');
  assert.equal(csvEscape("linha\nquebrada"), '"linha\nquebrada"');
  assert.equal(csvEscape(null), "");
  assert.equal(csvEscape(undefined), "");
});

test("toCsv usa delimitador ; e CRLF", () => {
  const csv = toCsv([["a", "b"], ["1", "2"]]);
  assert.equal(csv, "a;b\r\n1;2");
});

test("characterToSheetRows inclui cabeçalho, atributos e perícias", () => {
  const rows = characterToSheetRows({
    name: "Aragorn", job: "Ranger", level: 5, experiencia: 1000, hp: 40, hpMax: 52,
    FOR: 16, DES: 14, CON: 14, SAB: 12, ESP: 10, CAR: 10, INT: 10,
    pericias: [
      { name: "Atletismo", treinada: false, trained: true, bonus: 4 },
      { name: "Furtividade", treinada: false, trained: false, bonus: null },
    ],
    dadosExtras: { peMax: 9, peCurrent: 9, bpMax: 4, bpCurrent: 4, insanityMax: 0, armorClass: 3, initiative: 2, hitDie: "1d10" },
  });
  const flat = rows.map((r) => r.join(" ")).join("\n");
  assert.match(flat, /Aragorn/);
  assert.match(flat, /Atributo/);
  assert.match(flat, /Atletismo/);
  assert.equal(rows.find((r) => r[0] === "CON")?.[2], "+2"); // CON 14 → mod +2
  assert.match(flat, /1d10/);
});

test("npcToSheetRows gera cabeçalho e uma linha por NPC", () => {
  const rows = npcToSheetRows([
    { nome: "Xamã", papel: "Inimigo", hp: 30, hpMax: 30, dadosExtras: { ca: 14, iniciativa: 12, status: "Ativo", tags: ["chefe", "morto-vivo"] } },
  ]);
  assert.equal(rows[1][0], "Nome");
  assert.equal(rows[2][0], "Xamã");
  assert.equal(rows[2][6], "chefe, morto-vivo");
});

test("campaignToSheetRows consolida membros, heróis e contagens", () => {
  const rows = campaignToSheetRows({
    campanha: { nome: "Mesa", cenario: "Vale", estado: "ativa", codigoConvite: "ABC123" },
    membros: [{ usuarioId: "u1", papel: "mestre", bloqueado: false }],
    personagens: [{ name: "Herói", level: 3, customClass: "Mago", hp: 20, hpMax: 25 }],
    contagens: { npcs: 2, encontros: 1 },
  });
  const flat = rows.map((r) => r.join(" ")).join("\n");
  assert.match(flat, /Mesa/);
  assert.match(flat, /ABC123/);
  assert.match(flat, /Herói/);
  assert.match(flat, /2/);
});
