// Valor máximo de um Dado de Vida (ex.: "1d10" → 10).
// Usado para a vida base inicial do herói e para validações de dado de vida.
const HIT_DIE_MAX_RE = /^(\d+)?d(\d+)/i;
export function hitDieMax(hitDie, fallback = 8) {
  const match = String(hitDie ?? "").trim().match(HIT_DIE_MAX_RE);
  if (!match) return fallback;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  if (!Number.isInteger(sides) || sides < 4 || sides > 100 || count < 1 || count > 100) return fallback;
  return count * sides;
}

// Validador de notação de Dado de Vida aceita (1d4…1d20, 2d6 etc.).
export function isValidHitDie(notation) {
  if (typeof notation !== "string") return false;
  const match = notation.trim().match(/^(\d+)?d(\d+)$/i);
  if (!match) return false;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  return Number.isInteger(count) && count >= 1 && count <= 100 && [4, 6, 8, 10, 12, 20, 100].includes(sides);
}
