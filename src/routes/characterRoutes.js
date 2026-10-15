import { Router } from "express";
import { characterController } from "../controllers/characterController.js";

const router = Router();

router.get("/", characterController.list);
router.post("/sync", characterController.sync);
router.get("/:id", characterController.getById);
router.post("/", characterController.create);
router.put("/:id", characterController.update);
router.delete("/:id", characterController.delete);
router.post("/:id/bank/verify", characterController.verifyBankPassword);

export default router;
