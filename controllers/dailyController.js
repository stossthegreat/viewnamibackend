// ============================================================
//   DAILY INTELLIGENCE — THE DAILY DECISION ENGINE
// ============================================================
//
// Returns personalized daily intelligence:
// - Today's edge (best time, format, hook style)
// - Trend snapshot (what's up/down)
// - What to post today (full plan)
// - Quick tips per platform
// - Micro-coaching insights
//
// All computed from the viral data store.
// Refreshes based on day of week + time of day.
//
// ============================================================

import { getAllViralData, getViralData, PLATFORMS } from "../viral/store.js";

// ============================================================
// GET /api/daily
// ============================================================

/**
 * Returns today's intelligence package
 * Query: ?platform=tiktok (optional, defaults to best across all)
 */
export async function getDailyIntelligence(req, res, next) {
  try {
    const requestedPlatform = req.query.platform || null;
    const now = new Date();
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
    const currentHour = now.getHours();

    const allData = getAllViralData();
    const platforms = Object.keys(allData);

    if (platforms.length === 0) {
      return res.json({
        todays_edge: null,
        trends: null,
        daily_plan: null,
        tips: [],
        avoid_today: [],
        data_available: false,
      });
    }

    // Pick the focus platform
    const focusPlatform = requestedPlatform && allData[requestedPlatform]
      ? requestedPlatform
      : platforms[0];

    const data = allData[focusPlatform];

    // ══════════════════════════════════════
    // TODAY'S EDGE
    // ══════════════════════════════════════
    const todaysBestTime = findBestTimeToday(data, dayOfWeek, currentHour);
    const topFormat = data.formats?.[0] || null;
    const topHook = data.hooks?.[0] || null;

    const todays_edge = {
      platform: PLATFORMS[focusPlatform]?.name || focusPlatform,
      platform_key: focusPlatform,
      best_time: todaysBestTime,
      format: topFormat ? topFormat.name : null,
      format_trend: topFormat ? `↑${topFormat.trend_pct}%` : null,
      hook_style: topHook ? topHook.pattern : null,
      hook_trend: topHook ? `↑${topHook.trend_pct}%` : null,
      time_status: getTimeStatus(todaysBestTime, currentHour),
    };

    // ══════════════════════════════════════
    // TREND SNAPSHOT
    // ══════════════════════════════════════
    const trends = {
      rising: [],
      falling: [],
    };

    if (data.formats) {
      const sorted = [...data.formats].sort((a, b) => (b.trend_pct || 0) - (a.trend_pct || 0));
      trends.rising = sorted.slice(0, 3).map(f => ({
        name: f.name,
        change: `↑${f.trend_pct || 0}%`,
        engagement: `${f.avg_engagement || 0}%`,
      }));
      // Lowest trending = what's falling
      const lowest = sorted.slice(-2).filter(f => (f.trend_pct || 0) < 50);
      trends.falling = lowest.map(f => ({
        name: f.name,
        change: `↓${100 - (f.trend_pct || 0)}%`,
      }));
    }

    if (data.hooks) {
      const topHooks = [...data.hooks]
        .sort((a, b) => (b.trend_pct || 0) - (a.trend_pct || 0))
        .slice(0, 3);
      trends.hot_hooks = topHooks.map(h => ({
        pattern: h.pattern,
        change: `↑${h.trend_pct || 0}%`,
      }));
    }

    // ══════════════════════════════════════
    // DAILY PLAN — "WHAT TO POST TODAY"
    // ══════════════════════════════════════
    const daily_plan = {
      platform: PLATFORMS[focusPlatform]?.name || focusPlatform,
      platform_key: focusPlatform,
      post_type: topFormat ? topFormat.name : "Reel",
      hook: topHook ? topHook.pattern.replace("...", "") : "Start with impact",
      time: todaysBestTime || "7:00 PM",
      hashtags: data.hashtags?.slice(0, 5).map(h => h.tag) || [],
      confidence: data.data_points_analyzed
        ? `Based on ${data.data_points_analyzed.toLocaleString()} analyzed posts`
        : "Based on viral data analysis",
    };

    // ══════════════════════════════════════
    // PLATFORM TIPS
    // ══════════════════════════════════════
    const tips = buildPlatformTips(focusPlatform, data);

    // ══════════════════════════════════════
    // AVOID TODAY
    // ══════════════════════════════════════
    const avoid_today = buildAvoidList(focusPlatform, data);

    // ══════════════════════════════════════
    // ALL PLATFORMS SUMMARY (for multi-platform view)
    // ══════════════════════════════════════
    const all_platforms = {};
    for (const [key, pData] of Object.entries(allData)) {
      all_platforms[key] = {
        name: PLATFORMS[key]?.name || key,
        top_hook: pData.hooks?.[0]?.pattern || null,
        top_format: pData.formats?.[0]?.name || null,
        best_time: findBestTimeToday(pData, dayOfWeek, currentHour),
        data_points: pData.data_points_analyzed || 0,
      };
    }

    return res.json({
      todays_edge,
      trends,
      daily_plan,
      tips,
      avoid_today,
      all_platforms,
      data_available: true,
      day: dayOfWeek,
      generated_at: now.toISOString(),
    });

  } catch (err) {
    return next(err);
  }
}

// ============================================================
// HELPERS
// ============================================================

function findBestTimeToday(data, dayOfWeek, currentHour) {
  if (!data.best_times?.length) return null;

  // Find time for today's day of week
  const todayTime = data.best_times.find(t =>
    t.day.toLowerCase() === dayOfWeek.toLowerCase()
  );

  if (todayTime) return todayTime.time;

  // Fallback to highest engagement time
  const sorted = [...data.best_times].sort((a, b) =>
    (b.engagement_avg || 0) - (a.engagement_avg || 0)
  );
  return sorted[0]?.time || null;
}

function getTimeStatus(bestTime, currentHour) {
  if (!bestTime) return "unknown";

  // Parse time like "7:00 PM" to hour
  const match = bestTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return "upcoming";

  let hour = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  const diff = hour - currentHour;
  if (diff < 0) return "passed";
  if (diff === 0) return "now";
  if (diff <= 2) return "soon";
  return "upcoming";
}

function buildPlatformTips(platformKey, data) {
  const baseTips = {
    tiktok: [
      "Hook in first 1-2 seconds — no intros",
      "Ideal length: 7-15 seconds for max completion rate",
      "Pattern interrupt early (movement, text, sound change)",
      "Repeat winning formats — don't reinvent every post",
    ],
    instagram: [
      "Reels = reach, Carousels = saves, Stories = engagement",
      "Visual hook + text overlay in first frame",
      "Strong captions still matter for the algorithm",
      "Make them STOP scrolling first — THEN explain",
    ],
    x: [
      "First line = EVERYTHING. If it doesn't hit, nothing else matters",
      "Short + punchy wins over long + detailed",
      "Threads = storytelling + curiosity gaps",
      "Controversial (but defensible) takes get the most engagement",
    ],
    reddit: [
      "90% of performance is in the title",
      "Don't sound like marketing — authenticity is everything",
      "Story format > selling format",
      "Raw honesty wins. If it sounds like promotion, it dies",
    ],
    linkedin: [
      "Personal story + lesson = the viral formula",
      "Simple language wins over impressive vocabulary",
      "Talk like a human, not a CEO",
      "Hook line determines 80% of performance",
    ],
    youtube: [
      "Title + thumbnail = 90% of CTR",
      "Don't give away the answer in the title",
      "For Shorts: end in a way that makes it replay",
      "Retention in first 30 seconds decides everything",
    ],
    facebook: [
      "Questions drive the most comments",
      "Nostalgic + relatable content gets shared",
      "Groups are where organic reach still lives",
      "Tag-worthy content spreads faster",
    ],
  };

  const tips = baseTips[platformKey] || baseTips.tiktok;

  // Add dynamic tip from viral data
  if (data.insights) {
    tips.unshift(data.insights.split(". ")[0] + ".");
  }

  return tips.slice(0, 5);
}

function buildAvoidList(platformKey, data) {
  const baseAvoid = {
    tiktok: [
      "Overlong intros — hook must be instant",
      "No hook in first 2 seconds",
      "Static camera with no movement",
      "Walls of text on screen",
    ],
    instagram: [
      "Caption-only posts (no visual hook)",
      "Hashtag spam (more than 8-10)",
      "Posting without a hook in first frame",
      "Ignoring Reels for static posts",
    ],
    x: [
      "Starting tweets with 'I think...' (weak opener)",
      "Threads longer than 10 tweets",
      "Hashtag overuse (max 1-2 on X)",
      "Being vague instead of specific",
    ],
    reddit: [
      "Anything that sounds like marketing",
      "Clickbait titles that don't deliver",
      "Walls of text without formatting",
      "Self-promotion without value first",
    ],
  };

  return (baseAvoid[platformKey] || baseAvoid.tiktok).slice(0, 4);
}

export default { getDailyIntelligence };
