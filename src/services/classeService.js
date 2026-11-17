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

// Procura no catálogo (match sem acento/caixa por slug ou nome) a classe pelo nome
// digitado; se NÃO existir, CRIA uma entrada global (1d8 padrão, ordem 100, slug
// único) para que o mestre calibre em /admin/classes (Classes & Níveis).
// Retorna null quando o nome não contém nenhum caractere alfanumérico.
export async function findOrCreateClasseByNome(nome, criadoPorId = null) {
  const clean = String(nome ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const key = normalizeClassKey(clean);
  if (!key || !/[a-z0-9]/.test(key)) return null;

  const all = await Class.findAll();
  const found = all.find((c) => normalizeClassKey(c.slug) === key || normalizeClassKey(c.nome) === key);
  if (found) return found;

  const slug = await slugForNome(clean);
  const displayNome = clean
    .split(" ")
    .map((word) =>
      word === word.toLowerCase()
        ? word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1)
        : word,
    )
    .join(" ");
  try {
    return await Class.create({
      slug,
      nome: displayNome,
      dadoDeVida: "1d8",
      atributoPrimario: null,
      atributoSecundario: null,
      descricao: "Classe criada automaticamente no cadastro de um herói. Calibre o Dado de Vida, os atributos e as habilidades de nível no catálogo (Classes & Níveis).",
      ordem: 100,
      criadoPor: criadoPorId ?? null,
    });
  } catch (error) {
    // Corrida de cadastros simultâneos com o mesmo nome: reutiliza a classe criada
    if (error?.name === "SequelizeUniqueConstraintError") {
      return resolveClasse({ class: clean });
    }
    throw error;
  }
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
