import { Router } from "express";
import { characterController } from "../controllers/characterController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/", characterController.list);
router.post("/sync", characterController.sync);
router.get("/:id", characterController.getById);
router.post("/", characterController.create);
router.put("/:id", characterController.update);
router.delete("/:id", characterController.delete);
router.post("/:id/bank/verify", characterController.verifyBankPassword);

export default router;
