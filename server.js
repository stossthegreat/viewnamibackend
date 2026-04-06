// backend/server.js

console.log("SERVER STARTING… LOADING FILES NOW");

import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app.js";
import { initRedis, closeRedis } from "./config/redis.js";

// ===== ENV & CONSTANTS =====
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

let server;

// ===== PROCESS-LEVEL SAFETY NETS =====
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});

// ===== START SERVER =====
async function startServer() {
  try {
    console.log("Starting ViewNami backend…");

    // Init Redis (non-fatal if it fails)
    try {
      await initRedis();
    } catch (err) {
      console.error(
        "Redis init failed (continuing without cache):",
        err.message
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "WARNING: OPENAI_API_KEY not set. OpenAI calls will fail until it's configured."
      );
    } else {
      console.log("✅ OpenAI API key detected.");
    }

    // Create HTTP server from Express app
    server = http.createServer(app);

    server.listen(PORT, "0.0.0.0", () => {
      console.log("");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 ViewNami Backend Server Running");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📍 Environment: ${NODE_ENV}`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log(`📊 Stats: http://localhost:${PORT}/stats`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("");
    });

    // Timeouts tuned for SSE streaming stability
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// ===== GRACEFUL SHUTDOWN =====
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log("HTTP server closed");
          resolve();
        });
      });
    }

    await closeRedis();

    console.log("Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ===== BOOTSTRAP =====
startServer();

export default server;
// Build trigger Mon Apr  6 21:18:33 BST 2026
