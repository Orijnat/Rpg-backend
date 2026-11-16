import { LogBatalha } from "../models/index.js";

// Serializa uma entrada do log de batalha para a API (contrato estável do frontend).
export function serializeBatalhaLogEntry(entry) {
  const plain = typeof entry.toJSON === "function" ? entry.toJSON() : entry;
  return {
    id: plain.id,
    encontroId: plain.encontroId ?? plain.encontro_id,
    campanhaId: plain.campanhaId ?? plain.campanha_id,
    autor: plain.autor,
    papel: plain.papel,
    tipo: plain.tipo,
    mensagem: plain.mensagem,
    dados: plain.dados || {},
    rodada: plain.rodada ?? null,
    timestamp: plain.createdAt || plain.created_at,
  };
}

/**
 * Grava uma entrada no log de batalha. Nunca derruba a requisição principal:
 * falhas ficam no console com contexto suficiente para investigação.
 */
export async function registrarEventoBatalha({ encontro, usuarioId = null, autor, papel = "jogador", tipo, mensagem, dados = {} }) {
  try {
    if (!encontro?.id) return null;
    const rodada = Number(encontro.dadosExtras?.combatRound) || null;
    return await LogBatalha.create({
      encontroId: encontro.id,
      campanhaId: encontro.campanhaId,
      usuarioId,
      autor: String(autor || "Sistema").slice(0, 160),
      papel,
      tipo,
      mensagem: String(mensagem || "").slice(0, 500),
      dados: dados && typeof dados === "object" && !Array.isArray(dados) ? dados : {},
      rodada,
    });
  } catch (err) {
    console.error("[LOG-BATALHA-FALHA]", {
      tipo,
      encontroId: encontro?.id ?? null,
      erro: err?.message || String(err),
    });
    return null;
  }
}

/**
 * Resolve o encontro alvo das operações de log.
 * Com encontroId explícito, exige que o encontro pertença às campanhas permitidas.
 * Sem ele, usa o encontro ativo mais recente ou, na ausência, o mais recente da mesa.
 */
export async function resolverEncontroParaLog(Encounter, permittedCampaignIds, encontroId) {
  if (encontroId) {
    return Encounter.findOne({
      where: { id: encontroId, campanhaId: permittedCampaignIds },
    });
  }
  let encontro = await Encounter.findOne({
    where: { campanhaId: permittedCampaignIds, ativo: true },
    order: [["updated_at", "DESC"]],
  });
  if (!encontro) {
    encontro = await Encounter.findOne({
      where: { campanhaId: permittedCampaignIds },
      order: [["updated_at", "DESC"]],
    });
  }
  return encontro;
}

/**
 * Resolve os ids de campanha que o usuário pode ver/registrar.
 * Suporta "ativa" (resolve pelas campanhas donas/membro do usuário), espelhando
 * o fluxo de sincronização de iniciativa da ficha.
 */
export async function resolverCampanhasPermitidas(Campaign, CampaignMember, user, campanhaId) {
  if (campanhaId && campanhaId !== "ativa") {
    return [campanhaId];
  }
  const owned = await Campaign.findAll({
    where: { proprietarioId: user.id },
    attributes: ["id"],
  });
  const memberships = await CampaignMember.findAll({
    where: { usuarioId: user.id, bloqueado: false },
    attributes: ["campanhaId"],
  });
  return [...new Set([
    ...owned.map((item) => item.id),
    ...memberships.map((item) => item.campanhaId),
  ])];
}
