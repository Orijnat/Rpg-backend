import { Router } from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middlewares/authMiddleware.js";
import { arquivoController, arquivoUploadMiddleware } from "../controllers/arquivoController.js";

const router = Router();

// Leitura <img src>: token assinado na query OU Authorization no header
router.get("/:id", optionalAuthMiddleware, arquivoController.servir);

router.use(authMiddleware);
router.get("/", arquivoController.listar);
router.post("/", arquivoUploadMiddleware, arquivoController.upload);
router.post("/urls", arquivoController.mintReadUrls);
router.delete("/:id", arquivoController.remover);

export default router;
