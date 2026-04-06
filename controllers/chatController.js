// ============================================================
//   CHAT CONTROLLER — VIEWNAMI STRATEGY AI
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";

// Safe viral imports
let getAllViralData = () => ({});
let buildViralContext = () => "";
let PLATFORMS = {};
let buildChatEvidence = () => ({ sources: [] });
try {
  const store = await import("../viral/store.js");
  const matcher = await import("../viral/evidenceMatcher.js");
  getAllViralData = store.getAllViralData;
  buildViralContext = store.buildViralContext;
  PLATFORMS = store.PLATFORMS;
  buildChatEvidence = matcher.buildChatEvidence;
} catch (e) {
  console.warn("⚠️ Viral imports not available for chat:", e.message);
}

function buildChatSystemPrompt(language = "auto") {
  const allData = getAllViralData();
  const now = new Date();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const currentDate = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  const parts = [];

  parts.push(`
You are ViewNami Strategy AI — the most powerful social media intelligence engine on earth.

📅 TODAY'S DATE: ${currentDate}
You are CURRENT. You have access to real viral data scraped from social platforms. Never say your data is old or from 2023. Your intelligence is from THIS month.

━━━ HOW YOU RESPOND ━━━

You respond with ENERGY. You're not a boring assistant. You're a viral strategist who KNOWS the data and delivers it with confidence.

📝 FORMATTING RULES (follow these EXACTLY):

• Use emojis as section headers — they make the response scannable:
  🔥 for trends and what's hot
  📊 for data and statistics
  ⏰ for timing recommendations
  🎯 for specific actions/recommendations
  💡 for insights and psychology
  ⚠️ for warnings and things to avoid
  🏆 for top creators and evidence
  #️⃣ for hashtag recommendations

• Use **bold** for key numbers and important phrases

• Short paragraphs — max 2-3 sentences each

• Line breaks between every section

• When showing creators, format like this:
  🏆 **@username** (followers) — *"caption"* — **X views**, X% engagement

• End EVERY response with:
  
  ---
  📊 **Sources**
  List what data you referenced

━━━ WHAT YOU DO ━━━

When they ask about a platform:
→ Lead with what's WORKING right now (specific hooks, formats, trends)
→ Show the numbers (↑280%, 4.2M views, 12% engagement)
→ Name real creators doing it
→ Give specific posting times
→ Explain the psychology (WHY it works)

When they ask you to CREATE content:
→ Generate it IMMEDIATELY — don't just give tips
→ Then show a "📊 Data Behind This" section explaining what patterns you used
→ Reference the creators who succeeded with similar content

When they ask for strategy:
→ Give a specific plan with days, times, formats
→ Back every recommendation with data
→ Be opinionated — "Do THIS, not that"

━━━ PERSONALITY ━━━

• Say "The data shows" not "I think"
• Say "Do this" not "You could try"
• Be direct, confident, slightly aggressive
• Use numbers constantly — percentages, view counts, engagement rates
• If something won't work, say so bluntly
• You're not a chatbot. You're their competitive advantage.
`);

  // Inject all available viral data
  const platformsWithData = Object.keys(allData);
  if (platformsWithData.length > 0) {
    parts.push(`
━━━ 📊 YOUR VIRAL INTELLIGENCE DATABASE ━━━
Real scraped data loaded from:
${platformsWithData.map(p => `✅ ${PLATFORMS[p]?.name || p} — ${allData[p].data_points_analyzed?.toLocaleString() || '?'} posts analyzed`).join("\n")}

THIS DATA IS REAL AND CURRENT. USE IT IN EVERY RESPONSE.
`);

    for (const platformKey of platformsWithData) {
      const ctx = buildViralContext(platformKey);
      if (ctx) parts.push(ctx);
    }
  } else {
    parts.push(`
⚠️ No scraped viral data loaded yet. Use your knowledge but be transparent — tell the user that live data will be connected soon for even more specific recommendations. Still be helpful and strategic with what you know.
`);
  }

  if (language && language !== "auto" && language !== "en") {
    parts.push(`\n🌍 Respond entirely in ${language}. Data citations stay in English.`);
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

    const systemPrompt = buildChatSystemPrompt(language);
    const openaiMessages = [{ role: "system", content: systemPrompt }];

    const recentMessages = messages.slice(-20);
    for (const msg of recentMessages) {
      if (msg.role && msg.content) {
        openaiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Model selection
    let openaiModel;
    switch (model) {
      case "gpt4mini": openaiModel = "gpt4mini"; break;
      case "gpt5": openaiModel = "gpt5"; break;
      case "opus": openaiModel = "opus"; break;
      default: openaiModel = "gpt4mini";
    }

    const reply = await createChatCompletion({
      messages: openaiMessages,
      temperature: 0.8,
      maxTokens: 1500,
      model: openaiModel,
    });

    // Find evidence
    const lastUserMsg = recentMessages.filter(m => m.role === "user").pop();
    let sources = [];
    if (lastUserMsg) {
      const detectedPlatform = detectPlatformFromText(lastUserMsg.content);
      if (detectedPlatform) {
        const result = buildChatEvidence(detectedPlatform, lastUserMsg.content);
        sources = result.sources || [];
      }
    }

    return res.json({
      reply,
      sources,
      model: openaiModel,
      duration_ms: Date.now() - start,
    });

  } catch (err) {
    return next(err);
  }
}

function detectPlatformFromText(text) {
  const lower = text.toLowerCase();
  const map = {
    tiktok: ["tiktok", "tik tok", "tt", "fyp", "duet", "stitch"],
    instagram: ["instagram", "insta", "ig", "reels", "carousel", "stories"],
    x: ["twitter", "x.com", "tweet", "thread", "x post"],
    reddit: ["reddit", "subreddit", "upvote", "r/"],
    linkedin: ["linkedin", "li post"],
    youtube: ["youtube", "yt", "shorts", "thumbnail", "subscribe"],
    facebook: ["facebook", "fb", "meta", "group post"],
  };
  for (const [platform, keywords] of Object.entries(map)) {
    if (keywords.some(kw => lower.includes(kw))) return platform;
  }
  return null;
}

export default { chat };
