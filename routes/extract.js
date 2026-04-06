// backend/routes/extract.js

import express from "express";
import { extractOutcomes, extractUnstuck } from "../controllers/extractController.js";
import { extractSmartActions } from "../controllers/smartActionsController.js";

const router = express.Router();

// Extract outcomes from text (for Outcomes preset)
router.post("/outcomes", extractOutcomes);

// Extract insight + action from text (for Unstuck preset)
router.post("/unstuck", extractUnstuck);

// Extract smart actions from text (for Smart Actions preset)
router.post("/actions", extractSmartActions);

export default router;
