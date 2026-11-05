import { Campaign, CampaignMember } from "../models/index.js";

export function isMaster(user) {
  return user?.perfil === "mestre" || user?.role === "master";
}

/**
 * Autoriza acesso a uma campanha sem confiar em IDs/perfis enviados pelo cliente.
 * Mestres só administram campanhas próprias; jogadores precisam ser membros ativos.
 */
export async function getCampaignAccess(user, campanhaId) {
  if (!user || !campanhaId) return { campanha: null, permitido: false, isOwner: false };
  const campanha = await Campaign.findByPk(campanhaId, { attributes: ["id", "proprietarioId"] });
  if (!campanha) return { campanha: null, permitido: false, isOwner: false };

  const isOwner = campanha.proprietarioId === user.id;
  if (isOwner) return { campanha, permitido: true, isOwner: true };
  if (isMaster(user)) return { campanha, permitido: false, isOwner: false };

  const membro = await CampaignMember.findOne({
    where: { campanhaId, usuarioId: user.id, bloqueado: false },
    attributes: ["campanhaId", "usuarioId", "papel"],
  });
  return { campanha, permitido: Boolean(membro), isOwner: false, membro };
}

export async function requireCampaignAccess(req, res, campanhaId, options = {}) {
  const access = await getCampaignAccess(req.user, campanhaId);
  if (!access.campanha) {
    res.status(404).json({ error: "Campanha não encontrada." });
    return null;
  }
  if (!access.permitido || (options.ownerOnly && !access.isOwner)) {
    res.status(403).json({ error: "Você não tem acesso a esta campanha." });
    return null;
  }
  return access;
}
