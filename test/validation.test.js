import test from "node:test";
import assert from "node:assert/strict";
import { campanhaSchema, fichaSchema, loginSchema, registroSchema } from "../src/schemas/apiSchemas.js";

test("login rejeita senha ausente e campos desconhecidos", () => {
  const result = loginSchema.safeParse({ login: "mestre", password: "segredo", admin: true });
  assert.equal(result.success, false);
});

test("registro aceita perfil, role e código de convite da mesa", () => {
  const result = registroSchema.safeParse({
    username: "jogador1",
    email: "jogador1@exemplo.com",
    password: "senhaSegura123",
    characterName: "Eldrin",
    characterJob: "Guerreiro",
    perfil: "jogador",
    role: "player",
    inviteCode: "INV-VALE-100",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.inviteCode, "INV-VALE-100");
  assert.equal(result.data.perfil, "jogador");
});

test("ficha rejeita atributos fora do intervalo d20", () => {
  const result = fichaSchema.safeParse({ forca: 31, destreza: 10 });
  assert.equal(result.success, false);
});

test("campanha aceita atualização parcial válida", () => {
  const result = campanhaSchema.safeParse({ estado: "ativa", descricao: "Aventura" });
  assert.equal(result.success, true);
});
