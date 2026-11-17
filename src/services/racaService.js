import { Race } from "../models/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve a raça informada no payload pelo id (UUID) ou pelo slug ("elfo").
// Prioridade para raceId; o slug é aceito para compatibilidade com clientes antigos.
export async function resolveRaca(payload) {
  if (!payload) return null;
  const raceId = payload.raceId ? String(payload.raceId).trim() : "";
  const slug = payload.race ? String(payload.race).trim().toLowerCase() : "";

  if (raceId) {
    if (!UUID_RE.test(raceId)) return null;
    const byId = await Race.findByPk(raceId);
    if (byId) return byId;
  }
  if (slug) {
    const bySlug = await Race.findOne({ where: { slug } });
    if (bySlug) return bySlug;
  }
  return null;
}

export function racaExtras(raca) {
  return { race: raca.slug, hitDie: raca.dadoDeVida };
}

// Reexportado de services/hitDie.js (fonte única). Mantido para compatibilidade.
export { hitDieMax } from "./hitDie.js";
