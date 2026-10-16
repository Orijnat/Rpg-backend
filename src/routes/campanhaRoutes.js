import { Router } from "express";
import { campanhaController } from "../controllers/campanhaController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();
router.use(authMiddleware);
router.get("/", campanhaController.obter);
router.put("/", campanhaController.atualizar);

export default router;
