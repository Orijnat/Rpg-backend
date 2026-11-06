import crypto from "crypto";
import { Campaign, CampaignMember, User, Character, NPC, AuditLog, registrarAuditoria } from "../models/index.js";

const dadosMestrePadrao = {
  tituloSessao: "Próxima sessão",
  anotacoesSessao: "",
  npcs: [],
  iniciativa: [],
  imagensMapas: [],
};

function gerarCodigoConvite() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function garantirMestre(req, res) {
  if (req.user?.perfil !== "mestre" && req.user?.role !== "master") {
    res.status(403).json({ error: "Apenas mestres podem realizar esta ação." });
    return false;
  }
  return true;
}

export const campanhaController = {
  // Compatibilidade legada com /api/campanha
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

  // Listar todas as campanhas do usuário (como dono ou como membro)
  async listar(req, res) {
    try {
      const userId = req.user.id;
      const isMaster = req.user.perfil === "mestre" || req.user.role === "master";

      let campanhas;
      if (isMaster) {
        campanhas = await Campaign.findAll({
          where: { proprietarioId: userId },
          include: [
            { model: User, as: "proprietario", attributes: ["id", "username", "email"] },
            { model: CampaignMember, as: "membrosCampanha" },
          ],
          order: [["updated_at", "DESC"]],
        });
      } else {
        const memberships = await CampaignMember.findAll({
          where: { usuarioId: userId, bloqueado: false },
        });
        const campaignIds = memberships.map((m) => m.campanhaId);
        campanhas = await Campaign.findAll({
          where: { id: campaignIds },
          include: [
            { model: User, as: "proprietario", attributes: ["id", "username", "email"] },
            { model: CampaignMember, as: "membrosCampanha" },
          ],
          order: [["updated_at", "DESC"]],
        });
      }

      return res.json(campanhas);
    } catch (error) {
      console.error("Erro ao listar campanhas:", error);
      return res.status(500).json({ error: "Erro ao listar campanhas." });
    }
  },

  // Criar nova campanha com código de convite
  async criar(req, res) {
    if (!garantirMestre(req, res)) return;
    try {
      const { nome, descricao, estado } = req.body;
      if (!nome || !nome.trim()) {
        return res.status(400).json({ error: "O nome da campanha é obrigatório." });
      }

      let codigoConvite = gerarCodigoConvite();
      let duplicado = await Campaign.findOne({ where: { codigoConvite } });
      while (duplicado) {
        codigoConvite = gerarCodigoConvite();
        duplicado = await Campaign.findOne({ where: { codigoConvite } });
      }

      const campanha = await Campaign.create({
        proprietarioId: req.user.id,
        nome: nome.trim(),
        descricao: descricao || "",
        estado: estado || "planejamento",
        codigoConvite,
        dadosExtras: {
          lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
          lastModifiedAt: new Date().toISOString(),
          sessoes: [],
        },
      });

      // Adiciona o proprietário como membro mestre
      await CampaignMember.create({
        campanhaId: campanha.id,
        usuarioId: req.user.id,
        papel: "mestre",
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: campanha.id,
        acao: "CRIAR_CAMPANHA",
        entidade: "campanhas",
        entidadeId: campanha.id,
        dados: { nome: campanha.nome, codigoConvite },
        ip: req.ip,
      });

      return res.status(201).json(campanha);
    } catch (error) {
      console.error("Erro ao criar campanha:", error);
      return res.status(500).json({ error: "Erro ao criar campanha." });
    }
  },

  // Obter campanha por ID com restrição de acesso
  async obterPorId(req, res) {
    try {
      const { id } = req.params;
      const campanha = await Campaign.findByPk(id, {
        include: [
          { model: User, as: "proprietario", attributes: ["id", "username", "email"] },
          {
            model: CampaignMember,
            as: "membrosCampanha",
            include: [{ model: User, as: "usuario", attributes: ["id", "username", "email"] }],
          },
          { model: Character, as: "personagens" },
          { model: NPC, as: "npcs" },
        ],
      });

      if (!campanha) {
        return res.status(404).json({ error: "Campanha não encontrada." });
      }

      const isDono = campanha.proprietarioId === req.user.id;
      const membro = campanha.membrosCampanha?.find((m) => m.usuarioId === req.user.id);

      if (!isDono && (!membro || membro.bloqueado)) {
        return res.status(403).json({ error: "Acesso restrito aos membros desta campanha." });
      }

      return res.json(campanha);
    } catch (error) {
      console.error("Erro ao obter campanha:", error);
      return res.status(500).json({ error: "Erro ao obter campanha." });
    }
  },

  // Atualizar dados da campanha (somente dono ou mestre)
  async atualizarPorId(req, res) {
    try {
      const { id } = req.params;
      const campanha = await Campaign.findByPk(id);

      if (!campanha) {
        return res.status(404).json({ error: "Campanha não encontrada." });
      }

      if (campanha.proprietarioId !== req.user.id) {
        return res.status(403).json({ error: "Apenas o mestre proprietário pode editar a campanha." });
      }

      const { nome, descricao, estado, codigoConvite, dadosExtras } = req.body;
      const dadosAtualizados = {
        ...(campanha.dadosExtras || {}),
        ...(dadosExtras || {}),
        lastModifiedBy: { id: req.user.id, name: req.user.username, role: req.user.role },
        lastModifiedAt: new Date().toISOString(),
      };

      await campanha.update({
        nome: nome ?? campanha.nome,
        descricao: descricao ?? campanha.descricao,
        estado: estado ?? campanha.estado,
        codigoConvite: codigoConvite ?? campanha.codigoConvite,
        dadosExtras: dadosAtualizados,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: campanha.id,
        acao: "ATUALIZAR_CAMPANHA",
        entidade: "campanhas",
        entidadeId: campanha.id,
        dados: { alteracoes: req.body },
        ip: req.ip,
      });

      return res.json(campanha);
    } catch (error) {
      console.error("Erro ao atualizar campanha:", error);
      return res.status(500).json({ error: "Erro ao atualizar campanha." });
    }
  },

  // Excluir campanha (somente o dono, com auditoria)
  async remover(req, res) {
    try {
      const { id } = req.params;
      const campanha = await Campaign.findByPk(id);

      if (!campanha) {
        return res.status(404).json({ error: "Campanha não encontrada." });
      }

      if (campanha.proprietarioId !== req.user.id) {
        return res.status(403).json({ error: "Apenas o proprietário pode excluir esta campanha." });
      }

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: campanha.id,
        acao: "EXCLUIR_CAMPANHA",
        entidade: "campanhas",
        entidadeId: campanha.id,
        dados: { nome: campanha.nome },
        ip: req.ip,
      });

      await campanha.destroy();
      return res.json({ success: true, message: "Campanha excluída com sucesso." });
    } catch (error) {
      console.error("Erro ao excluir campanha:", error);
      return res.status(500).json({ error: "Erro ao excluir campanha." });
    }
  },

  // Consulta pública de informações do convite (sem requerer autenticação prévia)
  async consultarConvitePublico(req, res) {
    try {
      const { codigo } = req.params;
      if (!codigo || !codigo.trim()) {
        return res.status(400).json({ valido: false, error: "Código de convite não informado." });
      }

      const campanha = await Campaign.findOne({
        where: { codigoConvite: codigo.trim().toUpperCase() },
        include: [
          { model: User, as: "proprietario", attributes: ["id", "username"] },
        ],
      });

      if (!campanha) {
        return res.status(404).json({ valido: false, error: "Nenhuma mesa de RPG encontrada com este código de convite." });
      }

      if (campanha.estado === "encerrada" || campanha.estado === "arquivada") {
        return res.status(400).json({ valido: false, error: "Esta mesa de RPG já foi encerrada pelo mestre." });
      }

      return res.json({
        valido: true,
        campanha: {
          id: campanha.id,
          nome: campanha.nome,
          descricao: campanha.descricao,
          estado: campanha.estado,
          mestre: campanha.proprietario?.username || "Mestre Anônimo",
          codigoConvite: campanha.codigoConvite,
        },
      });
    } catch (error) {
      console.error("Erro ao consultar convite público:", error);
      return res.status(500).json({ valido: false, error: "Erro ao verificar código de convite." });
    }
  },

  // Jogador ingressa na campanha através do código de convite
  async entrarPorCodigo(req, res) {
    try {
      const { inviteCode } = req.body;
      if (!inviteCode || !inviteCode.trim()) {
        return res.status(400).json({ error: "Código de convite não informado." });
      }

      const campanha = await Campaign.findOne({
        where: { codigoConvite: inviteCode.trim().toUpperCase() },
      });

      if (!campanha) {
        return res.status(404).json({ error: "Nenhuma campanha encontrada com este código." });
      }

      if (campanha.estado === "encerrada" || campanha.estado === "arquivada") {
        return res.status(400).json({ error: "Esta campanha já foi encerrada." });
      }

      const membroExistente = await CampaignMember.findOne({
        where: { campanhaId: campanha.id, usuarioId: req.user.id },
      });

      if (membroExistente) {
        if (membroExistente.bloqueado) {
          return res.status(403).json({ error: "Seu acesso a esta campanha foi bloqueado pelo mestre." });
        }
        // Garante que o personagem ativo esteja vinculado à mesa
        const char = await Character.findOne({ where: { userId: req.user.id } });
        if (char && !char.campanhaId) {
          await char.update({ campanhaId: campanha.id });
        }
        return res.json({ message: "Você já é membro desta campanha.", campanha });
      }

      await CampaignMember.create({
        campanhaId: campanha.id,
        usuarioId: req.user.id,
        papel: "jogador",
      });

      // Vincula o personagem do jogador à campanha se ele ainda não estiver vinculado
      const char = await Character.findOne({ where: { userId: req.user.id } });
      if (char && !char.campanhaId) {
        await char.update({ campanhaId: campanha.id });
      }

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: campanha.id,
        acao: "ENTRADA_MEMBRO",
        entidade: "membros_campanha",
        entidadeId: req.user.id,
        dados: { nome: req.user.username },
        ip: req.ip,
      });

      return res.status(201).json({ success: true, message: "Você entrou na campanha com sucesso!", campanha });
    } catch (error) {
      console.error("Erro ao entrar na campanha:", error);
      return res.status(500).json({ error: "Erro ao entrar na campanha." });
    }
  },

  // Listar membros de uma campanha
  async listarMembros(req, res) {
    try {
      const { id } = req.params;
      const campanha = await Campaign.findByPk(id);
      if (!campanha) return res.status(404).json({ error: "Campanha não encontrada." });
      const membroAtual = await CampaignMember.findOne({
        where: { campanhaId: id, usuarioId: req.user.id, bloqueado: false },
      });
      if (campanha.proprietarioId !== req.user.id && !membroAtual) {
        return res.status(403).json({ error: "Acesso restrito aos membros desta campanha." });
      }
      const membros = await CampaignMember.findAll({
        where: { campanhaId: id },
        include: [{ model: User, as: "usuario", attributes: ["id", "username", "email"] }],
      });
      return res.json(membros);
    } catch (error) {
      console.error("Erro ao listar membros:", error);
      return res.status(500).json({ error: "Erro ao listar membros." });
    }
  },

  // Atualizar membro (papel ou bloqueio - apenas mestre)
  async atualizarMembro(req, res) {
    try {
      const { id, userId } = req.params;
      const campanha = await Campaign.findByPk(id);

      if (!campanha || campanha.proprietarioId !== req.user.id) {
        return res.status(403).json({ error: "Apenas o proprietário pode alterar permissões de membros." });
      }

      if (campanha.proprietarioId === userId) {
        return res.status(400).json({ error: "O proprietário da campanha não pode ser rebaixado ou bloqueado." });
      }

      const membro = await CampaignMember.findOne({
        where: { campanhaId: id, usuarioId: userId },
      });

      if (!membro) {
        return res.status(404).json({ error: "Membro não encontrado na campanha." });
      }

      const { papel, bloqueado } = req.body;
      await membro.update({
        papel: papel ?? membro.papel,
        bloqueado: bloqueado !== undefined ? Boolean(bloqueado) : membro.bloqueado,
      });

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: id,
        acao: "ALTERAR_MEMBRO",
        entidade: "membros_campanha",
        entidadeId: userId,
        dados: { papel, bloqueado },
        ip: req.ip,
      });

      return res.json(membro);
    } catch (error) {
      console.error("Erro ao atualizar membro:", error);
      return res.status(500).json({ error: "Erro ao atualizar membro." });
    }
  },

  // Remover membro (expulsar pelo mestre ou sair pelo jogador)
  async removerMembro(req, res) {
    try {
      const { id, userId } = req.params;
      const campanha = await Campaign.findByPk(id);

      if (!campanha) {
        return res.status(404).json({ error: "Campanha não encontrada." });
      }

      const isDono = campanha.proprietarioId === req.user.id;
      const isProprioUsuario = req.user.id === userId;

      if (!isDono && !isProprioUsuario) {
        return res.status(403).json({ error: "Permissão insuficiente para remover este membro." });
      }

      if (campanha.proprietarioId === userId) {
        return res.status(400).json({ error: "O proprietário não pode sair ou ser removido da própria campanha." });
      }

      const membro = await CampaignMember.findOne({
        where: { campanhaId: id, usuarioId: userId },
      });

      if (!membro) {
        return res.status(404).json({ error: "Membro não encontrado." });
      }

      await membro.destroy();

      await registrarAuditoria({
        usuarioId: req.user.id,
        campanhaId: id,
        acao: isProprioUsuario ? "SAIDA_MEMBRO" : "EXPULSAO_MEMBRO",
        entidade: "membros_campanha",
        entidadeId: userId,
        dados: { userId },
        ip: req.ip,
      });

      return res.json({ success: true, message: "Membro removido da campanha." });
    } catch (error) {
      console.error("Erro ao remover membro:", error);
      return res.status(500).json({ error: "Erro ao remover membro." });
    }
  },

  // Obter trilha de auditoria da campanha
  async obterAuditoria(req, res) {
    try {
      const { id } = req.params;
      const campanha = await Campaign.findByPk(id);

      if (!campanha || campanha.proprietarioId !== req.user.id) {
        return res.status(403).json({ error: "Acesso restrito ao mestre proprietário." });
      }

      const logs = await AuditLog.findAll({
        where: { campanhaId: id },
        include: [{ model: User, as: "usuario", attributes: ["id", "username"] }],
        order: [["created_at", "DESC"]],
        limit: 100,
      });

      return res.json(logs);
    } catch (error) {
      console.error("Erro ao obter auditoria:", error);
      return res.status(500).json({ error: "Erro ao obter auditoria." });
    }
  },
};
