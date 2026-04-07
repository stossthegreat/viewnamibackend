// ============================================================
//   AUTO SCRAPE — ONE BUTTON, ALL DATA, FULLY AUTOMATED
// ============================================================
//
// Runs all niches across all relevant platforms.
// 100 posts per niche per platform.
// Processes everything. Saves everything. Zero manual work.
//
// Just needs APIFY_API_TOKEN in env.
//
// Call: POST /api/viral/auto
// Or schedule it monthly with cron.
//
// ============================================================

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { processViralData } from "./processor.js";
import { clearViralCache } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

const APIFY_BASE = "https://api.apify.com/v2";
const POSTS_PER_SCRAPE = 50;

// ============================================================
// THE MASTER PLAN — every niche, every platform, exact hashtags
// ============================================================

const SCRAPE_PLAN = [
  // FITNESS
  { niche: "fitness", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["gymtok", "fitness", "workout", "gym", "fitnesstiktok"] } },
  { niche: "fitness", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["fitness", "gym", "workout", "fitnessmotivation", "gymlife"] } },
  { niche: "fitness", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["fitness workout shorts"], type: "video" } },

  // BUSINESS
  { niche: "business", platform: "linkedin", actor: "curious_coder/linkedin-post-search-scraper", input: { searchTerms: ["startup", "entrepreneur", "leadership", "business lesson"] } },
  { niche: "business", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"startup" OR "entrepreneur" OR "business" min_faves:500'] } },
  { niche: "business", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["business", "entrepreneur", "startup", "sidehustle", "smallbusiness"] } },

  // FOOD
  { niche: "food", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["foodtok", "recipe", "cooking", "foodie", "cooktok"] } },
  { niche: "food", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["food", "recipe", "cooking", "foodporn", "homemade"] } },
  { niche: "food", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["cooking recipe easy shorts"], type: "video" } },

  // BEAUTY
  { niche: "beauty", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["beautytok", "skincare", "makeup", "grwm", "beauty"] } },
  { niche: "beauty", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["beauty", "skincare", "makeup", "beautytips", "selfcare"] } },
  { niche: "beauty", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["skincare makeup tutorial shorts"], type: "video" } },

  // TECH
  { niche: "tech", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"AI" OR "coding" OR "tech" OR "software" min_faves:500'] } },
  { niche: "tech", platform: "reddit", actor: "trudax/reddit-scraper", input: { startUrls: [{ url: "https://reddit.com/r/technology/top/?t=month" }, { url: "https://reddit.com/r/programming/top/?t=month" }] } },
  { niche: "tech", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["tech AI coding review shorts"], type: "video" } },

  // FINANCE
  { niche: "finance", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"investing" OR "money" OR "stocks" OR "financial" min_faves:500'] } },
  { niche: "finance", platform: "reddit", actor: "trudax/reddit-scraper", input: { startUrls: [{ url: "https://reddit.com/r/personalfinance/top/?t=month" }, { url: "https://reddit.com/r/investing/top/?t=month" }] } },
  { niche: "finance", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["moneytok", "investing", "personalfinance", "stocks", "crypto"] } },

  // COMEDY
  { niche: "comedy", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["comedy", "funny", "relatable", "storytime", "humor"] } },
  { niche: "comedy", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["funny", "comedy", "memes", "relatable", "humor"] } },
  { niche: "comedy", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["funny comedy viral shorts"], type: "video" } },

  // MOTIVATION
  { niche: "motivation", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["motivation", "selfimprovement", "mindset", "discipline", "success"] } },
  { niche: "motivation", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["motivation", "selfimprovement", "mindset", "success", "growth"] } },
  { niche: "motivation", platform: "linkedin", actor: "curious_coder/linkedin-post-search-scraper", input: { searchTerms: ["changed my life", "productivity", "mindset shift", "burnout"] } },

  // FASHION
  { niche: "fashion", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["fashion", "ootd", "style", "outfit", "fashiontiktok"] } },
  { niche: "fashion", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["fashion", "ootd", "style", "outfit", "streetstyle"] } },
  { niche: "fashion", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["fashion haul outfit style shorts"], type: "video" } },

  // TRAVEL
  { niche: "travel", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["travel", "traveltok", "vacation", "adventure", "wanderlust"] } },
  { niche: "travel", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["travel", "wanderlust", "travelgram", "vacation", "adventure"] } },
  { niche: "travel", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["travel vlog destination shorts"], type: "video" } },
];

// ============================================================
// PLATFORM-SPECIFIC INPUT BUILDERS
// ============================================================

function buildActorInput(job) {
  const base = { ...job.input };

  // Set limits per actor type
  if (job.actor.includes("tiktok-scraper")) {
    base.resultsPerPage = POSTS_PER_SCRAPE;
    base.shouldDownloadVideos = false;
    base.shouldDownloadCovers = false;
  } else if (job.actor.includes("instagram")) {
    base.resultsLimit = POSTS_PER_SCRAPE;
  } else if (job.actor.includes("tweet-scraper")) {
    base.maxTweets = POSTS_PER_SCRAPE;
    base.sort = "Top";
  } else if (job.actor.includes("reddit")) {
    base.maxItems = POSTS_PER_SCRAPE;
  } else if (job.actor.includes("linkedin")) {
    base.maxResults = POSTS_PER_SCRAPE;
  } else if (job.actor.includes("youtube")) {
    base.maxResults = POSTS_PER_SCRAPE;
    base.sortBy = "viewCount";
  }

  return base;
}

// ============================================================
// NORMALISE RESULTS (platform-agnostic)
// ============================================================

function normalizePost(item, platform) {
  try {
    if (platform === "tiktok") {
      return {
        author: item.authorMeta?.name ? `@${item.authorMeta.name}` : (item.author?.name || item.author || "unknown"),
        followers: item.authorMeta?.fans || item.authorStats?.followerCount || 0,
        caption: item.text || item.desc || "",
        views: item.playCount || item.stats?.playCount || item.plays || 0,
        likes: item.diggCount || item.stats?.diggCount || item.likes || 0,
        comments: item.commentCount || item.stats?.commentCount || 0,
        shares: item.shareCount || item.stats?.shareCount || 0,
        saves: item.collectCount || item.stats?.collectCount || 0,
        hashtags: (item.hashtags || []).map(h => typeof h === "string" ? `#${h}` : `#${h.name || h.title || ""}`),
        sound: item.musicMeta?.musicName || item.music?.title || null,
        duration: item.videoMeta?.duration || item.video?.duration || 0,
        posted_date: item.createTimeISO || (item.createTime ? new Date(item.createTime * 1000).toISOString().split("T")[0] : null),
        url: item.webVideoUrl || item.url || null,
      };
    }

    if (platform === "instagram") {
      return {
        author: item.ownerUsername ? `@${item.ownerUsername}` : "unknown",
        followers: item.ownerFollowerCount || 0,
        caption: item.caption || "",
        views: item.videoViewCount || item.videoPlayCount || item.likesCount || 0,
        likes: item.likesCount || 0,
        comments: item.commentsCount || 0,
        shares: 0,
        saves: 0,
        hashtags: (item.hashtags || []).map(h => `#${h}`),
        sound: item.musicInfo?.title || null,
        duration: item.videoDuration || 0,
        posted_date: item.timestamp ? new Date(item.timestamp * 1000).toISOString().split("T")[0] : null,
        url: item.url || (item.shortCode ? `https://instagram.com/p/${item.shortCode}` : null),
      };
    }

    if (platform === "x") {
      return {
        author: item.author?.userName ? `@${item.author.userName}` : (item.user?.screen_name ? `@${item.user.screen_name}` : "unknown"),
        followers: item.author?.followers || item.user?.followers_count || 0,
        caption: item.text || item.full_text || "",
        views: item.viewCount || 0,
        likes: item.likeCount || item.favorite_count || 0,
        comments: item.replyCount || 0,
        shares: item.retweetCount || item.retweet_count || 0,
        saves: item.bookmarkCount || 0,
        hashtags: (item.entities?.hashtags || []).map(h => `#${h.text || h}`),
        posted_date: item.createdAt ? new Date(item.createdAt).toISOString().split("T")[0] : null,
        url: item.url || null,
      };
    }

    if (platform === "reddit") {
      return {
        author: item.author ? `u/${item.author}` : "unknown",
        followers: 0,
        caption: item.title || "",
        body: item.body || item.selftext || "",
        views: 0,
        likes: item.score || item.ups || 0,
        comments: item.numberOfComments || item.num_comments || 0,
        shares: 0,
        saves: 0,
        hashtags: [],
        subreddit: item.subreddit || item.communityName || "",
        posted_date: item.createdAt ? new Date(item.createdAt).toISOString().split("T")[0] : null,
        url: item.url || null,
      };
    }

    if (platform === "linkedin") {
      return {
        author: item.authorName || item.author || "unknown",
        followers: item.authorFollowers || 0,
        caption: item.text || item.postText || item.content || "",
        views: 0,
        likes: item.reactions || item.likeCount || item.numLikes || 0,
        comments: item.comments || item.commentCount || 0,
        shares: item.reposts || 0,
        saves: 0,
        hashtags: [],
        posted_date: item.postedAt || item.date || null,
        url: item.postUrl || item.url || null,
        author_title: item.authorTitle || item.authorHeadline || "",
      };
    }

    if (platform === "youtube") {
      return {
        author: item.channelName || item.channel?.name || "unknown",
        followers: item.channelSubscribers || item.channel?.subscribers || 0,
        caption: item.title || "",
        description: item.description || "",
        views: item.viewCount || item.views || 0,
        likes: item.likeCount || item.likes || 0,
        comments: item.commentCount || 0,
        shares: 0,
        saves: 0,
        hashtags: (item.tags || []).map(t => `#${t}`),
        duration: item.duration || 0,
        posted_date: item.uploadDate || item.publishedAt || null,
        url: item.url || (item.id ? `https://youtube.com/watch?v=${item.id}` : null),
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// RUN ONE ACTOR
// ============================================================

async function runActor(actorId, input, token) {
  try {
    console.log(`   🚀 ${actorId}...`);

    const runResponse = await axios.post(
      `${APIFY_BASE}/acts/${actorId.replace('/', '~')}/runs`,
      input,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { timeout: 300, waitForFinish: 120 },
        timeout: 180000,
      }
    );

    const run = runResponse.data?.data;
    if (!run) return [];

    // Poll if not finished
    let status = run.status;
    let datasetId = run.defaultDatasetId;

    if (status !== "SUCCEEDED") {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const check = await axios.get(
          `${APIFY_BASE}/acts/${actorId.replace('/', '~')}/runs/${run.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        status = check.data?.data?.status;
        datasetId = check.data?.data?.defaultDatasetId || datasetId;
        if (status === "SUCCEEDED") break;
        if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return [];
      }
    }

    if (status !== "SUCCEEDED") return [];

    // Download results
    const data = await axios.get(
      `${APIFY_BASE}/datasets/${datasetId}/items`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { format: "json", limit: POSTS_PER_SCRAPE },
        timeout: 30000,
      }
    );

    console.log(`   ✅ Got ${data.data.length} results`);
    return data.data;
  } catch (e) {
    console.error(`   ❌ ${actorId} failed: ${e.message}`);
    return [];
  }
}

// ============================================================
// THE MAIN FUNCTION — RUN EVERYTHING
// ============================================================

export async function runFullScrape() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not set");

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  console.log(`\n🔥🔥🔥 FULL AUTO SCRAPE — ${SCRAPE_PLAN.length} jobs\n`);

  const results = {};

  for (const job of SCRAPE_PLAN) {
    const key = `${job.platform}_${job.niche}`;
    console.log(`\n━━━ ${job.niche.toUpperCase()} / ${job.platform.toUpperCase()} ━━━`);

    const input = buildActorInput(job);
    const rawPosts = await runActor(job.actor, input, token);

    if (rawPosts.length === 0) {
      results[key] = { success: false, error: "No results" };
      continue;
    }

    // Normalize
    const normalized = rawPosts
      .map(p => normalizePost(p, job.platform))
      .filter(p => p !== null);

    // Process
    const processed = processViralData(job.platform, normalized, job.niche);
    processed.platform_key = job.platform;
    processed.month = monthNames[now.getMonth()];
    processed.year = year;

    // Save
    const fileName = `${job.platform}_${job.niche}_${year}_${month}.json`;
    fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(processed, null, 2));

    results[key] = {
      success: true,
      posts_scraped: rawPosts.length,
      viral_found: processed.viral_posts_found,
      hooks: processed.hooks?.length || 0,
      file: fileName,
    };

    console.log(`   💾 Saved ${fileName} (${normalized.length} posts → ${processed.viral_posts_found} viral)`);
  }

  clearViralCache();
  console.log(`\n✅ FULL SCRAPE COMPLETE\n`);
  return results;
}

// ============================================================
// STATUS CHECK
// ============================================================

export function getScrapeStatus() {
  if (!fs.existsSync(DATA_DIR)) return { files: 0, niches: [] };

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const niches = [...new Set(files.map(f => {
    const parts = f.split("_");
    return parts.length >= 2 ? parts[1] : "unknown";
  }))];

  return {
    files: files.length,
    niches,
    fileList: files,
  };
}

export default { runFullScrape, getScrapeStatus, SCRAPE_PLAN };
