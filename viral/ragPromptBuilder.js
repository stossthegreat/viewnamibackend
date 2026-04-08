// ============================================================
//   RAG PROMPT BUILDER — Assembles the killer prompt
// ============================================================
//
// Takes RAG results + timing + hashtags and builds
// the system prompt that makes the AI lethal.
//
// ============================================================

import { searchRelevantPosts, detectNiche, getBestTiming, getTopHashtags, getPostCount } from "./ragEngine.js";

/**
 * Build a RAG-powered context for any user query
 * @param {string} userText - What the user said
 * @param {string} platform - From preset (tiktok, instagram, etc)
 * @returns {string} Context to inject into the AI prompt
 */
export async function buildRAGContext(userText, platform) {
  const niche = detectNiche(userText);
  const posts = await searchRelevantPosts(userText, platform, niche, 5);
  const timing = getBestTiming(platform, niche);
  const hashtags = getTopHashtags(platform, niche);
  const totalPosts = getPostCount();

  if (posts.length === 0 && timing.length === 0) return "";

  const parts = [];

  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 REAL VIRAL DATA — Retrieved specifically for this query
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Intelligence from ${totalPosts.toLocaleString()} scraped posts. ${niche ? `Filtered to: ${niche}` : ""} ${platform ? `Platform: ${platform}` : ""}`);

  // The 5 most relevant posts
  if (posts.length > 0) {
    parts.push(`\nTHE ${posts.length} MOST RELEVANT VIRAL POSTS TO WHAT THIS USER WANTS:\n`);
    posts.forEach((p, i) => {
      parts.push(`${i + 1}. ${p.author || "unknown"} (${(p.followers || 0).toLocaleString()} followers)`);
      parts.push(`   "${(p.caption || "").substring(0, 150)}"`);
      parts.push(`   ${(p.views || 0).toLocaleString()} views | ${(p.likes || 0).toLocaleString()} likes | ${p.engagement_rate || 0}% engagement`);
      parts.push(`   URL: ${p.url || "N/A"}`);
      parts.push("");
    });

    parts.push(`CRITICAL INSTRUCTIONS:
- Your output MUST use patterns from the posts above
- You MUST reference at least 2 of these creators by name with their EXACT URLs as markdown links: [Watch @name's post](url)
- Explain WHY your output works based on what these posts did
- Do NOT write generic content — everything must be inspired by the retrieved data`);
  }

  // Timing
  if (timing.length > 0) {
    parts.push(`\nBEST POSTING TIMES (from real engagement data):`);
    timing.slice(0, 3).forEach(t => {
      parts.push(`• ${t.day} ${t.time || ""} — ${t.engagement_avg || "?"}% avg engagement (${t.sample_size || "?"} posts analyzed)`);
    });
    parts.push(`INCLUDE the best posting time in your response.`);
  }

  // Hashtags
  if (hashtags.length > 0) {
    parts.push(`\nTOP HASHTAGS (from viral ${niche || ""} content):`);
    parts.push(hashtags.join("  "));
    parts.push(`INCLUDE relevant hashtags from above in your response.`);
  }

  return parts.join("\n");
}

/**
 * Build full RAG context for the Strategy chat
 */
export async function buildChatRAGContext(userText) {
  // Detect platform from user's words
  const lower = userText.toLowerCase();
  let platform = null;
  if (lower.includes("tiktok") || lower.includes("tt ")) platform = "tiktok";
  else if (lower.includes("instagram") || lower.includes("ig ") || lower.includes("reel")) platform = "instagram";
  else if (lower.includes("youtube") || lower.includes("yt ") || lower.includes("short")) platform = "youtube";
  else if (lower.includes("twitter") || lower.includes("x ") || lower.includes("tweet")) platform = "x";
  else if (lower.includes("linkedin")) platform = "linkedin";
  else if (lower.includes("reddit")) platform = "reddit";

  return buildRAGContext(userText, platform);
}

export default { buildRAGContext, buildChatRAGContext };
