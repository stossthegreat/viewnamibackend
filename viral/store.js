// ============================================================
//   VIRAL DATA STORE — THE INTELLIGENCE LAYER
// ============================================================
//
// Loads, serves, and manages monthly viral intelligence
// per platform. This is what makes the AI actually know
// what's going viral RIGHT NOW.
//
// Data files live in viral/data/{platform}_{month}_{year}.json
// Fallback: if current month missing, use most recent available
//
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

// In-memory cache of loaded viral data
const viralCache = {};

// ============================================================
// PLATFORM CONFIG
// ============================================================

export const PLATFORMS = {
  tiktok: { name: "TikTok", key: "tiktok" },
  instagram: { name: "Instagram", key: "instagram" },
  x: { name: "X (Twitter)", key: "x" },
  reddit: { name: "Reddit", key: "reddit" },

  linkedin: { name: "LinkedIn", key: "linkedin" },
  youtube: { name: "YouTube", key: "youtube" },
  facebook: { name: "Facebook", key: "facebook" },
};

// ============================================================
// DATA SCHEMA — What each platform's viral file contains
// ============================================================
//
// {
//   "platform": "tiktok",
//   "month": "April",
//   "year": 2026,
//   "generated_at": "2026-04-01T00:00:00Z",
//   "data_points_analyzed": 10000,
//
//   "hooks": [
//     { "pattern": "Nobody talks about...", "trend_pct": 280, "example_count": 145 },
//     { "pattern": "POV: you just...", "trend_pct": 190, "example_count": 98 }
//   ],
//
//   "best_times": [
//     { "day": "Tuesday", "time": "7pm", "engagement_avg": 12.3 },
//     { "day": "Thursday", "time": "11am", "engagement_avg": 9.8 }
//   ],
//
//   "hashtags": [
//     { "tag": "#fyp", "avg_views": 2400000, "growth_pct": 15 },
//     { "tag": "#gymtok", "avg_views": 890000, "growth_pct": 340 }
//   ],
//
//   "formats": [
//     { "name": "Story time with voiceover", "trend_pct": 180, "avg_engagement": 11.2 },
//     { "name": "Green screen reaction", "trend_pct": 95, "avg_engagement": 8.1 }
//   ],
//
//   "trending_sounds": [
//     { "name": "Original Audio - @creator", "usage_count": 45000 }
//   ],
//
//   "insights": "Story-based content is outperforming tutorials 3:1 this month...",
//
//   "top_posts": [
//     {
//       "author": "@jessicasmith",
//       "followers": 2400000,
//       "caption": "Nobody talks about the gym rules...",
//       "hook_format": "nobody_talks_about",
//       "views": 4200000,
//       "likes": 890000,
//       "saves": 340000,
//       "engagement_rate": 12.1,
//       "posted_date": "2026-03-28",
//       "posted_time": "19:00",
//       "hashtags": ["#gymtok", "#fyp", "#relatable"],
//       "url": "https://tiktok.com/..."
//     }
//   ]
// }
//
// ============================================================

// ============================================================
// LOAD VIRAL DATA FOR PLATFORM
// ============================================================

/**
 * Get the latest viral data for a platform
 * Checks current month first, falls back to most recent
 * @param {string} platformKey - e.g. "tiktok", "instagram"
 * @returns {object|null} Viral data or null if none available
 */
export function getViralData(platformKey) {
  // Check in-memory cache first
  const cacheKey = `${platformKey}_latest`;
  if (viralCache[cacheKey] && viralCache[cacheKey]._loadedAt > Date.now() - 3600000) {
    return viralCache[cacheKey];
  }

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return null;
  }

  // Find the most recent file for this platform
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith(platformKey + "_") && f.endsWith(".json"))
    .sort()
    .reverse(); // Most recent first (alphabetical sort on YYYY_MM works)

  if (files.length === 0) return null;

  try {
    const filePath = path.join(DATA_DIR, files[0]);
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    data._loadedAt = Date.now();
    data._fileName = files[0];
    viralCache[cacheKey] = data;
    return data;
  } catch (err) {
    console.error(`Failed to load viral data for ${platformKey}:`, err.message);
    return null;
  }
}

// ============================================================
// GET ALL AVAILABLE VIRAL DATA
// ============================================================

/**
 * Get viral data for all platforms that have data
 * @returns {object} { tiktok: {...}, instagram: {...}, ... }
 */
export function getAllViralData() {
  const result = {};
  for (const key of Object.keys(PLATFORMS)) {
    const data = getViralData(key);
    if (data) result[key] = data;
  }
  return result;
}

// ============================================================
// BUILD VIRAL CONTEXT FOR PROMPT
// ============================================================

/**
 * Build a formatted string of viral intelligence for injection into prompts
 * @param {string} platformKey - Platform to get data for
 * @returns {string} Formatted viral context or empty string
 */
export function buildViralContext(platformKey) {
  const data = getViralData(platformKey);
  if (!data) return "";

  const parts = [];

  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REAL VIRAL DATA — ${data.platform?.toUpperCase() || platformKey.toUpperCase()} — ${data.month || "Current"} ${data.year || ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on analysis of ${(data.data_points_analyzed || 0).toLocaleString()} viral posts.
USE THIS DATA. Reference these patterns. This is what's ACTUALLY working.`);

  // Hooks
  if (data.hooks?.length > 0) {
    parts.push(`\nTOP HOOK PATTERNS THIS MONTH:`);
    data.hooks.slice(0, 10).forEach((h, i) => {
      parts.push(`${i + 1}. "${h.pattern}" ${h.trend_pct ? `(↑${h.trend_pct}% this month)` : ""}`);
    });
  }

  // Best times
  if (data.best_times?.length > 0) {
    parts.push(`\nBEST POSTING TIMES (from real engagement data):`);
    data.best_times.slice(0, 5).forEach(t => {
      parts.push(`• ${t.day} ${t.time} — avg ${t.engagement_avg}% engagement`);
    });
  }

  // Hashtags
  if (data.hashtags?.length > 0) {
    parts.push(`\nTRENDING HASHTAGS:`);
    const tags = data.hashtags.slice(0, 15).map(h =>
      `${h.tag}${h.growth_pct > 50 ? ` (↑${h.growth_pct}%)` : ""}`
    );
    parts.push(tags.join("  "));
  }

  // Formats
  if (data.formats?.length > 0) {
    parts.push(`\nTRENDING FORMATS:`);
    data.formats.slice(0, 5).forEach(f => {
      parts.push(`• ${f.name} — ${f.avg_engagement}% avg engagement ${f.trend_pct ? `(↑${f.trend_pct}%)` : ""}`);
    });
  }

  // Sounds
  if (data.trending_sounds?.length > 0) {
    parts.push(`\nTRENDING SOUNDS/AUDIO:`);
    data.trending_sounds.slice(0, 5).forEach(s => {
      parts.push(`• ${s.name} (${(s.usage_count || 0).toLocaleString()} uses)`);
    });
  }

  // Insights
  if (data.insights) {
    parts.push(`\nKEY INSIGHT:\n${data.insights}`);
  }

  // Top creator examples for citations
  if (data.top_posts?.length > 0) {
    parts.push(`\nTOP VIRAL CREATORS TO REFERENCE (cite these in your output):`);
    data.top_posts.slice(0, 5).forEach(p => {
      parts.push(`📊 @${p.author?.replace('@', '') || 'unknown'} (${(p.followers || 0).toLocaleString()} followers) — "${(p.caption || '').substring(0, 60)}..." — ${(p.views || 0).toLocaleString()} views, ${p.engagement_rate || 0}% engagement, posted ${p.posted_date || 'recently'}`);
    });
  }

  parts.push(`
⚠️ MANDATORY RULES FOR USING THIS DATA:
1. You MUST use these real patterns in your output — do not invent or guess trends
2. You MUST cite specific numbers (↑280%, 4.2M views, 12% engagement)
3. You MUST reference specific creators when relevant (@username, X views)
4. You MUST state the best posting times from the data above
5. You MUST use the trending hashtags listed, not made-up ones
6. If you ignore this data and write generic content, you have FAILED your job`);

  return parts.join("\n");
}

// ============================================================
// BUILD EVIDENCE CANDIDATES
// ============================================================

/**
 * Get top posts from viral data that can be used as evidence/sources
 * @param {string} platformKey
 * @param {number} limit
 * @returns {Array} Top posts for evidence cards
 */
export function getEvidencePosts(platformKey, limit = 5) {
  const data = getViralData(platformKey);
  if (!data?.top_posts) return [];
  return data.top_posts.slice(0, limit);
}

// ============================================================
// GET BONUS CARD DATA
// ============================================================

/**
 * Get structured bonus card data for a platform
 * @param {string} platformKey
 * @returns {object} { best_time, hashtags, trending_sound, format_trend }
 */
export function getBonusCardData(platformKey) {
  const data = getViralData(platformKey);
  if (!data) return null;

  return {
    best_time: data.best_times?.slice(0, 3).map(t => `${t.day} ${t.time}`).join(", ") || null,
    hashtags: data.hashtags?.slice(0, 8).map(h => h.tag) || [],
    trending_sound: data.trending_sounds?.[0]?.name || null,
    format_trend: data.formats?.[0] ? `${data.formats[0].name} (↑${data.formats[0].trend_pct || 0}%)` : null,
    data_points: data.data_points_analyzed || 0,
    month: data.month || "Current",
    year: data.year || new Date().getFullYear(),
  };
}

// ============================================================
// MAP PRESET ID TO PLATFORM KEY
// ============================================================

const PRESET_TO_PLATFORM = {
  // Instagram
  ig_reel_script: "instagram",
  ig_caption: "instagram",
  ig_carousel: "instagram",
  ig_story: "instagram",
  ig_bio: "instagram",
  // TikTok
  tt_hook: "tiktok",
  tt_script: "tiktok",
  tt_caption: "tiktok",
  tt_duet_stitch: "tiktok",
  tt_series: "tiktok",
  // X
  x_post: "x",
  x_thread: "x",
  x_hot_take: "x",
  x_quote_reply: "x",
  // Reddit
  reddit_post: "reddit",
  reddit_comment: "reddit",
  reddit_story: "reddit",
  // LinkedIn
  li_post: "linkedin",
  li_carousel: "linkedin",
  li_comment: "linkedin",
  // YouTube
  yt_title_thumb: "youtube",
  yt_shorts_script: "youtube",
  yt_description: "youtube",
  yt_community: "youtube",
  // Facebook
  fb_post: "facebook",
  fb_reel: "facebook",
  fb_group: "facebook",
  // Tools
  magic_viral: null,
  repurpose: null,
  shorten: null,
  expand: null,
  rewrite_viral: null,
  outcomes: null,
};

/**
 * Get platform key for a preset ID
 * @param {string} presetId
 * @returns {string|null}
 */
export function getPlatformForPreset(presetId) {
  return PRESET_TO_PLATFORM[presetId] || null;
}

// ============================================================
// CLEAR CACHE (for when new data is loaded)
// ============================================================

export function clearViralCache() {
  Object.keys(viralCache).forEach(k => delete viralCache[k]);
  console.log("🔄 Viral data cache cleared");
}

export default {
  getViralData,
  getAllViralData,
  buildViralContext,
  getEvidencePosts,
  getBonusCardData,
  getPlatformForPreset,
  clearViralCache,
  PLATFORMS,
};
