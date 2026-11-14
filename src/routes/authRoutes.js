import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { registroSchema, loginSchema, verificarEmailSchema, reenviarVerificacaoSchema, pedidoRedefinicaoSchema, redefinirSenhaSchema } from "../schemas/apiSchemas.js";
import { authRateLimiter } from "../middlewares/security.js";

const router = Router();

router.post("/register", authRateLimiter, validar(registroSchema), authController.register);
router.post("/login", authRateLimiter, validar(loginSchema), authController.login);
router.get("/me", authMiddleware, authController.me);
router.put("/me", authMiddleware, authController.updateProfile);
router.post("/logout", authMiddleware, authController.logout);
router.post("/verify-email", authRateLimiter, validar(verificarEmailSchema), authController.verifyEmail);
router.post("/resend-verification", authRateLimiter, validar(reenviarVerificacaoSchema), authController.resendVerification);
router.post("/forgot-password", authRateLimiter, validar(pedidoRedefinicaoSchema), authController.forgotPassword);
router.post("/reset-password", authRateLimiter, validar(redefinirSenhaSchema), authController.resetPassword);

export default router;
