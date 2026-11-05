import test from "node:test";
import assert from "node:assert/strict";
import { campanhaSchema, fichaSchema, loginSchema } from "../src/schemas/apiSchemas.js";

test("login rejeita senha ausente e campos desconhecidos", () => {
  const result = loginSchema.safeParse({ login: "mestre", password: "segredo", admin: true });
  assert.equal(result.success, false);
});

test("ficha rejeita atributos fora do intervalo d20", () => {
  const result = fichaSchema.safeParse({ forca: 31, destreza: 10 });
  assert.equal(result.success, false);
});

test("campanha aceita atualização parcial válida", () => {
  const result = campanhaSchema.safeParse({ estado: "ativa", descricao: "Aventura" });
  assert.equal(result.success, true);
});
