import { MapaTatico, Arquivo, Character } from "../models/index.js";
import { getCampaignAccess } from "../services/campaignAccess.js";
import { signReadToken } from "../services/uploadService.js";

// Nome de fundo: URL externa ou arquivo privado com URL assinada de curtíssima duração.
function fundoParaCliente(mapa) {
  if (!mapa) return null;
  const data = mapa.toJSON ? mapa.toJSON() : { ...mapa };
  if (data.arquivoFundoId) {
    const { readToken } = signReadToken(data.arquivoFundoId);
    data.urlFundoAssinada = `/api/arquivos/${data.arquivoFundoId}?rt=${encodeURIComponent(readToken)}`;
  }
  return data;
}

function tokensVisiveis(tokens, isOwner) {
  const list = Array.isArray(tokens) ? tokens : [];
  return isOwner ? list : list.filter((t) => !t?.oculto);
}

async function loadOrCreate(campanhaId) {
  let mapa = await MapaTatico.findOne({ where: { campanhaId } });
  if (!mapa) mapa = await MapaTatico.create({ campanhaId, tokens: [] });
  return mapa;
}

export const mapaTaticoController = {
  // GET /:campanhaId — membro/dono lê; override: ocultos só para o mestre
  async obter(req, res) {
    try {
      const access = await getCampaignAccess(req.user, req.params.campanhaId);
      if (!access.permitido) return res.status(access.campanha ? 403 : 404).json({ error: "Mapa indisponível." });
      const mapa = await loadOrCreate(req.params.campanhaId);
      const data = fundoParaCliente(mapa);
      data.tokens = tokensVisiveis(data.tokens, access.isOwner);
      data.podeGerenciar = access.isOwner;
      return res.json(data);
    } catch (error) {
      console.error("Erro ao obter mapa tático:", error);
      return res.status(500).json({ error: "Erro ao obter o mapa tático." });
    }
  },

  // PATCH /:campanhaId — mestre: tudo; membro: apenas tokens (sem fundo/grade/título)
  async atualizar(req, res) {
    try {
      const { campanhaId } = req.params;
      const access = await getCampaignAccess(req.user, campanhaId);
      if (!access.permitido) return res.status(access.campanha ? 403 : 404).json({ error: "Mapa indisponível." });

      const mapa = await loadOrCreate(campanhaId);
      const body = req.body || {};
      const alvo = {};

      // Membros comuns só mexem em tokens
      if (access.isOwner) {
        if (body.titulo !== undefined) alvo.titulo = body.titulo;
        if (body.arquivoFundoId !== undefined) {
          if (body.arquivoFundoId === null) {
            alvo.arquivoFundoId = null;
          } else {
            const arquivo = await Arquivo.findByPk(body.arquivoFundoId, { attributes: ["id", "usuarioId", "campanhaId"] });
            if (!arquivo) return res.status(404).json({ error: "Arquivo de fundo não encontrado." });
            const dono = arquivo.usuarioId === req.user.id || arquivo.campanhaId === campanhaId;
            if (!dono) return res.status(403).json({ error: "Esse arquivo pertence a outra mesa." });
            alvo.arquivoFundoId = arquivo.id;
            alvo.urlFundo = null; // arquivo privado tem precedência
          }
        }
        if (body.urlFundo !== undefined) {
          alvo.urlFundo = body.urlFundo;
          if (body.urlFundo) alvo.arquivoFundoId = null;
        }
        if (body.gradePx !== undefined) alvo.gradePx = body.gradePx;
        if (body.gradeVisivel !== undefined) alvo.gradeVisivel = body.gradeVisivel;
      } else if (body.titulo !== undefined || body.arquivoFundoId !== undefined || body.urlFundo !== undefined || body.gradePx !== undefined || body.gradeVisivel !== undefined) {
        return res.status(403).json({ error: "Apenas o mestre ajusta o mapa da mesa; jogadores podem mover miniaturas." });
      }

      if (body.tokens !== undefined) {
        if (!Array.isArray(body.tokens)) {
          return res.status(400).json({ error: "tokens deve ser uma lista." });
        }
        if (access.isOwner) {
          // Mestre: substituição completa do placar de miniaturas
          alvo.tokens = body.tokens;
        } else {
          // Membro: move miniaturas existentes, cria miniaturas novas; nunca apaga, oculta ou renomeia
          const existentes = Array.isArray(mapa.tokens) ? mapa.tokens : [];
          const resultado = existentes.map((t) => ({ ...t }));
          const indexById = new Map(resultado.map((t, i) => [t?.id, i]));
          for (const t of body.tokens) {
            const indice = indexById.get(t?.id);
            if (indice !== undefined) {
              const existente = resultado[indice];
              resultado[indice] = {
                ...existente,
                x: t.x ?? existente.x,
                y: t.y ?? existente.y,
                tamanho: t.tamanho ?? existente.tamanho,
                hp: t.hp !== undefined ? t.hp : existente.hp,
                icone: t.icone ?? existente.icone,
              };
            } else {
              const novo = { ...t, oculto: false };
              resultado.push(novo);
              indexById.set(novo.id, resultado.length - 1);
            }
          }
          alvo.tokens = resultado;
        }
      }

      if (Object.keys(alvo).length === 0) {
        return res.status(400).json({ error: "Nada para atualizar." });
      }

      alvo.updatedPorId = req.user.id;
      await mapa.update(alvo);
      const data = fundoParaCliente(mapa);
      data.tokens = tokensVisiveis(data.tokens, access.isOwner);
      data.podeGerenciar = access.isOwner;
      return res.json(data);
    } catch (error) {
      console.error("Erro ao atualizar mapa tático:", error);
      return res.status(500).json({ error: "Erro ao atualizar o mapa tático." });
    }
  },
};
