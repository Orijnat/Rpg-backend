import { MercadoVendedor, MercadoItem } from "../models/index.js";

function vendedorParaResposta(vendedor) {
  const d = vendedor?.toJSON ? vendedor.toJSON() : { ...vendedor };
  return {
    id: d.id,
    nome: d.nome,
    titulo: d.titulo || "",
    regiao: d.regiao,
    humor: d.humor || "",
    especialidade: d.especialidade || "",
  };
}

function itemParaResposta(item) {
  const d = item?.toJSON ? item.toJSON() : { ...item };
  return {
    id: d.id,
    nome: d.nome,
    regiao: d.regiao,
    vendedor: d.vendedor,
    tipo: d.tipo,
    quantidade: Number(d.quantidade) || 0,
    preco: Number(d.preco) || 0,
    moeda: d.moeda,
    peso: Number(d.peso) || 0,
    raridade: d.raridade,
    descricao: d.descricao || "",
    requisitos: d.requisitos || "",
  };
}

export const mercadoController = {
  // ─── Vendedores ─────────────────────────────────────────────
  async listarVendedores(req, res) {
    try {
      const vendedores = await MercadoVendedor.findAll({
        where: { criadoPorId: req.user.id },
        order: [["updated_at", "DESC"]],
      });
      return res.json({ vendors: vendedores.map(vendedorParaResposta) });
    } catch (error) {
      console.error("Erro ao listar vendedores do mercado:", error);
      return res.status(500).json({ error: "Erro ao listar vendedores do mercado." });
    }
  },

  async criarVendedor(req, res) {
    try {
      const vendedor = await MercadoVendedor.create({
        ...req.body,
        criadoPorId: req.user.id,
      });
      return res.status(201).json({ vendor: vendedorParaResposta(vendedor) });
    } catch (error) {
      console.error("Erro ao criar vendedor do mercado:", error);
      return res.status(500).json({ error: "Erro ao criar vendedor do mercado." });
    }
  },

  async atualizarVendedor(req, res) {
    try {
      const vendedor = await MercadoVendedor.findOne({
        where: { id: req.params.id, criadoPorId: req.user.id },
      });
      if (!vendedor) {
        return res.status(404).json({ error: "Vendedor não encontrado." });
      }
      await vendedor.update(req.body);
      return res.json({ vendor: vendedorParaResposta(vendedor) });
    } catch (error) {
      console.error("Erro ao atualizar vendedor do mercado:", error);
      return res.status(500).json({ error: "Erro ao atualizar vendedor do mercado." });
    }
  },

  async removerVendedor(req, res) {
    try {
      const vendedor = await MercadoVendedor.findOne({
        where: { id: req.params.id, criadoPorId: req.user.id },
      });
      if (!vendedor) {
        return res.status(404).json({ error: "Vendedor não encontrado." });
      }
      await vendedor.destroy();
      return res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover vendedor do mercado:", error);
      return res.status(500).json({ error: "Erro ao remover vendedor do mercado." });
    }
  },

  // ─── Itens ──────────────────────────────────────────────────
  async listarItens(req, res) {
    try {
      const itens = await MercadoItem.findAll({
        where: { criadoPorId: req.user.id },
        order: [["updated_at", "DESC"]],
      });
      return res.json({ items: itens.map(itemParaResposta) });
    } catch (error) {
      console.error("Erro ao listar itens do mercado:", error);
      return res.status(500).json({ error: "Erro ao listar itens do mercado." });
    }
  },

  async criarItem(req, res) {
    try {
      const item = await MercadoItem.create({
        ...req.body,
        quantidade: Math.max(0, Math.floor(Number(req.body.quantidade) || 0)),
        preco: Number(req.body.preco) || 0,
        peso: Number(req.body.peso) || 0,
        criadoPorId: req.user.id,
      });
      return res.status(201).json({ item: itemParaResposta(item) });
    } catch (error) {
      console.error("Erro ao criar item do mercado:", error);
      return res.status(500).json({ error: "Erro ao criar item do mercado." });
    }
  },

  async atualizarItem(req, res) {
    try {
      const item = await MercadoItem.findOne({
        where: { id: req.params.id, criadoPorId: req.user.id },
      });
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado." });
      }
      await item.update({
        ...req.body,
        quantidade: Math.max(0, Math.floor(Number(req.body.quantidade) || 0)),
        preco: Number(req.body.preco) || 0,
        peso: Number(req.body.peso) || 0,
      });
      return res.json({ item: itemParaResposta(item) });
    } catch (error) {
      console.error("Erro ao atualizar item do mercado:", error);
      return res.status(500).json({ error: "Erro ao atualizar item do mercado." });
    }
  },

  async removerItem(req, res) {
    try {
      const item = await MercadoItem.findOne({
        where: { id: req.params.id, criadoPorId: req.user.id },
      });
      if (!item) {
        return res.status(404).json({ error: "Item não encontrado." });
      }
      await item.destroy();
      return res.json({ success: true });
    } catch (error) {
      console.error("Erro ao remover item do mercado:", error);
      return res.status(500).json({ error: "Erro ao remover item do mercado." });
    }
  },
};
