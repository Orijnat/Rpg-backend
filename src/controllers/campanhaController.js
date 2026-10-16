import { User } from "../models/index.js";

const dadosMestrePadrao = {
  tituloSessao: "Próxima sessão",
  anotacoesSessao: "",
  npcs: [],
  iniciativa: [],
  imagensMapas: [],
};

function garantirMestre(req, res) {
  if (req.user?.perfil !== "mestre" && req.user?.role !== "master") {
    res.status(403).json({ error: "Apenas mestres podem acessar os dados da campanha." });
    return false;
  }
  return true;
}

export const campanhaController = {
  async obter(req, res) {
    if (!garantirMestre(req, res)) return;
    return res.json({ ...dadosMestrePadrao, ...(req.user.dadosMestre || {}) });
  },

  async atualizar(req, res) {
    if (!garantirMestre(req, res)) return;
    const dados = { ...dadosMestrePadrao, ...req.body };
    await User.update({ dadosMestre: dados }, { where: { id: req.user.id } });
    return res.json(dados);
  },
};
