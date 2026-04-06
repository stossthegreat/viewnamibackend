// backend/config/redis.js

import Redis from "ioredis";

let redisClient = null;

export async function initRedis() {
  try {
    redisClient = new Redis(process.env.REDIS_URL);

    redisClient.on("connect", () => console.log("🔗 Redis connected"));
    redisClient.on("error", (err) =>
      console.error("❌ Redis error:", err.message)
    );
  } catch (err) {
    console.error("Redis init failed:", err);
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
