import { Router } from "express";
import { npcController } from "../controllers/npcController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/", npcController.listar);
router.post("/", npcController.criar);
router.get("/:id", npcController.obterPorId);
router.put("/:id", npcController.atualizar);
router.post("/:id/duplicar", npcController.duplicar);
router.delete("/:id", npcController.remover);

export default router;
