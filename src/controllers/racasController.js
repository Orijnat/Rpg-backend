import { Race } from "../models/index.js";

const ATRIBUTOS = ["forca", "destreza", "constituicao", "sabedoria", "espirito", "carisma", "inteligencia"];
const ALIASES = ["FOR", "DES", "CON", "SAB", "ESP", "CAR", "INT"];

function racaToPublic(r) {
  const raw = r.toJSON ? r.toJSON() : r;
  const base = {};
  ATRIBUTOS.forEach((attr, index) => {
    base[ALIASES[index]] = raw[attr];
  });
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.nome,
    hitDie: raw.dadoDeVida ?? raw.dado_de_vida,
    base,
    trait: raw.traco ?? "",
    ordem: raw.ordem ?? 0,
  };
}

export const racasController = {
  async list(req, res) {
    try {
      const rows = await Race.findAll({ order: [["ordem", "ASC"], ["nome", "ASC"]] });
      return res.json(rows.map(racaToPublic));
    } catch (error) {
      console.error("Erro ao listar raças:", error);
      return res.status(500).json({ error: "Erro ao carregar as raças." });
    }
  },

  async getById(req, res) {
    try {
      const row = await Race.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: "Raça não encontrada." });
      return res.json(racaToPublic(row));
    } catch (error) {
      console.error("Erro ao buscar raça:", error);
      return res.status(500).json({ error: "Erro ao buscar a raça." });
    }
  },
};
