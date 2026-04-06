// backend/routes/rewrite.js

import express from "express";
import { batchRewrite, streamRewrite } from "../controllers/rewriteController.js";

const router = express.Router();

// Non-streaming
router.post("/batch", batchRewrite);

// Streaming (SSE)
router.post("/", streamRewrite);

export default router;
