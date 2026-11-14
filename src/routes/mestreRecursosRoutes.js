import { Router } from "express";
import { notaController } from "../controllers/notaController.js";
import { encontroController } from "../controllers/encontroController.js";
import { recursoMapaController } from "../controllers/recursoMapaController.js";
import { authMiddleware, requireMaster } from "../middlewares/authMiddleware.js";
import { encontroSchema, notaSchema } from "../schemas/apiSchemas.js";
import { validar } from "../middlewares/validate.js";

const router = Router();
router.use(authMiddleware);

// Notas individuais
router.put("/notas/:id", validar(notaSchema), notaController.atualizar);
router.delete("/notas/:id", notaController.remover);

// Encontros individuais
router.get("/encontros/:id", encontroController.obterPorId);
router.put("/encontros/:id", requireMaster, validar(encontroSchema), encontroController.atualizar);
router.delete("/encontros/:id", requireMaster, encontroController.remover);

// Mapas individuais
router.get("/mapas/:id", recursoMapaController.obterPorId);
router.put("/mapas/:id", requireMaster, recursoMapaController.atualizar);
router.delete("/mapas/:id", requireMaster, recursoMapaController.remover);

export default router;
