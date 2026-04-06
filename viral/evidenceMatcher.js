// ============================================================
//   EVIDENCE MATCHER — THE SOURCE ENGINE
// ============================================================
//
// Matches AI-generated output against scraped viral posts
// to find relevant source references. This is what gives
// the Perplexity-style "here's the proof" evidence cards.
//
// Matching strategy:
// 1. Hook format matching (pattern similarity)
// 2. Topic/keyword overlap
// 3. Hashtag intersection
// 4. Engagement ranking (show the most viral examples)
//
// ============================================================

import { getViralData, getEvidencePosts } from "./store.js";

// ============================================================
// MATCH EVIDENCE FOR OUTPUT
// ============================================================

/**
 * Find relevant viral posts that support the AI's output
 * @param {string} platformKey - e.g. "tiktok"
 * @param {string} aiOutput - The generated content
 * @param {string} userInput - Original user input (for topic matching)
 * @param {number} limit - Max evidence items to return
 * @returns {object} { evidence: [...], trend_summary: "..." }
 */
export function matchEvidence(platformKey, aiOutput, userInput, limit = 3) {
  const data = getViralData(platformKey);
  if (!data?.top_posts || data.top_posts.length === 0) {
    return { evidence: [], trend_summary: null };
  }

  const outputLower = aiOutput.toLowerCase();
  const inputLower = userInput.toLowerCase();
  const combinedText = `${outputLower} ${inputLower}`;

  // Extract keywords from user input + AI output
  const keywords = extractKeywords(combinedText);

  // Score each top post for relevance
  const scored = data.top_posts.map(post => {
    let score = 0;

    // 1. Hook format matching
    if (post.hook_format) {
      const hookWords = post.hook_format.replace(/_/g, " ").toLowerCase();
      if (outputLower.includes(hookWords) || hookWords.split(" ").some(w => outputLower.includes(w))) {
        score += 40;
      }
    }

    // 2. Caption/content keyword overlap
    const postCaption = (post.caption || "").toLowerCase();
    const postKeywords = extractKeywords(postCaption);
    const overlap = keywords.filter(k => postKeywords.includes(k));
    score += overlap.length * 10;

    // 3. Hashtag intersection
    if (post.hashtags?.length > 0) {
      const postTags = post.hashtags.map(t => t.toLowerCase().replace("#", ""));
      const matchedTags = postTags.filter(t => combinedText.includes(t));
      score += matchedTags.length * 8;
    }

    // 4. Engagement bonus (higher engagement = more credible source)
    if (post.views) {
      if (post.views > 5000000) score += 15;
      else if (post.views > 1000000) score += 10;
      else if (post.views > 500000) score += 5;
    }

    // 5. Recency bonus
    if (post.posted_date) {
      const daysSince = Math.floor((Date.now() - new Date(post.posted_date).getTime()) / 86400000);
      if (daysSince < 7) score += 12;
      else if (daysSince < 14) score += 8;
      else if (daysSince < 30) score += 4;
    }

    return { ...post, _relevanceScore: score };
  });

  // Sort by relevance and take top N
  scored.sort((a, b) => b._relevanceScore - a._relevanceScore);
  const topEvidence = scored.slice(0, limit).filter(p => p._relevanceScore > 5);

  // Build trend summary
  let trendSummary = null;
  if (data.hooks?.length > 0) {
    // Find which hook pattern the AI used
    const usedHook = data.hooks.find(h => {
      const pattern = h.pattern.toLowerCase().replace("...", "");
      return outputLower.includes(pattern);
    });

    if (usedHook) {
      trendSummary = `This hook format "${usedHook.pattern}" is up ↑${usedHook.trend_pct}% this month on ${data.platform || platformKey}`;
    } else if (data.formats?.[0]) {
      trendSummary = `${data.formats[0].name} content is trending ↑${data.formats[0].trend_pct}% on ${data.platform || platformKey} this month`;
    }
  }

  // Clean evidence (remove internal scoring)
  const evidence = topEvidence.map(({ _relevanceScore, _loadedAt, _fileName, ...post }) => ({
    author: post.author || "Unknown",
    followers: post.followers || 0,
    caption: truncate(post.caption, 80),
    views: post.views || 0,
    likes: post.likes || 0,
    engagement_rate: post.engagement_rate || 0,
    posted_date: post.posted_date || null,
    url: post.url || null,
    hashtags: post.hashtags?.slice(0, 5) || [],
  }));

  return { evidence, trend_summary: trendSummary };
}

// ============================================================
// BUILD CHAT EVIDENCE CONTEXT
// ============================================================

/**
 * Build evidence context specifically for the chat/strategy endpoint
 * More detailed, includes explanations
 * @param {string} platformKey
 * @param {string} topic - User's query topic
 * @returns {object} { context: "...", sources: [...] }
 */
export function buildChatEvidence(platformKey, topic) {
  const data = getViralData(platformKey);
  if (!data) return { context: "", sources: [] };

  const topicLower = topic.toLowerCase();
  const keywords = extractKeywords(topicLower);

  // Find relevant posts by topic
  const relevant = (data.top_posts || [])
    .map(post => {
      const postText = `${post.caption || ""} ${(post.hashtags || []).join(" ")}`.toLowerCase();
      const overlap = keywords.filter(k => postText.includes(k));
      return { ...post, _score: overlap.length };
    })
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score || (b.views || 0) - (a.views || 0))
    .slice(0, 5);

  // If no topic match, just return top viral posts
  const sources = relevant.length > 0
    ? relevant
    : (data.top_posts || []).slice(0, 3);

  const cleanSources = sources.map(({ _score, _loadedAt, _fileName, ...post }) => ({
    author: post.author || "Unknown",
    followers: post.followers || 0,
    caption: truncate(post.caption, 100),
    views: post.views || 0,
    engagement_rate: post.engagement_rate || 0,
    posted_date: post.posted_date || null,
    url: post.url || null,
  }));

  return { sources: cleanSources };
}

// ============================================================
// HELPERS
// ============================================================

function extractKeywords(text) {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "and", "but", "or", "not", "no", "nor",
    "so", "yet", "both", "either", "neither", "each", "every",
    "all", "any", "few", "more", "most", "other", "some", "such",
    "only", "own", "same", "than", "too", "very", "just", "about",
    "i", "me", "my", "we", "our", "you", "your", "he", "she",
    "it", "they", "them", "their", "this", "that", "these", "those",
    "what", "which", "who", "whom", "how", "when", "where", "why",
  ]);

  return text
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function truncate(str, maxLen) {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "...";
}

export default { matchEvidence, buildChatEvidence };
