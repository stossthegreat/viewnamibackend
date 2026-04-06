// ============================================================
//   APIFY SYNC — THE AUTOMATED MACHINE
// ============================================================
//
// Calls Apify API → runs actors → downloads results →
// processes through processor.js → saves viral data files.
//
// Zero manual work. Just needs APIFY_API_TOKEN in env.
//
// Usage:
//   POST /api/viral/sync              — sync all platforms
//   POST /api/viral/sync/:platform    — sync one platform
//   GET  /api/viral/status            — check data freshness
//
// ============================================================

import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SCRAPER_CONFIGS } from "./scraperConfigs.js";
import { processViralData } from "./processor.js";
import { clearViralCache } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");

const APIFY_BASE = "https://api.apify.com/v2";

function getApifyToken() {
  return process.env.APIFY_API_TOKEN;
}

// ============================================================
// RUN ACTOR AND GET RESULTS
// ============================================================

/**
 * Run an Apify actor and wait for results
 * @param {string} actorId - e.g. "clockworks/tiktok-scraper"
 * @param {object} input - Actor input config
 * @param {number} timeoutSecs - Max wait time
 * @returns {Array} Dataset items
 */
async function runActorAndGetResults(actorId, input, timeoutSecs = 300) {
  const token = getApifyToken();
  if (!token) throw new Error("APIFY_API_TOKEN not set");

  console.log(`🚀 Starting actor: ${actorId}...`);

  // Start the actor run
  const runResponse = await axios.post(
    `${APIFY_BASE}/acts/${actorId}/runs`,
    input,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { timeout: timeoutSecs, waitForFinish: 120 },
      timeout: (timeoutSecs + 30) * 1000,
    }
  );

  const run = runResponse.data?.data;
  if (!run) throw new Error(`Failed to start actor ${actorId}`);

  console.log(`   ⏳ Run ID: ${run.id}, Status: ${run.status}`);

  // If not finished yet, poll
  let status = run.status;
  let datasetId = run.defaultDatasetId;
  const runId = run.id;

  if (status !== "SUCCEEDED") {
    // Poll until done
    const maxPolls = Math.ceil(timeoutSecs / 10);
    for (let i = 0; i < maxPolls; i++) {
      await sleep(10000); // Wait 10 seconds between polls

      const statusResponse = await axios.get(
        `${APIFY_BASE}/acts/${actorId}/runs/${runId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      status = statusResponse.data?.data?.status;
      datasetId = statusResponse.data?.data?.defaultDatasetId || datasetId;
      console.log(`   ⏳ Poll ${i + 1}: ${status}`);

      if (status === "SUCCEEDED") break;
      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        throw new Error(`Actor ${actorId} ${status}`);
      }
    }
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Actor ${actorId} did not complete in time`);
  }

  // Download dataset items
  console.log(`   📥 Downloading dataset: ${datasetId}...`);
  const dataResponse = await axios.get(
    `${APIFY_BASE}/datasets/${datasetId}/items`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { format: "json", limit: 5000 },
      timeout: 60000,
    }
  );

  const items = dataResponse.data;
  console.log(`   ✅ Got ${items.length} items from ${actorId}`);

  return items;
}

// ============================================================
// SYNC ONE PLATFORM
// ============================================================

/**
 * Sync viral data for one platform
 * @param {string} platformKey - e.g. "tiktok"
 * @param {string} niche - e.g. "fitness", "general"
 * @returns {object} { success, posts_scraped, viral_found, file_saved }
 */
export async function syncPlatform(platformKey, niche = "general") {
  const config = SCRAPER_CONFIGS[platformKey];
  if (!config) throw new Error(`Unknown platform: ${platformKey}`);

  const nicheHashtags = config.niches[niche] || config.niches.general;
  if (!nicheHashtags || nicheHashtags.length === 0) {
    throw new Error(`No hashtags configured for ${platformKey}/${niche}`);
  }

  console.log(`\n━━━ SYNCING: ${platformKey} (${niche}) ━━━`);
  console.log(`   Hashtags/queries: ${nicheHashtags.join(", ")}`);

  // Build actor input
  const input = config.buildInput(nicheHashtags, 200);

  // Run actor and get raw results
  const rawPosts = await runActorAndGetResults(config.actorId, input);

  if (rawPosts.length === 0) {
    console.log(`   ⚠️ No results from ${platformKey}`);
    return { success: false, posts_scraped: 0, viral_found: 0, error: "No results" };
  }

  // Process through our pipeline
  const processed = processViralData(platformKey, rawPosts, niche);

  // Save to data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const fileName = `${platformKey}_${now.getFullYear()}_${month}.json`;
  const filePath = path.join(DATA_DIR, fileName);

  fs.writeFileSync(filePath, JSON.stringify(processed, null, 2));
  console.log(`   💾 Saved: ${fileName}`);

  // Clear cache so new data is picked up
  clearViralCache();

  return {
    success: true,
    platform: platformKey,
    niche,
    posts_scraped: rawPosts.length,
    viral_found: processed.viral_posts_found,
    hooks_found: processed.hooks.length,
    file_saved: fileName,
  };
}

// ============================================================
// SYNC ALL PLATFORMS
// ============================================================

// Smart niche → platform mapping
// Only scrape where each niche actually lives = saves money
const NICHE_PLATFORMS = {
  general:   ["tiktok", "instagram", "x", "reddit", "linkedin", "youtube", "facebook"],
  fitness:   ["tiktok", "instagram", "youtube", "reddit"],
  food:      ["tiktok", "instagram", "youtube"],
  business:  ["linkedin", "x", "reddit"],
  beauty:    ["tiktok", "instagram"],
  tech:      ["x", "reddit", "youtube"],
  finance:   ["x", "reddit", "linkedin"],
  comedy:    ["tiktok", "instagram"],
  lifestyle: ["tiktok", "instagram"],
  marketing: ["linkedin", "x", "instagram"],
};

/**
 * Sync all RELEVANT platforms for a niche
 * Smart routing: only scrapes where the niche actually lives
 * @param {string} niche
 * @returns {object} Results per platform
 */
export async function syncAll(niche = "general") {
  const results = {};
  const platforms = NICHE_PLATFORMS[niche] || NICHE_PLATFORMS.general;

  console.log(`\n🔥 SMART SYNC — ${niche} niche → ${platforms.length} platforms\n`);
  console.log(`   Platforms: ${platforms.join(", ")}`);
  console.log(`   Skipping: ${Object.keys(SCRAPER_CONFIGS).filter(p => !platforms.includes(p)).join(", ") || "none"}\n`);

  for (const platform of platforms) {
    try {
      results[platform] = await syncPlatform(platform, niche);
    } catch (err) {
      console.error(`   ❌ ${platform} failed: ${err.message}`);
      results[platform] = { success: false, error: err.message };
    }
  }

  const succeeded = Object.values(results).filter(r => r.success).length;
  console.log(`\n✅ SYNC COMPLETE — ${succeeded}/${platforms.length} platforms succeeded\n`);
  return results;
}

/**
 * Sync ALL niches (full monthly refresh)
 * @returns {object} Results per niche per platform
 */
export async function syncAllNiches() {
  const allResults = {};
  const niches = Object.keys(NICHE_PLATFORMS).filter(n => n !== "general");

  console.log(`\n🔥🔥🔥 FULL MONTHLY SYNC — ${niches.length} niches\n`);

  for (const niche of niches) {
    console.log(`\n━━━ NICHE: ${niche.toUpperCase()} ━━━`);
    allResults[niche] = await syncAll(niche);
  }

  return allResults;
}

// ============================================================
// CHECK DATA FRESHNESS
// ============================================================

/**
 * Check how fresh the viral data is for each platform
 * @returns {object} { platform: { file, age_days, fresh } }
 */
export function checkDataStatus() {
  if (!fs.existsSync(DATA_DIR)) {
    return { status: "no_data", platforms: {} };
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const platforms = {};

  for (const file of files) {
    const match = file.match(/^(\w+)_(\d{4})_(\d{2})\.json$/);
    if (!match) continue;

    const [, platform, year, month] = match;
    const filePath = path.join(DATA_DIR, file);
    const stat = fs.statSync(filePath);
    const ageDays = Math.floor((Date.now() - stat.mtimeMs) / 86400000);

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      platforms[platform] = {
        file,
        year: parseInt(year),
        month: parseInt(month),
        age_days: ageDays,
        fresh: ageDays < 35, // Less than 35 days old = fresh
        posts_analyzed: data.data_points_analyzed || 0,
        viral_found: data.viral_posts_found || 0,
        hooks: data.hooks?.length || 0,
        generated_at: data.generated_at || null,
      };
    } catch (e) {
      platforms[platform] = { file, error: e.message };
    }
  }

  return {
    status: Object.values(platforms).some(p => p.fresh) ? "active" : "stale",
    platforms,
    total_files: files.length,
  };
}

// ============================================================
// HELPER
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { syncPlatform, syncAll, checkDataStatus };
