// ============================================================
//   RAG ENGINE — PURE JS, ZERO DEPENDENCIES
// ============================================================
//
// Embeds posts using OpenAI, stores in memory, searches
// with cosine similarity. No Python, no native modules.
//
// ============================================================

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const CACHE_FILE = path.join(__dirname, "embeddings_cache.json");

let allPosts = [];
let embeddings = []; // Parallel array — embeddings[i] matches allPosts[i]
let timingData = {};
let hashtagData = {};
let isReady = false;
let indexing = false;

// ============================================================
// COSINE SIMILARITY — pure JS
// ============================================================

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ============================================================
// OPENAI EMBEDDING
// ============================================================

async function embed(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: "text-embedding-3-small", input: text.substring(0, 500) },
      { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, timeout: 10000 }
    );
    return response.data.data[0].embedding;
  } catch (e) {
    return null;
  }
}

async function embedBatch(texts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return texts.map(() => null);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      { model: "text-embedding-3-small", input: texts.map(t => t.substring(0, 500)) },
      { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    return response.data.data.map(d => d.embedding);
  } catch (e) {
    return texts.map(() => null);
  }
}

// ============================================================
// NICHE DETECTOR
// ============================================================

const NICHE_KEYWORDS = {
  fitness: ["gym","fitness","workout","muscle","exercise","squat","protein","gains","abs","cardio","deadlift"],
  food: ["food","cook","recipe","meal","kitchen","chef","eat","dinner","baking","restaurant"],
  beauty: ["makeup","skincare","beauty","lip","foundation","grwm","glow","serum","moisturizer"],
  fashion: ["fashion","ootd","outfit","style","haul","dress","wear","clothing","streetwear"],
  business: ["business","entrepreneur","startup","marketing","sales","founder","revenue","ceo"],
  lifestyle: ["lifestyle","routine","aesthetic","dayinmylife","vlog","daily","morning"],
  relationships: ["couple","relationship","dating","love","toxic","breakup","partner","marriage"],
  motivation: ["motivation","discipline","mindset","grind","success","growth","goals","hustle"],
  tech: ["tech","coding","ai","software","developer","programming","saas","gadget"],
  education: ["learn","hack","didyouknow","facts","tutorial","tips","howto","school"],
  comedy: ["funny","comedy","meme","skit","humor","laugh","hilarious","joke"],
  gaming: ["gaming","gamer","game","esports","console","playstation","xbox"],
  travel: ["travel","vacation","adventure","destination","beach","hotel","flight","wanderlust"],
  health: ["mental","health","selfcare","wellness","anxiety","therapy","healing","meditation"],
  creators: ["content","creator","growth","social","audience","followers","viral"],
};

export function detectNiche(text) {
  const lower = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const [niche, kws] of Object.entries(NICHE_KEYWORDS)) {
    const score = kws.filter(k => lower.includes(k)).length;
    if (score > bestScore) { bestScore = score; best = niche; }
  }
  return best;
}

// ============================================================
// INITIALIZE
// ============================================================

export async function initRAG() {
  if (isReady || indexing) return;
  indexing = true;

  console.log("🧠 RAG: Loading viral data...");

  if (!fs.existsSync(DATA_DIR)) { console.log("⚠️ No data dir"); isReady = true; indexing = false; return; }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
      const platform = data.platform_key || file.split("_")[0];
      const niche = data.niche || file.split("_")[1] || "general";

      for (const post of (data.top_posts || [])) {
        allPosts.push({ ...post, platform, niche });
      }

      if (data.best_times?.length) timingData[`${platform}_${niche}`] = data.best_times;
      if (data.hashtags?.length) hashtagData[`${platform}_${niche}`] = data.hashtags;
    } catch (e) {}
  }

  console.log(`🧠 RAG: ${allPosts.length} posts loaded from ${files.length} files`);

  // Load cached embeddings or create new ones
  if (fs.existsSync(CACHE_FILE)) {
    try {
      embeddings = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      if (embeddings.length === allPosts.length) {
        console.log("🧠 RAG: Loaded cached embeddings");
        isReady = true; indexing = false;
        return;
      }
    } catch (e) {}
  }

  // Embed all posts in batches of 50
  console.log("🧠 RAG: Embedding posts (this takes ~30 seconds)...");
  embeddings = [];
  const batchSize = 50;

  for (let i = 0; i < allPosts.length; i += batchSize) {
    const batch = allPosts.slice(i, i + batchSize);
    const texts = batch.map(p => `${p.caption || ""} ${(p.hashtags || []).join(" ")}`.trim() || "post");
    const batchEmbeddings = await embedBatch(texts);
    embeddings.push(...batchEmbeddings);
    console.log(`🧠 RAG: Embedded ${Math.min(i + batchSize, allPosts.length)}/${allPosts.length}`);
  }

  // Cache to disk
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(embeddings));
    console.log("🧠 RAG: Embeddings cached to disk");
  } catch (e) {}

  isReady = true;
  indexing = false;
  console.log("🧠 RAG: Ready!");
}

// ============================================================
// SEARCH
// ============================================================

export async function searchRelevantPosts(userText, platform, niche, limit = 5) {
  // If no embeddings, fallback to keyword filtering
  if (!isReady || embeddings.length === 0 || embeddings.every(e => e === null)) {
    return allPosts
      .filter(p => (!platform || p.platform === platform) && (!niche || p.niche === niche))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  }

  const queryEmbedding = await embed(userText);
  if (!queryEmbedding) {
    return allPosts
      .filter(p => (!platform || p.platform === platform) && (!niche || p.niche === niche))
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, limit);
  }

  // Score all posts
  const scored = allPosts.map((post, i) => {
    if (!embeddings[i]) return { post, score: -1 };
    let score = cosineSimilarity(queryEmbedding, embeddings[i]);

    // Boost posts matching platform/niche
    if (platform && post.platform === platform) score += 0.1;
    if (niche && post.niche === niche) score += 0.15;

    return { post, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(s => s.score > 0)
    .slice(0, limit)
    .map(s => s.post);
}

// ============================================================
// GETTERS
// ============================================================

export function getBestTiming(platform, niche) {
  return timingData[`${platform}_${niche}`] || timingData[platform] || [];
}

export function getTopHashtags(platform, niche) {
  const data = hashtagData[`${platform}_${niche}`] || hashtagData[platform] || [];
  return data.slice(0, 10).map(h => h.tag || h);
}

export function getPostCount() { return allPosts.length; }
export function isRAGReady() { return isReady; }

export default { initRAG, searchRelevantPosts, detectNiche, getBestTiming, getTopHashtags, getPostCount, isRAGReady };
