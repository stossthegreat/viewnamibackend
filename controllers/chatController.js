// ============================================================
//   CHAT CONTROLLER — PERPLEXITY FOR VIRAL INTELLIGENCE
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";

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
  console.warn("Viral imports not available for chat:", e.message);
}

function buildChatSystemPrompt(language = "auto") {
  const allData = getAllViralData();
  const now = new Date();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const currentDate = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

  const parts = [];

  parts.push(`You are ViewNami, a social media intelligence engine. Today is ${currentDate}.

You respond exactly like Perplexity AI does for web search — but your domain is social media viral intelligence. You have access to real scraped viral data from major platforms.

RESPONSE STYLE — Study Perplexity and match it exactly:

1. Write in clean, flowing prose. Not bullet-point lists. Not emoji spam. Write like an intelligent analyst delivering a briefing.

2. Use inline citations naturally within your sentences, like this:
   "Story-based content is outperforming tutorials by 3:1 this month [TikTok, 12,500 posts analyzed], with the 'Nobody talks about...' hook format seeing a 280% increase in engagement."

3. When referencing a specific creator, weave it into the text naturally:
   "This format was recently used by @jessicasmith (2.4M followers), who hit 4.2M views with a gym culture post using this exact hook structure."

4. Structure longer answers with clean headers — no emojis in headers:
   
   **What's trending**
   Flowing paragraph with inline citations...
   
   **Why it works**
   Flowing paragraph explaining the psychology...
   
   **Recommended approach**
   Specific, actionable advice with data...
   
   **Sources**
   Numbered list of data references

5. The Sources section at the end should be clean and numbered:
   
   **Sources**
   [1] TikTok viral data — April 2026, 12,500 posts analyzed
   [2] @jessicasmith — 4.2M views, 12% engagement, March 28
   [3] Hook format trend analysis — "Nobody talks about..." +280%

6. Keep your tone authoritative but approachable. You're not a hype man. You're not aggressive. You're a calm expert who happens to have data nobody else has. Think Bloomberg terminal meets social media — precise, clean, valuable.

7. When generating content for the user, present it in a clean block, then follow with a brief "Data context" section explaining your choices. No excessive labeling.

8. Never use:
   - Emoji headers or emoji bullets
   - "🔥" or "💡" or "🎯" as decoration
   - ALL CAPS sections
   - Aggressive/hype language ("BEAST MODE", "CRUSHING IT")
   - Walls of bullet points
   - "Here's what I found" or "Great question"
   
9. Do use:
   - Clean markdown: **bold**, *italic*, numbered lists where appropriate
   - Inline citations [Source]
   - Specific numbers woven into sentences
   - Short paragraphs with whitespace between them
   - A calm, knowledgeable voice

10. If you don't have data for something, say so briefly and offer what you can from general knowledge. Don't apologize excessively.

WHEN GENERATING CONTENT:

Present the content cleanly, then add context:

---

*Content generated using the "Nobody talks about..." hook format, which has seen a 280% increase in engagement this month on TikTok. @jessicasmith used a similar structure on March 28 and reached 4.2M views. Recommended posting window: Tuesday 7pm (12.3% avg engagement).*

**Sources**
[1] TikTok hook trend data — April 2026
[2] @jessicasmith — 4.2M views, March 28

---

This is how Perplexity would present sourced information. Match this quality.`);

  // Inject viral data
  const platformsWithData = Object.keys(allData);
  if (platformsWithData.length > 0) {
    parts.push(`You have real scraped data from: ${platformsWithData.map(p => PLATFORMS[p]?.name || p).join(", ")}.`);

    for (const platformKey of platformsWithData) {
      const ctx = buildViralContext(platformKey);
      if (ctx) parts.push(ctx);
    }
  } else {
    parts.push(`No scraped viral data is loaded yet. Use your training knowledge but note that live data will be connected soon. Still provide specific, strategic advice.`);
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

    const reply = await createChatCompletion({
      messages: openaiMessages,
      temperature: 0.7,
      maxTokens: 1500,
      model: model || "gpt4mini",
    });

    // Find evidence
    const lastUserMsg = recentMessages.filter(m => m.role === "user").pop();
    let sources = [];
    if (lastUserMsg) {
      const detected = detectPlatformFromText(lastUserMsg.content);
      if (detected) {
        const result = buildChatEvidence(detected, lastUserMsg.content);
        sources = result.sources || [];
      }
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
