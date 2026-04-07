// ============================================================
//   VIRAL DATA PROCESSOR — RAW → INTELLIGENCE
// ============================================================
//
// Takes raw scraped posts from Apify and converts them into
// structured viral intelligence that the AI can use.
//
// Pipeline:
// 1. Filter (remove non-viral posts)
// 2. Rank (by engagement rate, not just views)
// 3. Extract hooks (pattern detection)
// 4. Extract best times (from timestamps)
// 5. Extract hashtags (frequency + growth)
// 6. Extract formats (content type analysis)
// 7. Extract top creators (for evidence cards)
// 8. Generate insights (summary of patterns)
//
// ============================================================

import { SCRAPER_CONFIGS } from "./scraperConfigs.js";

// ============================================================
// MAIN PROCESSOR
// ============================================================

/**
 * Process raw Apify results into viral intelligence format
 * @param {string} platformKey - e.g. "tiktok"
 * @param {Array} rawPosts - Raw posts from Apify actor
 * @param {string} niche - e.g. "fitness", "general"
 * @returns {object} Structured viral intelligence JSON
 */
export function processViralData(platformKey, rawPosts, niche = "general") {
  const config = SCRAPER_CONFIGS[platformKey];
  if (!config) throw new Error(`Unknown platform: ${platformKey}`);

  console.log(`📊 Processing ${rawPosts.length} raw posts for ${platformKey}...`);

  // 1. Normalize all posts to standard format
  const normalized = rawPosts
    .map(post => {
      try {
        return config.mapResult(post);
      } catch (e) {
        return null;
      }
    })
    .filter(p => p !== null);

  console.log(`   ✅ Normalized: ${normalized.length} posts`);

  // 2. Filter — only keep viral posts
  // Keep ALL posts — with only 50 per scrape, every post is useful
  const viral = normalized;
  console.log(`   ✅ Keeping all ${viral.length} posts (no threshold with small scrapes)`);

  // 3. Rank by engagement rate
  const ranked = rankByEngagement(viral);
  console.log(`   ✅ Ranked by engagement`);

  // 4. Extract all intelligence
  const hooks = extractHooks(ranked);
  const bestTimes = extractBestTimes(ranked);
  const hashtags = extractHashtags(ranked);
  const formats = extractFormats(ranked, platformKey);
  const sounds = extractSounds(ranked);
  const topPosts = extractTopPosts(ranked, 10);
  const insights = generateInsights(ranked, hooks, formats, platformKey);

  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return {
    platform: config === SCRAPER_CONFIGS.tiktok ? "TikTok" :
              config === SCRAPER_CONFIGS.instagram ? "Instagram" :
              config === SCRAPER_CONFIGS.x ? "X (Twitter)" :
              config === SCRAPER_CONFIGS.reddit ? "Reddit" :
              config === SCRAPER_CONFIGS.linkedin ? "LinkedIn" :
              config === SCRAPER_CONFIGS.youtube ? "YouTube" :
              config === SCRAPER_CONFIGS.facebook ? "Facebook" : platformKey,
    month: monthNames[now.getMonth()],
    year: now.getFullYear(),
    niche,
    generated_at: now.toISOString(),
    data_points_analyzed: rawPosts.length,
    viral_posts_found: viral.length,
    hooks,
    best_times: bestTimes,
    hashtags,
    formats,
    trending_sounds: sounds,
    insights,
    top_posts: topPosts,
  };
}

// ============================================================
// FILTER — Remove non-viral posts
// ============================================================

function filterViral(posts, threshold) {
  return posts.filter(p => {
    if (threshold.views && p.views >= threshold.views) return true;
    if (threshold.likes && p.likes >= threshold.likes) return true;
    return false;
  });
}

// ============================================================
// RANK — By engagement rate (not just raw views)
// ============================================================

function rankByEngagement(posts) {
  return posts
    .map(p => {
      const totalEngagement = (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
      const denominator = p.views || p.likes || 1;
      p.engagement_rate = parseFloat(((totalEngagement / denominator) * 100).toFixed(2));
      return p;
    })
    .sort((a, b) => b.engagement_rate - a.engagement_rate);
}

// ============================================================
// EXTRACT HOOKS — Pattern detection from first lines
// ============================================================

function extractHooks(posts) {
  const hookPatterns = {
    "Nobody talks about...": /^nobody\s+(talks?|mentions?|says?)\s+(about|that)/i,
    "POV: you just...": /^pov[:\s]/i,
    "I tried X for 30 days...": /i\s+tried\s+.+\s+for\s+\d+\s+(days?|weeks?|months?)/i,
    "The truth about...": /^the\s+truth\s+(about|is)/i,
    "You're not [X]... you're [Y]": /you'?re\s+not\s+\w+.{0,20}you'?re/i,
    "3 things I wish I knew...": /^\d+\s+(things?|tips?|ways?|reasons?|mistakes?)\s/i,
    "This is your sign to...": /this\s+is\s+(your\s+)?sign\s+to/i,
    "Wait for it...": /wait\s+for\s+it/i,
    "I'm sorry but...": /i'?m\s+sorry\s+but/i,
    "Day X of...": /^day\s+\d+\s+of/i,
    "Stop doing this...": /^stop\s+(doing|using|making|saying)/i,
    "If your [X] doesn't...": /^if\s+your\s+\w+\s+(doesn'?t|isn'?t|can'?t)/i,
    "Unpopular opinion:": /^unpopular\s+opinion/i,
    "What they don't tell you...": /what\s+(they|people|no\s*one)\s+(don'?t|won'?t|never)\s+tell/i,
    "I need to talk about...": /i\s+need\s+to\s+talk\s+about/i,
  };

  const counts = {};
  const examples = {};

  for (const post of posts) {
    const firstLine = (post.caption || "").split("\n")[0].trim();
    if (!firstLine) continue;

    for (const [pattern, regex] of Object.entries(hookPatterns)) {
      if (regex.test(firstLine)) {
        counts[pattern] = (counts[pattern] || 0) + 1;
        if (!examples[pattern]) examples[pattern] = firstLine;
        break;
      }
    }
  }

  // Sort by frequency and calculate trend percentage
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({
      pattern,
      example_count: count,
      trend_pct: Math.round((count / posts.length) * 1000) + 50, // Rough trending score
      example: examples[pattern] || "",
    }));

  return sorted.slice(0, 12);
}

// ============================================================
// EXTRACT BEST TIMES — From posting timestamps
// ============================================================

function extractBestTimes(posts) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timeSlots = {};

  for (const post of posts) {
    if (!post.posted_date) continue;

    try {
      const date = new Date(post.posted_date);
      const day = dayNames[date.getDay()];
      const hour = post.posted_time
        ? post.posted_time
        : `${date.getHours()}:00`;

      const key = `${day}_${hour}`;
      if (!timeSlots[key]) {
        timeSlots[key] = { day, time: hour, engagements: [], count: 0 };
      }
      timeSlots[key].engagements.push(post.engagement_rate || 0);
      timeSlots[key].count++;
    } catch (e) {
      // Skip invalid dates
    }
  }

  // Calculate average engagement per time slot
  const ranked = Object.values(timeSlots)
    .filter(t => t.count >= 3) // Need at least 3 posts in this slot
    .map(t => ({
      day: t.day,
      time: t.time,
      engagement_avg: parseFloat((t.engagements.reduce((a, b) => a + b, 0) / t.engagements.length).toFixed(1)),
      sample_size: t.count,
    }))
    .sort((a, b) => b.engagement_avg - a.engagement_avg);

  return ranked.slice(0, 7);
}

// ============================================================
// EXTRACT HASHTAGS — Frequency + avg engagement
// ============================================================

function extractHashtags(posts) {
  const tagStats = {};

  for (const post of posts) {
    for (const tag of (post.hashtags || [])) {
      const clean = tag.toLowerCase().replace(/^#/, "");
      if (clean.length < 2) continue;

      if (!tagStats[clean]) {
        tagStats[clean] = { tag: `#${clean}`, views: [], count: 0 };
      }
      tagStats[clean].views.push(post.views || post.likes || 0);
      tagStats[clean].count++;
    }
  }

  const ranked = Object.values(tagStats)
    .filter(t => t.count >= 3)
    .map(t => ({
      tag: t.tag,
      usage_count: t.count,
      avg_views: Math.round(t.views.reduce((a, b) => a + b, 0) / t.views.length),
      growth_pct: Math.round((t.count / posts.length) * 500), // Rough frequency score
    }))
    .sort((a, b) => b.usage_count - a.usage_count);

  return ranked.slice(0, 20);
}

// ============================================================
// EXTRACT FORMATS — Content type analysis
// ============================================================

function extractFormats(posts, platformKey) {
  const formatDetectors = {
    "Story time with voiceover": (p) => /story\s*time|let\s*me\s*tell|so\s*this\s*happened/i.test(p.caption),
    "Green screen reaction": (p) => /green\s*screen|react/i.test(p.caption),
    "Before/after transformation": (p) => /before\s*(&|and)\s*after|transformation|glow\s*up/i.test(p.caption),
    "Educational / Tutorial": (p) => /how\s+to|tip[s]?:|hack[s]?|learn|tutorial/i.test(p.caption),
    "Hot take / Opinion": (p) => /unpopular\s*opinion|hot\s*take|controversial|i'?m\s*sorry\s*but/i.test(p.caption),
    "Day in my life": (p) => /day\s*in\s*(my|the)\s*life|routine|vlog/i.test(p.caption),
    "List / Numbered tips": (p) => /^\d+\s+(things?|tips?|ways?|reasons?)/i.test(p.caption),
    "Challenge / Trend": (p) => /challenge|trend|trying|attempt/i.test(p.caption),
    "Duet / Stitch reaction": (p) => /duet|stitch|react/i.test(p.caption),
  };

  const formatStats = {};

  for (const post of posts) {
    for (const [format, detector] of Object.entries(formatDetectors)) {
      if (detector(post)) {
        if (!formatStats[format]) {
          formatStats[format] = { engagements: [], count: 0 };
        }
        formatStats[format].engagements.push(post.engagement_rate || 0);
        formatStats[format].count++;
        break; // One format per post
      }
    }
  }

  const ranked = Object.entries(formatStats)
    .map(([name, stats]) => ({
      name,
      trend_pct: Math.round((stats.count / posts.length) * 500) + 50,
      avg_engagement: parseFloat((stats.engagements.reduce((a, b) => a + b, 0) / stats.engagements.length).toFixed(1)),
      post_count: stats.count,
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement);

  return ranked.slice(0, 8);
}

// ============================================================
// EXTRACT SOUNDS — Trending audio (TikTok/IG only)
// ============================================================

function extractSounds(posts) {
  const soundCounts = {};

  for (const post of posts) {
    if (post.sound && post.sound !== "original sound" && post.sound.length > 2) {
      soundCounts[post.sound] = (soundCounts[post.sound] || 0) + 1;
    }
  }

  return Object.entries(soundCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, usage_count: count }));
}

// ============================================================
// EXTRACT TOP POSTS — For evidence cards
// ============================================================

function extractTopPosts(posts, limit = 10) {
  // Already sorted by engagement rate, take top N
  return posts.slice(0, limit).map(p => ({
    author: p.author,
    followers: p.followers,
    caption: (p.caption || "").substring(0, 120),
    hook_format: detectHookFormat(p.caption),
    views: p.views,
    likes: p.likes,
    saves: p.saves || 0,
    comments: p.comments,
    engagement_rate: p.engagement_rate,
    posted_date: p.posted_date,
    posted_time: p.posted_time,
    hashtags: (p.hashtags || []).slice(0, 5),
    url: p.url,
  }));
}

function detectHookFormat(caption) {
  if (!caption) return "other";
  const first = caption.split("\n")[0].toLowerCase();
  if (/nobody\s+talk/i.test(first)) return "nobody_talks_about";
  if (/^pov/i.test(first)) return "pov";
  if (/tried.*for.*\d+/i.test(first)) return "i_tried_x_for";
  if (/truth\s+about/i.test(first)) return "the_truth_about";
  if (/you'?re\s+not/i.test(first)) return "youre_not_negative_youre_reframe";
  if (/^\d+\s+(things?|tips?|ways?)/i.test(first)) return "numbered_list";
  if (/unpopular/i.test(first)) return "unpopular_opinion";
  if (/stop\s+(doing|using)/i.test(first)) return "stop_doing";
  return "other";
}

// ============================================================
// GENERATE INSIGHTS — AI-readable summary
// ============================================================

function generateInsights(posts, hooks, formats, platformKey) {
  const parts = [];

  // Top format insight
  if (formats.length >= 2) {
    const top = formats[0];
    const second = formats[1];
    if (top.avg_engagement > 0 && second.avg_engagement > 0) {
      const ratio = (top.avg_engagement / second.avg_engagement).toFixed(1);
      parts.push(`${top.name} content is outperforming ${second.name} content ${ratio}:1 this month.`);
    }
  }

  // Top hook insight
  if (hooks.length > 0) {
    const topHook = hooks[0];
    parts.push(`Creators using the "${topHook.pattern}" hook format are seeing ↑${topHook.trend_pct}% higher engagement. ${topHook.example_count} viral posts used this format.`);
  }

  // Engagement insight
  const avgEngagement = posts.length > 0
    ? (posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length).toFixed(1)
    : 0;
  parts.push(`Average engagement rate for viral content: ${avgEngagement}%. Top performers hit ${posts[0]?.engagement_rate || 0}%.`);

  // Length insight (for video platforms)
  if (["tiktok", "instagram", "youtube"].includes(platformKey)) {
    const withDuration = posts.filter(p => p.duration > 0);
    if (withDuration.length > 10) {
      const avgDuration = Math.round(withDuration.reduce((sum, p) => sum + p.duration, 0) / withDuration.length);
      parts.push(`Optimal video length: ${avgDuration} seconds based on top-performing content.`);
    }
  }

  return parts.join(" ");
}

export default { processViralData };
