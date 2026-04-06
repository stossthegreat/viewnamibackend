// backend/cache/cacheClient.js

import crypto from "crypto";
import { getRedis } from "../config/redis.js";

export function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function getCached(key) {
  const client = getRedis();
  if (!client) return null;

  try {
    const value = await client.get(key);
    return value;
  } catch (err) {
    console.error("Cache get error:", err.message);
    return null;
  }
}

export async function setCached(key, value, ttlSeconds) {
  const client = getRedis();
  if (!client) return false;

  try {
    if (ttlSeconds) {
      await client.set(key, value, "EX", ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.error("Cache set error:", err.message);
    return false;
  }
}

