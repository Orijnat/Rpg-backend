import test from "node:test";
import assert from "node:assert/strict";

import { publicCharacter } from "../src/services/characterPublic.js";

test("publicCharacter não vaza a associação `classe` como objeto (Zod espera texto(80))", () => {
  const output = publicCharacter({
    id: "b7b2e000-0000-4000-8000-000000000001",
    name: "Herói de Teste",
    experiencia: 120,
    classeId: null,
    classe: {
      id: "b7b2e000-0000-4000-8000-000000000077",
      slug: "bruxeiro",
      nome: "Bruxeiro",
      dadoDeVida: "1d8",
    },
    raca: {
      id: "b7b2e000-0000-4000-8000-000000000088",
      slug: "humano",
      nome: "Humano",
      dado_de_vida: "1d10",
    },
    dadosExtras: { class: "bruxeiro", race: "humano" },
    updated_at: new Date("2026-11-17T00:00:00.000Z"),
  });

  assert.equal(output.classe, undefined, "o objeto da associação `classe` deve ser removido");
  assert.equal(output.classId, "b7b2e000-0000-4000-8000-000000000077");
  assert.equal(output.classSlug, "bruxeiro");
  assert.equal(output.className, "Bruxeiro");
  assert.equal(output.hitDie, "1d8");
  assert.equal(output.xp, 120);
});
