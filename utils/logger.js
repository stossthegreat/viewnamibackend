// backend/utils/logger.js

export function logRequest(req) {
  console.log(
    `➡️ ${req.method} ${req.originalUrl} | IP: ${req.ip} | Agent: ${req.get(
      "user-agent"
    )}`
  );
}

export function logResponse(route, durationMs) {
  console.log(`⬅️ ${route} completed in ${durationMs}ms`);
}

export function logError(err) {
  console.error("❌ ERROR:", err.message);
}

