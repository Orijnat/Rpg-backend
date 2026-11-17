import { Router } from "express";
import { characterController } from "../controllers/characterController.js";
import { mountController } from "../controllers/mountController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validar } from "../middlewares/validate.js";
import { fichaSchema, sincronizacaoSchema, senhaCofreSchema } from "../schemas/apiSchemas.js";

const router = Router();

router.use(authMiddleware);

router.get("/", characterController.list);
router.post("/sync", validar(sincronizacaoSchema), characterController.sync);
router.get("/:id", characterController.getById);
router.post("/", validar(fichaSchema), characterController.create);
router.put("/:id", validar(fichaSchema), characterController.update);
router.delete("/:id", characterController.delete);
router.post("/:id/bank/verify", validar(senhaCofreSchema), characterController.verifyBankPassword);
router.put("/:id/bank/password", validar(senhaCofreSchema), characterController.setBankPassword);

router.get("/:id/mounts", mountController.list);
router.post("/:id/mounts", mountController.create);
router.put("/:id/mounts/:mountId", mountController.update);
router.delete("/:id/mounts/:mountId", mountController.remove);

export default router;
