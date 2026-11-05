import { Router } from "express";
import { notaController } from "../controllers/notaController.js";
import { encontroController } from "../controllers/encontroController.js";
import { recursoMapaController } from "../controllers/recursoMapaController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { encontroSchema, notaSchema } from "../schemas/apiSchemas.js";
import { validar } from "../middlewares/validate.js";

const router = Router();
router.use(authMiddleware);

// Notas individuais
router.put("/notas/:id", validar(notaSchema), notaController.atualizar);
router.delete("/notas/:id", notaController.remover);

// Encontros individuais
router.get("/encontros/:id", encontroController.obterPorId);
router.put("/encontros/:id", validar(encontroSchema), encontroController.atualizar);
router.delete("/encontros/:id", encontroController.remover);

// Mapas individuais
router.get("/mapas/:id", recursoMapaController.obterPorId);
router.put("/mapas/:id", recursoMapaController.atualizar);
router.delete("/mapas/:id", recursoMapaController.remover);

export default router;
