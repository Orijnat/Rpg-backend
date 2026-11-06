import { Router } from "express";
import { campanhaController } from "../controllers/campanhaController.js";
import { npcController } from "../controllers/npcController.js";
import { notaController } from "../controllers/notaController.js";
import { encontroController } from "../controllers/encontroController.js";
import { recursoMapaController } from "../controllers/recursoMapaController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { campanhaSchema, conviteSchema, encontroSchema, membroSchema, notaSchema, npcSchema, sessaoSchema } from "../schemas/apiSchemas.js";
import { validar } from "../middlewares/validate.js";
import { sessaoController } from "../controllers/sessaoController.js";

const router = Router();

// Rota pública para visualização/validação prévia de convite (sem exigir login)
router.get("/convite/:codigo", campanhaController.consultarConvitePublico);

router.use(authMiddleware);

// Compatibilidade legada com /api/campanha
router.get("/legado", campanhaController.obter);
router.put("/legado", campanhaController.atualizar);
// O frontend legado usa exatamente /api/campanha (sem /legado).
router.get("/", (req, res, next) => {
  if (req.baseUrl === "/api/campanha") return campanhaController.obter(req, res);
  return campanhaController.listar(req, res);
});
router.put("/", (req, res) => {
  if (req.baseUrl === "/api/campanha") return campanhaController.atualizar(req, res);
  return res.status(405).json({ error: "Método não permitido nesta rota." });
});

// Gerenciamento de campanhas
router.post("/", validar(campanhaSchema), campanhaController.criar);
router.post("/join", validar(conviteSchema), campanhaController.entrarPorCodigo);
router.get("/:id", campanhaController.obterPorId);
router.put("/:id", validar(campanhaSchema), campanhaController.atualizarPorId);
router.delete("/:id", campanhaController.remover);

// Gestão de membros da campanha
router.get("/:id/membros", campanhaController.listarMembros);
router.put("/:id/membros/:userId", validar(membroSchema), campanhaController.atualizarMembro);
router.delete("/:id/membros/:userId", campanhaController.removerMembro);

// Trilha de auditoria
router.get("/:id/auditoria", campanhaController.obterAuditoria);

// NPCs vinculados à campanha
router.get("/:campanhaId/npcs", npcController.listar);
router.post("/:campanhaId/npcs", validar(npcSchema), npcController.criar);

// Notas públicas e privadas
router.get("/:campanhaId/notas", notaController.listar);
router.post("/:campanhaId/notas", validar(notaSchema), notaController.criar);

// Encontros táticos e iniciativa
router.get("/:campanhaId/encontros", encontroController.listar);
router.post("/:campanhaId/encontros", validar(encontroSchema), encontroController.criar);
router.post("/:campanhaId/iniciativa/ficha", encontroController.receberIniciativaFicha);

// Mapas táticos, marcadores e revelação
router.get("/:campanhaId/mapas", recursoMapaController.listar);
router.post("/:campanhaId/mapas", recursoMapaController.criar);

// Sessões de jogo (não confundir com sessoes_autenticacao)
router.get("/:campanhaId/sessoes", sessaoController.listar);
router.post("/:campanhaId/sessoes", validar(sessaoSchema), sessaoController.criar);
router.get("/sessoes/:id", sessaoController.obterPorId);
router.put("/sessoes/:id", validar(sessaoSchema), sessaoController.atualizar);
router.delete("/sessoes/:id", sessaoController.remover);

export default router;
