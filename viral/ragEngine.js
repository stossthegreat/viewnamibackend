// ============================================================
//   RAG ENGINE — EMBEDDED VECTOR SEARCH
// ============================================================
//
// Uses Vectra (local vector DB) + OpenAI embeddings
// to find the most relevant viral posts for any user query.
//
// Flow:
// 1. On startup: load all viral data, embed captions, index them
// 2. On query: embed user text, search for top 5 matches
//    filtered by platform + detected niche
// 3. Return matched posts with full metadata
//
// ============================================================

import { LocalIndex } from "vectra";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const INDEX_DIR = path.join(__dirname, "vector_index");

let index = null;
let allPosts = [];
let timingData = {};
let hashtagData = {};
let isReady = false;

// ============================================================
// OPENAI EMBEDDING
// ============================================================

async function embed(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY needed for embeddings");

  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { model: "text-embedding-3-small", input: text.substring(0, 500) },
    { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, timeout: 15000 }
  );

  return response.data.data[0].embedding;
}

// ============================================================
// NICHE DETECTOR
// ============================================================

const NICHE_KEYWORDS = {
  fitness: ["gym", "fitness", "workout", "muscle", "exercise", "squat", "protein", "gains", "abs", "cardio", "deadlift", "bench"],
  food: ["food", "cook", "recipe", "meal", "kitchen", "chef", "eat", "dinner", "baking", "restaurant", "lunch"],
  beauty: ["makeup", "skincare", "beauty", "lip", "foundation", "grwm", "glow", "serum", "moisturizer", "concealer"],
  fashion: ["fashion", "ootd", "outfit", "style", "haul", "dress", "wear", "clothing", "streetwear"],
  business: ["business", "entrepreneur", "startup", "marketing", "sales", "founder", "revenue", "ceo"],
  lifestyle: ["lifestyle", "routine", "aesthetic", "dayinmylife", "vlog", "daily", "morning"],
  relationships: ["couple", "relationship", "dating", "love", "toxic", "breakup", "partner", "marriage"],
  motivation: ["motivation", "discipline", "mindset", "grind", "success", "growth", "goals", "hustle"],
  tech: ["tech", "coding", "ai", "software", "developer", "programming", "saas", "gadget"],
  education: ["learn", "hack", "didyouknow", "facts", "tutorial", "tips", "howto", "school"],
  comedy: ["funny", "comedy", "meme", "skit", "humor", "laugh", "hilarious", "joke"],
  gaming: ["gaming", "gamer", "game", "esports", "console", "playstation", "xbox"],
  travel: ["travel", "vacation", "adventure", "destination", "beach", "hotel", "flight", "wanderlust"],
  health: ["mental", "health", "selfcare", "wellness", "anxiety", "therapy", "healing", "meditation"],
  creators: ["content", "creator", "growth", "social", "audience", "followers", "viral"],
};

export function detectNiche(text) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const score = keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = niche;
    }
  }

  return best;
}

// ============================================================
// INITIALIZE — Load all data, embed, index
// ============================================================

export async function initRAG() {
  if (isReady) return;

  console.log("🧠 Initializing RAG engine...");

  // Load all viral data files
  if (!fs.existsSync(DATA_DIR)) {
    console.log("⚠️ No viral data directory");
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  console.log(`   📂 Found ${files.length} data files`);

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      const platform = data.platform_key || file.split("_")[0];
      const niche = data.niche || file.split("_")[1]?.replace("_2026_04.json", "") || "general";

      // Collect posts
      for (const post of (data.top_posts || [])) {
        allPosts.push({
          ...post,
          platform,
          niche,
          _id: `${platform}_${niche}_${allPosts.length}`,
        });
      }

      // Collect timing data
      if (data.best_times?.length > 0) {
        const key = `${platform}_${niche}`;
        timingData[key] = data.best_times;
      }

      // Collect hashtag data
      if (data.hashtags?.length > 0) {
        const key = `${platform}_${niche}`;
        hashtagData[key] = data.hashtags;
      }
    } catch (e) {
      console.warn(`   ⚠️ Failed to load ${file}: ${e.message}`);
    }
  }

  console.log(`   📊 Loaded ${allPosts.length} posts across ${files.length} files`);
  console.log(`   ⏰ Timing data for ${Object.keys(timingData).length} platform-niche combos`);
  console.log(`   #️⃣ Hashtag data for ${Object.keys(hashtagData).length} platform-niche combos`);

  // Create vector index
  try {
    if (!fs.existsSync(INDEX_DIR)) {
      fs.mkdirSync(INDEX_DIR, { recursive: true });
    }

    index = new LocalIndex(INDEX_DIR);

    if (!await index.isIndexCreated()) {
      console.log("   🔧 Creating vector index...");
      await index.createIndex();

      // Embed and index all posts in batches
      const batchSize = 20;
      for (let i = 0; i < allPosts.length; i += batchSize) {
        const batch = allPosts.slice(i, i + batchSize);
        for (const post of batch) {
          try {
            const text = `${post.caption || ""} ${(post.hashtags || []).join(" ")}`;
            if (text.trim().length < 5) continue;

            const vector = await embed(text);
            await index.insertItem({
              vector,
              metadata: {
                platform: post.platform,
                niche: post.niche,
                author: post.author,
                caption: (post.caption || "").substring(0, 200),
                views: post.views || 0,
                likes: post.likes || 0,
                comments: post.comments || 0,
                engagement_rate: post.engagement_rate || 0,
                url: post.url || "",
                hashtags: (post.hashtags || []).join(", "),
                followers: post.followers || 0,
              },
            });
          } catch (e) {
            // Skip failed embeddings
          }
        }
        console.log(`   📦 Indexed ${Math.min(i + batchSize, allPosts.length)}/${allPosts.length} posts`);
      }

      console.log("   ✅ Vector index created");
    } else {
      console.log("   ✅ Vector index loaded from disk");
    }

    isReady = true;
    console.log("🧠 RAG engine ready!");
  } catch (e) {
    console.error("❌ RAG init failed:", e.message);
    // Still mark as ready — we can fall back to non-RAG
    isReady = true;
  }
}

// ============================================================
// SEARCH — Find most relevant viral posts
// ============================================================

export async function searchRelevantPosts(userText, platform, niche, limit = 5) {
  if (!index || !isReady) {
    // Fallback: return top posts from allPosts filtered by platform/niche
    return allPosts
      .filter(p => (!platform || p.platform === platform) && (!niche || p.niche === niche))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  }

  try {
    const queryVector = await embed(userText);
    const results = await index.queryItems(queryVector, limit * 3); // Get more, then filter

    // Filter by platform + niche if specified
    let filtered = results;
    if (platform || niche) {
      filtered = results.filter(r => {
        const meta = r.item.metadata;
        if (platform && meta.platform !== platform) return false;
        if (niche && meta.niche !== niche) return false;
        return true;
      });
    }

    // If not enough results after filtering, include any platform/niche
    if (filtered.length < limit) {
      filtered = results.slice(0, limit);
    }

    return filtered.slice(0, limit).map(r => ({
      author: r.item.metadata.author,
      caption: r.item.metadata.caption,
      views: r.item.metadata.views,
      likes: r.item.metadata.likes,
      comments: r.item.metadata.comments,
      engagement_rate: r.item.metadata.engagement_rate,
      url: r.item.metadata.url,
      hashtags: r.item.metadata.hashtags ? r.item.metadata.hashtags.split(", ") : [],
      followers: r.item.metadata.followers,
      platform: r.item.metadata.platform,
      niche: r.item.metadata.niche,
      _score: r.score,
    }));
  } catch (e) {
    console.error("RAG search error:", e.message);
    // Fallback
    return allPosts
      .filter(p => (!platform || p.platform === platform) && (!niche || p.niche === niche))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  }
}

// ============================================================
// GET TIMING + HASHTAGS
// ============================================================

export function getBestTiming(platform, niche) {
  const key = `${platform}_${niche}`;
  return timingData[key] || timingData[platform] || [];
}

export function getTopHashtags(platform, niche) {
  const key = `${platform}_${niche}`;
  const data = hashtagData[key] || hashtagData[platform] || [];
  return data.slice(0, 10).map(h => h.tag || h);
}

export function getPostCount() {
  return allPosts.length;
}

export function isRAGReady() {
  return isReady;
}

export default {
  initRAG, searchRelevantPosts, detectNiche,
  getBestTiming, getTopHashtags, getPostCount, isRAGReady,
};
