import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { mapaTaticoPatchSchema } from "../schemas/apiSchemas.js";
import { mapaTaticoController } from "../controllers/mapaTaticoController.js";

const router = Router();
router.use(authMiddleware);

router.get("/:campanhaId", mapaTaticoController.obter);
router.patch("/:campanhaId", validar(mapaTaticoPatchSchema), mapaTaticoController.atualizar);

export default router;
