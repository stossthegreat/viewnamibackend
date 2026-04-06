// backend/routes/daily.js

import { Router } from "express";
import { getDailyIntelligence } from "../controllers/dailyController.js";

const router = Router();

// GET /api/daily — Today's intelligence package
// Query: ?platform=tiktok (optional)
router.get("/", getDailyIntelligence);

export default router;
