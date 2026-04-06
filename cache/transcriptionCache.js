// backend/cache/transcriptionCache.js

import { getCached, setCached, hashContent } from "./cacheClient.js";

const TRANSCRIPTION_TTL =
  parseInt(process.env.TRANSCRIPTION_CACHE_TTL, 10) || 60 * 60 * 24; // 24h

function buildKeyFromAudio(audioBuffer) {
  const hash = hashContent(audioBuffer);
  return `transcription:${hash}`;
}

export async function getTranscriptionFromCache(audioBuffer) {
  const key = buildKeyFromAudio(audioBuffer);
  return await getCached(key);
}

export async function setTranscriptionInCache(audioBuffer, text) {
  const key = buildKeyFromAudio(audioBuffer);
  return await setCached(key, text, TRANSCRIPTION_TTL);
}

