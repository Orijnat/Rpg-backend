import { Router } from "express";
import { npcController } from "../controllers/npcController.js";
import { authMiddleware, requireMaster } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { npcSchema } from "../schemas/apiSchemas.js";

const router = Router();
router.use(authMiddleware);

router.get("/", npcController.listar);
router.post("/", requireMaster, validar(npcSchema), npcController.criar);
router.get("/:id", npcController.obterPorId);
router.put("/:id", requireMaster, npcController.atualizar);
router.post("/:id/duplicar", requireMaster, npcController.duplicar);
router.delete("/:id", requireMaster, npcController.remover);

export default router;
