import path from "node:path";
import fsp from "node:fs/promises";
import multer from "multer";
import { Arquivo, Character, Campaign, CampaignMember } from "../models/index.js";
import { getCampaignAccess } from "../services/campaignAccess.js";
import { saveBuffer, removeFile, caminhoPrivado, signReadToken, verifyReadToken, MAX_UPLOAD_BYTES } from "../services/uploadService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export const arquivoUploadMiddleware = upload.single("arquivo");

async function podeGerenciarArquivo(req, arquivo) {
  if (!arquivo) return false;
  if (arquivo.usuarioId === req.user?.id) return true;
  if (arquivo.campanhaId) {
    const access = await getCampaignAccess(req.user, arquivo.campanhaId);
    return access.isOwner;
  }
  return false;
}

async function podeLerArquivo(req, arquivo) {
  if (!arquivo) return false;
  if (arquivo.usuarioId === req.user?.id) return true;
  if (arquivo.campanhaId) {
    const access = await getCampaignAccess(req.user, arquivo.campanhaId);
    if (access.permitido) return true; // mestre dono ou membro da mesa
  }
  if (arquivo.personagemId) {
    const personagem = await Character.findByPk(arquivo.personagemId, { attributes: ["id", "userId", "campanhaId"] });
    if (personagem?.userId === req.user?.id) return true;
    if (personagem?.campanhaId) {
      const access = await getCampaignAccess(req.user, personagem.campanhaId);
      if (access.permitido) return true;
    }
  }
  return false;
}

export const arquivoController = {
  // Upload seguro: MIME real (magic bytes), nome interno aleatório, armazenamento privado
  async upload(req, res) {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "Nenhum arquivo enviado (campo 'arquivo')." });
      }
      const { personagemId, campanhaId, contexto = "anotacao" } = req.body || {};

      let resolvedCampanha = campanhaId || null;
      if (personagemId) {
        const character = await Character.findByPk(personagemId, { attributes: ["id", "userId", "campanhaId"] });
        if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
        const isOwner = character.userId === req.user.id;
        let isTableMaster = false;
        if (!isOwner && character.campanhaId) {
          const access = await getCampaignAccess(req.user, character.campanhaId);
          isTableMaster = access.isOwner;
        }
        if (!isOwner && !isTableMaster) {
          return res.status(403).json({ error: "Você só anexa arquivos à própria ficha ou às fichas de mesa que você administra." });
        }
        resolvedCampanha = resolvedCampanha ?? character.campanhaId ?? null;
      }
      if (resolvedCampanha) {
        const access = await getCampaignAccess(req.user, resolvedCampanha);
        if (!access.permitido) return res.status(403).json({ error: "Você não participa desta mesa." });
      }

      let stored;
      try {
        stored = await saveBuffer(req.file.buffer, req.file.originalname);
      } catch (validationError) {
        return res.status(validationError.status || 400).json({ error: validationError.message });
      }

      const arquivo = await Arquivo.create({
        usuarioId: req.user.id,
        personagemId: personagemId || null,
        campanhaId: resolvedCampanha,
        encontroId: null,
        nomeOriginal: stored.nomeOriginal,
        nomeInterno: stored.nomeInterno,
        mimeType: stored.mimeType,
        tamanhoBytes: stored.tamanhoBytes,
        hashSha256: stored.hashSha256,
        contexto: String(contexto).slice(0, 80),
      });

      const { readToken, expiresAt } = signReadToken(arquivo.id);
      return res.status(201).json({
        arquivo: {
          id: arquivo.id,
          nomeOriginal: arquivo.nomeOriginal,
          mimeType: arquivo.mimeType,
          tamanhoBytes: Number(arquivo.tamanhoBytes),
          contexto: arquivo.contexto,
          personagemId: arquivo.personagemId,
          campanhaId: arquivo.campanhaId,
        },
        readUrl: `/api/arquivos/${arquivo.id}?rt=${encodeURIComponent(readToken)}`,
        readToken,
        expiresAt,
      });
    } catch (error) {
      console.error("Erro no upload:", error);
      return res.status(500).json({ error: "Erro ao salvar o arquivo." });
    }
  },

  // Listar metadados (sem bytes) — autorizados por mesa/ficha
  async listar(req, res) {
    try {
      const { campanhaId, personagemId } = req.query;
      let where = null;
      if (campanhaId) {
        const access = await getCampaignAccess(req.user, campanhaId);
        if (!access.permitido) return res.status(403).json({ error: "Você não participa desta mesa." });
        where = access.isOwner ? { campanhaId } : { campanhaId, usuarioId: req.user.id };
      } else if (personagemId) {
        const character = await Character.findByPk(personagemId, { attributes: ["id", "userId", "campanhaId"] });
        if (!character) return res.status(404).json({ error: "Personagem não encontrado." });
        const isOwner = character.userId === req.user.id;
        let isTableMaster = false;
        if (character.campanhaId) {
          const access = await getCampaignAccess(req.user, character.campanhaId);
          isTableMaster = access.isOwner;
        }
        if (!isOwner && !isTableMaster) return res.status(403).json({ error: "Você não pode ver os anexos desta ficha." });
        where = isOwner && !isTableMaster ? { personagemId, usuarioId: req.user.id } : { personagemId };
      } else {
        where = { usuarioId: req.user.id };
      }
      const arquivos = await Arquivo.findAll({ where, order: [["created_at", "DESC"]], limit: 200 });
      return res.json(arquivos.map((a) => ({
        id: a.id,
        nomeOriginal: a.nomeOriginal,
        mimeType: a.mimeType,
        tamanhoBytes: Number(a.tamanhoBytes),
        contexto: a.contexto,
        campanhaId: a.campanhaId,
        personagemId: a.personagemId,
        created_at: a.created_at,
      })));
    } catch (error) {
      console.error("Erro ao listar arquivos:", error);
      return res.status(500).json({ error: "Erro ao listar arquivos." });
    }
  },

  // Emite URLs de leitura assinadas para um lote de IDs (o <img> não manda Authorization)
  async mintReadUrls(req, res) {
    try {
      const { ids } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
        return res.status(400).json({ error: "Informe entre 1 e 100 IDs." });
      }
      const arquivos = await Arquivo.findAll({ where: { id: ids } });
      const urls = {};
      for (const arquivo of arquivos) {
        if (!(await podeLerArquivo(req, arquivo))) continue;
        const { readToken, expiresAt } = signReadToken(arquivo.id);
        urls[arquivo.id] = { readUrl: `/api/arquivos/${arquivo.id}?rt=${encodeURIComponent(readToken)}`, readToken, expiresAt };
      }
      return res.json(urls);
    } catch (error) {
      console.error("Erro ao emitir URLs de leitura:", error);
      return res.status(500).json({ error: "Erro ao emitir URLs de leitura." });
    }
  },

  // Servir bytes: <img src> precisa de URL assinada (?rt=) ou Authorization válido
  async servir(req, res) {
    try {
      const { id } = req.params;
      const arquivo = await Arquivo.findByPk(id);
      if (!arquivo) return res.status(404).json({ error: "Arquivo não encontrado." });

      const hasRt = verifyReadToken(arquivo.id, req.query?.rt);
      const hasAccess = hasRt || (req.user && (await podeLerArquivo(req, arquivo)));
      if (!hasAccess) return res.status(403).json({ error: "Você não pode visualizar este arquivo." });

      const caminho = caminhoPrivado(arquivo.nomeInterno);
      const content = await fsp.readFile(caminho);
      res.setHeader("Content-Type", arquivo.mimeType);
      res.setHeader("Content-Length", String(content.length));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(arquivo.nomeOriginal)}"`);
      return res.send(content);
    } catch (error) {
      if (error?.code === "ENOENT") return res.status(410).json({ error: "Arquivo ausente no armazenamento." });
      console.error("Erro ao servir arquivo:", error);
      return res.status(500).json({ error: "Erro ao servir o arquivo." });
    }
  },

  async remover(req, res) {
    try {
      const { id } = req.params;
      const arquivo = await Arquivo.findByPk(id);
      if (!arquivo) return res.status(404).json({ error: "Arquivo não encontrado." });
      if (!(await podeGerenciarArquivo(req, arquivo))) {
        return res.status(403).json({ error: "Você não pode excluir este arquivo." });
      }
      await removeFile(arquivo.nomeInterno);
      await arquivo.destroy();
      return res.json({ success: true, message: "Arquivo excluído." });
    } catch (error) {
      console.error("Erro ao excluir arquivo:", error);
      return res.status(500).json({ error: "Erro ao excluir o arquivo." });
    }
  },
};
