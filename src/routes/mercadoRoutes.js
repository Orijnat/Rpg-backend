import { Router } from "express";
import { authMiddleware, requireMaster } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { mercadoVendedorSchema, mercadoItemSchema } from "../schemas/apiSchemas.js";
import { mercadoController } from "../controllers/mercadoController.js";

const router = Router();
router.use(authMiddleware);
router.use(requireMaster);

router.get("/vendedores", mercadoController.listarVendedores);
router.post("/vendedores", validar(mercadoVendedorSchema), mercadoController.criarVendedor);
router.put("/vendedores/:id", validar(mercadoVendedorSchema), mercadoController.atualizarVendedor);
router.delete("/vendedores/:id", mercadoController.removerVendedor);

router.get("/itens", mercadoController.listarItens);
router.post("/itens", validar(mercadoItemSchema), mercadoController.criarItem);
router.put("/itens/:id", validar(mercadoItemSchema), mercadoController.atualizarItem);
router.delete("/itens/:id", mercadoController.removerItem);

export default router;
