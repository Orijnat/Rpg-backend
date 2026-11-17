import { sequelize, Class, ClassAbility } from "../models/index.js";
import { slugForNome } from "../services/classeService.js";

function abilityToPublic(a) {
  const r = a.toJSON ? a.toJSON() : a;
  return {
    id: r.id,
    nivel: r.nivel,
    reqLevel: r.nivel,
    name: r.nome,
    type: r.tipo,
    cost: r.custo ?? "",
    attr: r.atributo,
    rollFormula: r.formula ?? "",
    damageType: r.danoTipo ?? r.dano_tipo ?? "",
    range: r.alcance ?? "",
    description: r.descricao ?? "",
  };
}

function classeToPublic(classe, abilities) {
  const c = classe.toJSON ? classe.toJSON() : classe;
  const rawAbilities = abilities ?? (Array.isArray(c.abilities) ? c.abilities : c.abilities?.map?.((x) => x) ?? []);
  return {
    id: c.id,
    slug: c.slug,
    name: c.nome,
    hitDie: c.dadoDeVida ?? c.dado_de_vida,
    primaryAttribute: c.atributoPrimario ?? c.atributo_primario ?? null,
    secondaryAttribute: c.atributoSecundario ?? c.atributo_secundario ?? null,
    description: c.descricao ?? "",
    ordem: c.ordem ?? 0,
    abilities: rawAbilities.map(abilityToPublic),
  };
}

const includeAbilities = { model: ClassAbility, as: "abilities" };
const abilityOrder = [[{ model: ClassAbility, as: "abilities" }, "nivel", "ASC"], [{ model: ClassAbility, as: "abilities" }, "nome", "ASC"]];

async function findWithAbilities(id) {
  return Class.findByPk(id, { include: [includeAbilities], order: abilityOrder });
}

export const classController = {
  async list(req, res) {
    try {
      const rows = await Class.findAll({ include: [includeAbilities], order: [["ordem", "ASC"], ["nome", "ASC"], ...abilityOrder] });
      return res.json(rows.map((row) => classeToPublic(row, row.abilities)));
    } catch (error) {
      console.error("Erro ao listar classes:", error);
      return res.status(500).json({ error: "Erro ao carregar as classes." });
    }
  },

  async getById(req, res) {
    try {
      const row = await findWithAbilities(req.params.id);
      if (!row) return res.status(404).json({ error: "Classe não encontrada." });
      return res.json(classeToPublic(row, row.abilities));
    } catch (error) {
      console.error("Erro ao buscar classe:", error);
      return res.status(500).json({ error: "Erro ao buscar a classe." });
    }
  },

  async create(req, res) {
    try {
      const { abilities, ...fields } = req.body;
      const slug = await slugForNome(fields.nome);
      const created = await sequelize.transaction(async (transaction) => {
        const classe = await Class.create({
          slug,
          nome: fields.nome,
          dadoDeVida: fields.dadoDeVida.toLowerCase(),
          atributoPrimario: fields.atributoPrimario ?? null,
          atributoSecundario: fields.atributoSecundario ?? null,
          descricao: fields.descricao ?? null,
          ordem: fields.ordem ?? 0,
          criadoPor: req.user?.id ?? null,
        }, { transaction });
        if (Array.isArray(abilities) && abilities.length > 0) {
          await ClassAbility.bulkCreate(
            abilities.map((ability) => ({
              classeId: classe.id,
              nivel: ability.nivel,
              nome: ability.nome,
              tipo: ability.tipo ?? "ativa",
              custo: ability.custo ?? "",
              atributo: ability.atributo ?? "ESP",
              formula: ability.formula ?? "",
              danoTipo: ability.danoTipo ?? "",
              alcance: ability.alcance ?? "",
              descricao: ability.descricao ?? null,
            })),
            { transaction }
          );
        }
        return classe;
      });
      const full = await findWithAbilities(created.id);
      return res.status(201).json(classeToPublic(full, full.abilities));
    } catch (error) {
      console.error("Erro ao criar classe:", error);
      return res.status(400).json({ error: error.message || "Erro ao criar a classe." });
    }
  },

  async update(req, res) {
    try {
      const row = await Class.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: "Classe não encontrada." });
      const { abilities, ...fields } = req.body;
      await sequelize.transaction(async (transaction) => {
        await row.update({
          ...(fields.nome !== undefined ? { nome: fields.nome } : {}),
          ...(fields.dadoDeVida !== undefined ? { dadoDeVida: fields.dadoDeVida.toLowerCase() } : {}),
          ...(fields.atributoPrimario !== undefined ? { atributoPrimario: fields.atributoPrimario } : {}),
          ...(fields.atributoSecundario !== undefined ? { atributoSecundario: fields.atributoSecundario } : {}),
          ...(fields.descricao !== undefined ? { descricao: fields.descricao } : {}),
          ...(fields.ordem !== undefined ? { ordem: fields.ordem } : {}),
        }, { transaction });
        if (Array.isArray(abilities)) {
          await ClassAbility.destroy({ where: { classeId: row.id }, transaction });
          if (abilities.length > 0) {
            await ClassAbility.bulkCreate(
              abilities.map((ability) => ({
                classeId: row.id,
                nivel: ability.nivel,
                nome: ability.nome,
                tipo: ability.tipo ?? "ativa",
                custo: ability.custo ?? "",
                atributo: ability.atributo ?? "ESP",
                formula: ability.formula ?? "",
                danoTipo: ability.danoTipo ?? "",
                alcance: ability.alcance ?? "",
                descricao: ability.descricao ?? null,
              })),
              { transaction }
            );
          }
        }
      });
      const full = await findWithAbilities(row.id);
      return res.json(classeToPublic(full, full.abilities));
    } catch (error) {
      console.error("Erro ao atualizar classe:", error);
      return res.status(400).json({ error: error.message || "Erro ao atualizar a classe." });
    }
  },

  async remove(req, res) {
    try {
      const row = await Class.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: "Classe não encontrada." });
      await row.destroy();
      return res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover classe:", error);
      return res.status(500).json({ error: "Erro ao remover a classe." });
    }
  },
};
