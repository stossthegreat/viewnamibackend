// backend/cache/rewriteCache.js

import { getCached, setCached, hashContent } from "./cacheClient.js";

// 🔥 CACHE VERSION - Bump this number to invalidate all old cache
// v1 = original (broken language)
// v2 = fixed language mapping
const CACHE_VERSION = "v2";

const REWRITE_TTL =
  parseInt(process.env.REWRITE_CACHE_TTL, 10) || 60 * 60 * 24 * 7; // 7 days

function buildKey({ text, presetId, language = "auto" }) {
  const hash = hashContent(text);
  files // Include version in key so old cache is ignored
  return `${CACHE_VERSION}:rewrite:${presetId}:${language}:${hash}`;
}

export async function getRewriteFromCache({ text, presetId, language }) {
  const key = buildKey({ text, presetId, language });
  return await getCached(key);
}

export async function setRewriteInCache({ text, presetId, language, output }) {
  const key = buildKey({ text, presetId, language });
  return await setCached(key, output, REWRITE_TTL);
}
