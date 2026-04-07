import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";

let getViralData = () => null;
let buildViralContext = () => "";
let PLATFORMS = {};
let buildChatEvidence = () => ({ sources: [] });
try {
  const store = await import("../viral/store.js");
  const matcher = await import("../viral/evidenceMatcher.js");
  getViralData = store.getViralData;
  buildViralContext = store.buildViralContext;
  PLATFORMS = store.PLATFORMS;
  buildChatEvidence = matcher.buildChatEvidence;
} catch (e) {
  console.warn("Viral imports not available:", e.message);
}

function detectFromText(text) {
  const lower = text.toLowerCase();
  
  // Detect platform
  let platform = null;
  const platMap = {
    tiktok: ["tiktok","tik tok","tt ","fyp"],
    instagram: ["instagram","insta","ig ","reels","carousel"],
    x: ["twitter","x.com","tweet","thread"],
    reddit: ["reddit","subreddit"],
    linkedin: ["linkedin"],
    youtube: ["youtube","yt ","shorts","thumbnail"],
    facebook: ["facebook","fb "],
  };
  for (const [p, kws] of Object.entries(platMap)) {
    if (kws.some(k => lower.includes(k))) { platform = p; break; }
  }
  
  // Detect niche
  let niche = null;
  const nicheMap = {
    fitness: ["fitness","gym","workout","muscle","exercise","squat","protein","bodybuilding"],
    food: ["food","cook","recipe","baking","meal","kitchen","chef","restaurant"],
    beauty: ["beauty","skincare","makeup","skin","grwm","cosmetic","glow"],
    business: ["business","entrepreneur","startup","marketing","sales","founder"],
    tech: ["tech","coding","ai","software","developer","programming","saas"],
    finance: ["money","invest","finance","stock","crypto","wealth","budget"],
    comedy: ["funny","comedy","humor","joke","meme"],
    motivation: ["motivation","mindset","success","discipline","productivity"],
    fashion: ["fashion","outfit","style","ootd","clothing"],
    travel: ["travel","vacation","adventure","destination"],
  };
  for (const [n, kws] of Object.entries(nicheMap)) {
    if (kws.some(k => lower.includes(k))) { niche = n; break; }
  }
  
  return { platform, niche };
}

function buildChatSystemPrompt(platform, niche, language) {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  
  const parts = [];
  
  parts.push(`You are ViewNami, a social media viral intelligence engine. Today is ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}.

You have access to REAL scraped viral data from social platforms. This data is current — scraped this month.

RESPONSE STYLE — Match Perplexity AI quality:

Write in clean flowing prose. Use inline citations naturally:
"Story-based content is outperforming tutorials by 3:1 [TikTok fitness data, 1,045 posts analyzed]"

When referencing creators, weave it into text:
"This was recently demonstrated by @creator (X followers), who hit Y views with a similar approach."

Structure with clean headers — no emoji spam:

**What's working**
Flowing paragraph with inline citations...

**Why it works**  
Psychology explanation...

**What to do**
Specific actionable advice...

**Sources**
[1] Platform data — month year, X posts analyzed
[2] @creator — Y views, Z% engagement

Be authoritative. Say "The data shows" not "I think". Be specific with numbers. No generic advice. No emoji headers. No hype language. Clean, intelligent, data-backed.`);

  // Load SPECIFIC data for the detected platform + niche
  let dataLoaded = false;
  
  if (platform && niche) {
    // Try platform_niche specific file first
    const specificData = getViralData(`${platform}_${niche}`);
    if (specificData) {
      parts.push(buildViralContext(`${platform}_${niche}`));
      dataLoaded = true;
    }
  }
  
  if (!dataLoaded && platform) {
    // Try any file for this platform
    const platformData = getViralData(platform);
    if (platformData) {
      parts.push(buildViralContext(platform));
      dataLoaded = true;
    }
  }
  
  if (!dataLoaded && niche) {
    // Try any platform with this niche — check tiktok first, then instagram, then x
    for (const p of ['tiktok','instagram','x','youtube','facebook']) {
      const nicheData = getViralData(`${p}_${niche}`);
      if (nicheData) {
        parts.push(buildViralContext(`${p}_${niche}`));
        dataLoaded = true;
        break;
      }
    }
  }
  
  if (!dataLoaded) {
    // Load tiktok fitness as default — biggest dataset
    const fallback = getViralData('tiktok_fitness');
    if (fallback) {
      parts.push(buildViralContext('tiktok_fitness'));
    } else {
      parts.push("No viral data loaded yet. Use your training knowledge but be transparent about it.");
    }
  }

  if (language && language !== "auto" && language !== "en") {
    parts.push(`Respond in ${language}. Citations stay in English.`);
  }

  return parts.join("\n\n");
}

export async function chat(req, res, next) {
  const start = Date.now();
  try {
    const { messages, model, language = "auto" } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError("Messages array is required.", 400);
    }

    // Detect platform + niche from the conversation
    const allUserText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
    const { platform, niche } = detectFromText(allUserText);
    
    const systemPrompt = buildChatSystemPrompt(platform, niche, language);
    const openaiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of messages.slice(-20)) {
      if (msg.role && msg.content) {
        openaiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    const reply = await createChatCompletion({
      messages: openaiMessages,
      temperature: 0.7,
      maxTokens: 1500,
      model: model || "gpt4mini",
    });

    // Get evidence sources
    let sources = [];
    if (platform) {
      const key = niche ? `${platform}_${niche}` : platform;
      const result = buildChatEvidence(key, allUserText);
      sources = result.sources || [];
    }

    return res.json({
      reply,
      sources,
      model: model || "gpt4mini",
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    return next(err);
  }
}

export default { chat };
