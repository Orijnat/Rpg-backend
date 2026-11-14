import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { rolagemSchema } from "../schemas/apiSchemas.js";
import { rolagemController } from "../controllers/rolagemController.js";

const router = Router();
router.use(authMiddleware);

router.post("/", validar(rolagemSchema), rolagemController.registrar);
router.get("/", rolagemController.listar);

export default router;
