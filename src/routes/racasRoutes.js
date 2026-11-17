import { Router } from "express";
import { racasController } from "../controllers/racasController.js";

const router = Router();

// Públicos: o cadastro de jogador é público e precisa listar as raças antes do login.
router.get("/", racasController.list);
router.get("/:id", racasController.getById);

export default router;
