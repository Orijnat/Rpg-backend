import { Router } from "express";
import { authController } from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { registroSchema, loginSchema } from "../schemas/apiSchemas.js";
import { authRateLimiter } from "../middlewares/security.js";

const router = Router();

router.post("/register", authRateLimiter, validar(registroSchema), authController.register);
router.post("/login", authRateLimiter, validar(loginSchema), authController.login);
router.get("/me", authMiddleware, authController.me);
router.put("/me", authMiddleware, authController.updateProfile);
router.post("/logout", authMiddleware, authController.logout);

export default router;
