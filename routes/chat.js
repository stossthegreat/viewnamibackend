// backend/routes/chat.js

import { Router } from "express";
import { chat } from "../controllers/chatController.js";

const router = Router();

// POST /api/chat — Strategy tab conversational endpoint
router.post("/", chat);

export default router;
