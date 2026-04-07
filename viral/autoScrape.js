// ============================================================
//   AUTO SCRAPE — FIXED. 50 PER NICHE PER PLATFORM. THAT'S IT.
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
const MAX_POSTS = 50; // EXACTLY 50. NO MORE.

// SCRAPE PLAN — 1 hashtag/query per niche per platform
const SCRAPE_PLAN = [
  // FITNESS
  { niche: "fitness", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["gymtok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "fitness", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["fitness"], resultsLimit: MAX_POSTS } },
  { niche: "fitness", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["fitness shorts"], maxResults: MAX_POSTS } },

  // BUSINESS
  { niche: "business", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["entrepreneur"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "business", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"entrepreneur" min_faves:500'], maxTweets: MAX_POSTS, sort: "Top" } },
  { niche: "business", platform: "linkedin", actor: "harvestapi/linkedin-post-search", input: { searchTerms: ["startup lesson"], maxResults: MAX_POSTS } },

  // FOOD
  { niche: "food", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["foodtok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "food", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["recipe"], resultsLimit: MAX_POSTS } },
  { niche: "food", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["cooking recipe shorts"], maxResults: MAX_POSTS } },

  // BEAUTY
  { niche: "beauty", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["beautytok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "beauty", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["skincare"], resultsLimit: MAX_POSTS } },
  { niche: "beauty", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["skincare routine shorts"], maxResults: MAX_POSTS } },

  // TECH
  { niche: "tech", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["techtok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "tech", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"AI" OR "tech" min_faves:500'], maxTweets: MAX_POSTS, sort: "Top" } },
  { niche: "tech", platform: "reddit", actor: "trudax/reddit-scraper", input: { startUrls: [{ url: "https://reddit.com/r/technology/top/?t=month" }], maxItems: MAX_POSTS } },

  // FINANCE
  { niche: "finance", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["moneytok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "finance", platform: "x", actor: "apidojo/tweet-scraper", input: { searchTerms: ['"investing" OR "money" min_faves:500'], maxTweets: MAX_POSTS, sort: "Top" } },
  { niche: "finance", platform: "reddit", actor: "trudax/reddit-scraper", input: { startUrls: [{ url: "https://reddit.com/r/personalfinance/top/?t=month" }], maxItems: MAX_POSTS } },

  // COMEDY
  { niche: "comedy", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["comedy"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "comedy", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["funny"], resultsLimit: MAX_POSTS } },
  { niche: "comedy", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["funny viral shorts"], maxResults: MAX_POSTS } },

  // MOTIVATION
  { niche: "motivation", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["motivation"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "motivation", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["selfimprovement"], resultsLimit: MAX_POSTS } },
  { niche: "motivation", platform: "linkedin", actor: "harvestapi/linkedin-post-search", input: { searchTerms: ["mindset productivity"], maxResults: MAX_POSTS } },

  // FASHION
  { niche: "fashion", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["fashion"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "fashion", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["ootd"], resultsLimit: MAX_POSTS } },
  { niche: "fashion", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["fashion haul shorts"], maxResults: MAX_POSTS } },

  // TRAVEL
  { niche: "travel", platform: "tiktok", actor: "clockworks/tiktok-scraper", input: { hashtags: ["traveltok"], resultsPerPage: MAX_POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false } },
  { niche: "travel", platform: "instagram", actor: "apify/instagram-hashtag-scraper", input: { hashtags: ["travel"], resultsLimit: MAX_POSTS } },
  { niche: "travel", platform: "youtube", actor: "streamers/youtube-scraper", input: { searchKeywords: ["travel vlog shorts"], maxResults: MAX_POSTS } },
];

// Universal normalizer
function normalizePost(item, platform) {
  if (!item || typeof item !== "object") return null;
  try {
    const find = (obj, paths) => {
      for (const p of paths) {
        let v = obj;
        for (const k of p.split(".")) { if (v == null) break; v = v[k]; }
        if (v != null && v !== "" && v !== 0) return v;
      }
      return null;
    };
    const findNum = (obj, paths) => {
      const v = find(obj, paths);
      return typeof v === "number" ? v : (parseInt(v) || 0);
    };

    const caption = String(find(item, ["caption", "text", "desc", "title", "full_text", "postText", "content", "message", "body", "selftext"]) || "");
    if (!caption) return null;

    return {
      author: String(find(item, ["ownerUsername", "authorMeta.name", "author.userName", "author.name", "author", "user.screen_name", "channelName", "pageName"]) || "unknown"),
      followers: findNum(item, ["ownerFollowerCount", "authorMeta.fans", "authorStats.followerCount", "author.followers", "user.followers_count", "channelSubscribers", "authorFollowers"]),
      caption,
      views: findNum(item, ["playCount", "stats.playCount", "plays", "videoViewCount", "viewCount", "views"]),
      likes: findNum(item, ["diggCount", "stats.diggCount", "likes", "likesCount", "likeCount", "favorite_count", "reactions", "score", "ups"]),
      comments: findNum(item, ["commentCount", "stats.commentCount", "comments", "commentsCount", "replyCount", "num_comments", "numberOfComments"]),
      shares: findNum(item, ["shareCount", "stats.shareCount", "shares", "retweetCount", "reposts"]),
      saves: findNum(item, ["collectCount", "stats.collectCount", "bookmarkCount"]),
      hashtags: (() => {
        const raw = item.hashtags || item.entities?.hashtags || item.tags || [];
        if (!Array.isArray(raw)) return [];
        return raw.slice(0, 5).map(h => typeof h === "string" ? (h.startsWith("#") ? h : `#${h}`) : `#${h.name || h.title || h.text || ""}`).filter(h => h.length > 1);
      })(),
      sound: String(find(item, ["musicMeta.musicName", "music.title", "musicInfo.title"]) || ""),
      duration: findNum(item, ["videoMeta.duration", "video.duration", "videoDuration", "duration"]),
      posted_date: (() => {
        const raw = find(item, ["createTimeISO", "timestamp", "createdAt", "createTime", "postedAt", "date", "uploadDate", "publishedAt"]);
        if (!raw) return null;
        try {
          const d = typeof raw === "number" ? (raw > 1e12 ? new Date(raw) : new Date(raw * 1000)) : new Date(raw);
          return d.toISOString().split("T")[0];
        } catch { return null; }
      })(),
      url: String(find(item, ["webVideoUrl", "url", "postUrl"]) || ""),
    };
  } catch { return null; }
}

async function runActor(actorId, input, token) {
  try {
    const url = `${APIFY_BASE}/acts/${actorId.replace("/", "~")}/runs`;
    console.log(`   🚀 ${actorId}...`);

    const res = await axios.post(url, input, {
      headers: { Authorization: `Bearer ${token}` },
      params: { timeout: 300, waitForFinish: 120 },
      timeout: 180000,
    });

    const run = res.data?.data;
    if (!run) return [];

    let status = run.status;
    let datasetId = run.defaultDatasetId;

    if (status !== "SUCCEEDED") {
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const check = await axios.get(`${APIFY_BASE}/acts/${actorId.replace("/", "~")}/runs/${run.id}`, { headers: { Authorization: `Bearer ${token}` } });
        status = check.data?.data?.status;
        datasetId = check.data?.data?.defaultDatasetId || datasetId;
        if (status === "SUCCEEDED") break;
        if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) return [];
      }
    }

    if (status !== "SUCCEEDED") return [];

    // DOWNLOAD EXACTLY 50. NO MORE.
    const data = await axios.get(`${APIFY_BASE}/datasets/${datasetId}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { format: "json", limit: MAX_POSTS },
      timeout: 30000,
    });

    const items = data.data.slice(0, MAX_POSTS); // HARD CAP
    console.log(`   ✅ Got ${items.length} results`);
    return items;
  } catch (e) {
    console.error(`   ❌ ${actorId} failed: ${e.message}`);
    return [];
  }
}

export async function runFullScrape() {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not set");
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  console.log(`\n🔥 SCRAPE — ${SCRAPE_PLAN.length} jobs, ${MAX_POSTS} per job\n`);

  const results = {};

  for (const job of SCRAPE_PLAN) {
    const key = `${job.platform}_${job.niche}`;
    console.log(`\n━━━ ${job.niche.toUpperCase()} / ${job.platform.toUpperCase()} ━━━`);

    const rawPosts = await runActor(job.actor, job.input, token);
    if (rawPosts.length === 0) {
      results[key] = { success: false, error: "No results" };
      continue;
    }

    // Normalize — keep ALL posts
    const normalized = rawPosts.map(p => normalizePost(p, job.platform)).filter(Boolean).slice(0, MAX_POSTS);

    console.log(`   📊 ${normalized.length} posts normalized`);

    const processed = processViralData(job.platform, normalized, job.niche);
    processed.platform_key = job.platform;
    processed.month = monthNames[now.getMonth()];
    processed.year = now.getFullYear();

    const fileName = `${job.platform}_${job.niche}_${now.getFullYear()}_${month}.json`;
    fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(processed, null, 2));

    results[key] = { success: true, posts: normalized.length, file: fileName };
    console.log(`   💾 ${fileName} (${normalized.length} posts)`);
  }

  clearViralCache();
  console.log(`\n✅ DONE\n`);
  return results;
}

export function getScrapeStatus() {
  if (!fs.existsSync(DATA_DIR)) return { files: 0, niches: [] };
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const niches = [...new Set(files.map(f => f.split("_")[1]).filter(Boolean))];
  return { files: files.length, niches, fileList: files };
}

export default { runFullScrape, getScrapeStatus, SCRAPE_PLAN };
