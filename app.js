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




import { AppError, globalErrorHandler } from "./utils/errors.js";

// Try to import extract routes (optional)
let extractRoutes = null;
try {
  const module = await import("./routes/extract.js");
  extractRoutes = module.default;
  console.log("✅ Extract routes loaded");
} catch (err) {
  console.warn("⚠️ Extract routes not available:", err.message);
}

const app = express();

// ========= MIDDLEWARE =========
app.use(helmet());
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, message: "Too many requests." }));

// ========= HEALTH =========
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/stats", (req, res) => {
  res.json({ uptime: process.uptime(), memory: process.memoryUsage(), env: process.env.NODE_ENV || "development" });
});

// ========= ROUTES =========
app.use("/api/rewrite", rewriteRoutes);
app.use("/api/transcribe", transcribeRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/transform", textTransformRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/viral", viralRoutes);

// Text transform routes (dynamic import for CJS compat)
try {
  const ttc = await import("./controllers/textTransformationController.js");
  app.post("/api/transform-text", ttc.transformText);
  app.post("/api/translate-text", ttc.translateText);
  app.get("/api/ai-actions", ttc.getActions);
  console.log("✅ Text transform routes loaded");
} catch (err) {
  console.warn("⚠️ Text transform routes not available:", err.message);
}



if (extractRoutes) {
  app.use("/api/extract", extractRoutes);
  console.log("✅ Extract endpoints registered");
}

// ========= 404 =========
app.all("*", (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

export default app;
