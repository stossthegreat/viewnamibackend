// backend/app.js

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import rewriteRoutes from "./routes/rewrite.js";
import transcribeRoutes from "./routes/transcribe.js";
import subscriptionRoutes from "./routes/subscription.js";
import textTransformRoutes from "./routes/textTransform.js";
import chatRoutes from "./routes/chat.js";
import dailyRoutes from "./routes/daily.js";
import viralRoutes from "./routes/viral.js";

// Import text transformation controller
import { transformText, translateText, getActions } from "./controllers/textTransformationController.js";

import { AppError, globalErrorHandler } from "./utils/errors.js";

// Try to import extract routes (optional - backward compatible)
let extractRoutes = null;
try {
  const module = await import("./routes/extract.js");
  extractRoutes = module.default;
  console.log("✅ Extract routes loaded");
} catch (err) {
  console.warn("⚠️ Extract routes not available (old deployment):", err.message);
}

const app = express();

// ========= MIDDLEWARE =========

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

// Body parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Compression = faster responses
app.use(compression());

// Basic rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    message: "Too many requests. Chill.",
  })
);

// ========= HEALTH ROUTES =========
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/stats", (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || "development",
  });
});

// ========= APP ROUTES =========
app.use("/api/rewrite", rewriteRoutes);
app.use("/api/transcribe", transcribeRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/transform", textTransformRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/viral", viralRoutes);

// AI Text Transformation Routes - THE VIRAL KILLER
app.post("/api/transform-text", transformText);
app.post("/api/translate-text", translateText);
app.get("/api/ai-actions", getActions);

// Register extract routes if available
if (extractRoutes) {
  app.use("/api/extract", extractRoutes);
  console.log("✅ Extract endpoints registered at /api/extract");
}

// ========= 404 HANDLER =========
app.all("*", (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

// ========= GLOBAL ERROR HANDLER =========
app.use(globalErrorHandler);

export default app;

