import test from "node:test";
import assert from "node:assert/strict";
import { parsePaginationQuery } from "../src/services/pagination.js";
import { isMaster } from "../src/services/campaignAccess.js";

test("parser de paginação aplica defaults, offset e teto", () => {
  assert.deepEqual(parsePaginationQuery({ page: "3", limit: "500", search: "  mago " }),
    { requested: true, page: 3, limit: 100, offset: 200, search: "mago", searchFields: [] });
});

test("sem parâmetros preserva resposta legada", () => {
  assert.equal(parsePaginationQuery({}).requested, false);
  assert.equal(parsePaginationQuery({ q: "guerreiro" }).search, "guerreiro");
});

test("guard de perfil reconhece somente aliases de mestre", () => {
  assert.equal(isMaster({ perfil: "mestre" }), true);
  assert.equal(isMaster({ role: "master" }), true);
  assert.equal(isMaster({ perfil: "jogador", role: "player" }), false);
});
