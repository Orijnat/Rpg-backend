import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { exportController } from "../controllers/exportController.js";

const router = Router();
router.use(authMiddleware);

router.get("/characters/:id.csv", exportController.characterCsv);
router.get("/npcs.csv", exportController.npcsCsv);
router.get("/campaign/:id.csv", exportController.campaignCsv);

export default router;
