// backend/config/redis.js

import Redis from "ioredis";

let redisClient = null;

export async function initRedis() {
  // Skip Redis if no URL configured — app works fine without caching
  if (!process.env.REDIS_URL) {
    console.log("⚠️ No REDIS_URL set — running without cache (this is fine)");
    return;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    await redisClient.connect();
    console.log("🔗 Redis connected");

    redisClient.on("error", (err) =>
      console.error("❌ Redis error:", err.message)
    );
  } catch (err) {
    console.error("Redis init failed (continuing without cache):", err.message);
    redisClient = null;
  }
}

export function getRedis() {
  return redisClient;
}

export async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log("Redis closed");
    } catch (err) {
      console.error("Redis close error:", err);
    }
  }
}
