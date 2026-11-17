import { Router } from "express";
import { authMiddleware, requireMaster } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { classeSchema, classeUpdateSchema } from "../schemas/apiSchemas.js";
import { classController } from "../controllers/classController.js";

const router = Router();

// Públicos: o catálogo de classes não guarda segredos e a ficha precisa listá-lo.
router.get("/", classController.list);
router.get("/:id", classController.getById);

// Mestre cria/edita/remove (catálogo global — qualquer mestre pode editar).
router.post("/", authMiddleware, requireMaster, validar(classeSchema), classController.create);
router.put("/:id", authMiddleware, requireMaster, validar(classeUpdateSchema), classController.update);
router.delete("/:id", authMiddleware, requireMaster, classController.remove);

export default router;
