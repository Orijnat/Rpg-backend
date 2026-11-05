import { Note, Campaign, CampaignMember, User, registrarAuditoria } from "../models/index.js";
import { requireCampaignAccess } from "../services/campaignAccess.js";

export const notaController = {
  // Listar notas com estrita filtragem server-side para dados privados
  async listar(req, res) {
    try {
      const { campanhaId } = req.params;
      const access = await requireCampaignAccess(req, res, campanhaId);
      if (!access) return;
      const isMestre = access.isOwner;

      // Busca todas as notas da campanha
      const notas = await Note.findAll({
        where: { campanhaId },
        include: [{ model: User, as: "autor", attributes: ["id", "username"] }],
        order: [["updated_at", "DESC"]],
      });

      // Filtragem estrita server-side:
      // Se não for mestre, filtra qualquer nota privada que não pertença ao próprio usuário.
      const notasFiltradas = isMestre
        ? notas
        : notas.filter((n) => !n.privada || n.autorId === req.user.id);

      return res.json(notasFiltradas);
    } catch (error) {
      console.error("Erro ao listar notas:", error);
      return res.status(500).json({ error: "Erro ao listar notas." });
    }
  },

  // Criar nova nota com controle explícito de privacidade
  async criar(req, res) {
    try {
      const { campanhaId } = req.params;
      if (!(await requireCampaignAccess(req, res, campanhaId))) return;
      const { titulo, conteudo, tipo, privada, personagemId } = req.body;

      if (!conteudo || !conteudo.trim()) {
        return res.status(400).json({ error: "O conteúdo da nota não pode estar vazio." });
      }

      const nota = await Note.create({
        campanhaId,
        autorId: req.user.id,
        personagemId: personagemId || null,
        titulo: titulo ? titulo.trim() : "Sem título",
        conteudo: conteudo.trim(),
        tipo: tipo || "anotacao",
        privada: Boolean(privada),
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId,
        acao: "CRIAR_NOTA",
        entidade: "anotacoes",
        entidadeId: nota.id,
        dados: { titulo: nota.titulo, privada: nota.privada },
        ip: req.ip,
      });

      return res.status(201).json(nota);
    } catch (error) {
      console.error("Erro ao criar nota:", error);
      return res.status(500).json({ error: "Erro ao criar nota." });
    }
  },

  // Atualizar nota
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const nota = await Note.findByPk(id);

      if (!nota) return res.status(404).json({ error: "Nota não encontrada." });

      const access = await requireCampaignAccess(req, res, nota.campanhaId);
      if (!access) return;
      const isMestre = access.isOwner;
      const isAutor = nota.autorId === req.user.id;

      if (!isMestre && !isAutor) {
        return res.status(403).json({ error: "Você não tem permissão para editar esta nota." });
      }

      const { titulo, conteudo, tipo, privada } = req.body;
      await nota.update({
        titulo: titulo !== undefined ? titulo.trim() : nota.titulo,
        conteudo: conteudo !== undefined ? conteudo.trim() : nota.conteudo,
        tipo: tipo !== undefined ? tipo : nota.tipo,
        privada: privada !== undefined ? Boolean(privada) : nota.privada,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: nota.campanhaId,
        acao: "ATUALIZAR_NOTA",
        entidade: "anotacoes",
        entidadeId: nota.id,
        dados: { titulo: nota.titulo, privada: nota.privada },
        ip: req.ip,
      });

      return res.json(nota);
    } catch (error) {
      console.error("Erro ao atualizar nota:", error);
      return res.status(500).json({ error: "Erro ao atualizar nota." });
    }
  },

  // Excluir nota
  async remover(req, res) {
    try {
      const { id } = req.params;
      const nota = await Note.findByPk(id);

      if (!nota) return res.status(404).json({ error: "Nota não encontrada." });

      const access = await requireCampaignAccess(req, res, nota.campanhaId);
      if (!access) return;
      const isMestre = access.isOwner;
      const isAutor = nota.autorId === req.user.id;

      if (!isMestre && !isAutor) {
        return res.status(403).json({ error: "Você não tem permissão para excluir esta nota." });
      }

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: nota.campanhaId,
        acao: "EXCLUIR_NOTA",
        entidade: "anotacoes",
        entidadeId: nota.id,
        dados: { titulo: nota.titulo },
        ip: req.ip,
      });

      await nota.destroy();
      return res.json({ success: true, message: "Nota excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir nota:", error);
      return res.status(500).json({ error: "Erro ao excluir nota." });
    }
  },
};
