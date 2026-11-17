import { Class, ClassAbility } from "../models/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Remove acentos e caixa para casar slugs/nomes digitados livremente ("bárbaro" → "barbaro").
export function normalizeClassKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Gera um slug único a partir de um nome (ex.: "Mago do Vazio" → "mago-do-vazio").
async function uniqueSlug(nome, excludeId = null) {
  const base = normalizeClassKey(nome)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "classe";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const where = { slug: candidate };
    const found = await Class.findOne({ where });
    if (!found || (excludeId && found.id === excludeId)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Resolve a classe informada no payload pelo id (UUID) ou pelo slug ("barbaro") / nome ("Bárbaro").
export async function resolveClasse(payload) {
  if (!payload) return null;
  const rawClassId = payload.classId ?? payload.classeId ?? null;
  const classId = rawClassId ? String(rawClassId).trim() : "";
  const key = normalizeClassKey(payload.class ?? payload.classe ?? payload.classeSlug ?? "");

  if (classId) {
    if (!UUID_RE.test(classId)) return null;
    const byId = await Class.findByPk(classId);
    if (byId) return byId;
  }
  if (key) {
    const all = await Class.findAll();
    return all.find((c) => normalizeClassKey(c.slug) === key || normalizeClassKey(c.nome) === key) ?? null;
  }
  return null;
}

export function classeExtras(classe) {
  return { class: classe.slug, hitDie: classe.dadoDeVida };
}

export async function slugForNome(nome, excludeId = null) {
  return uniqueSlug(nome, excludeId);
}

export async function listClassAbilities(classeId) {
  return ClassAbility.findAll({ where: { classeId }, order: [["nivel", "ASC"], ["nome", "ASC"]] });
}
