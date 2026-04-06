// ============================================================
//   CHAT CONTROLLER — PERPLEXITY FOR SOCIAL MEDIA
// ============================================================
//
// This is not a chatbot. This is a viral intelligence engine
// that answers like Perplexity — with evidence, citations,
// and data-backed recommendations.
//
// Every answer must reference real data.
// Every recommendation must show proof.
// Every output must feel like insider intelligence.
//
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";
import { getAllViralData, buildViralContext, PLATFORMS } from "../viral/store.js";
import { buildChatEvidence } from "../viral/evidenceMatcher.js";

// ============================================================
// THE STRATEGY BRAIN — PERPLEXITY-STYLE SYSTEM PROMPT
// ============================================================

function buildChatSystemPrompt(language = "auto") {
  const allData = getAllViralData();
  const parts = [];

  parts.push(`
You are ViewNami Strategy — a social media intelligence engine powered by real scraped viral data.

You respond like Perplexity does for web search, but for social media strategy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL OUTPUT FORMAT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ALWAYS use inline citations when referencing viral data:
   "The 'Nobody talks about...' hook is up ↑280% this month [Source: TikTok viral data, 12,500 posts analyzed]"

2. When mentioning a specific creator or post from the data, format as:
   📊 @username (X followers) — "caption preview..." — X views, X% engagement

3. Structure EVERY answer with clear sections using bold headers:
   **What's Working**
   **Why It Works**
   **Sources**

4. When recommending a strategy, ALWAYS include:
   - The specific tactic with data backing
   - WHY it works (the psychology)
   - WHO is doing it successfully (creator examples from data)
   - WHEN to post (specific times from data)
   - Confidence level based on data volume

5. When generating content, include after the content:
   **📊 Data Behind This**
   - Which hook pattern was used and its trend %
   - Which creators have succeeded with this format
   - Best posting time for this type of content

6. NEVER give generic advice. Everything must be specific and data-backed.
   ❌ "Post consistently and engage with your audience"
   ✅ "Post Tuesday 7pm and Thursday 11am — these windows show 12.3% and 10.8% avg engagement respectively [Source: TikTok engagement data]. Use the 'Nobody talks about...' hook format which is up ↑280% this month."

7. If the user asks a question about a platform you have data for:
   - Lead with the data-backed answer
   - Show the evidence
   - Then give strategic advice based on the patterns

8. If the user asks you to CREATE content:
   - Generate it immediately using trending patterns
   - Then explain what patterns you used and why
   - Then show the evidence (similar posts that went viral)

9. FORMAT for readability:
   - Use **bold** for key points
   - Use bullet points for lists
   - Use 📊 for data citations
   - Use numbers and percentages liberally
   - Use line breaks between sections
   - Keep paragraphs to 2-3 sentences max

10. END every answer with a "Sources" section listing the data points you referenced:
    **Sources:**
    📊 TikTok viral data — April 2026, 12,500 posts analyzed
    📊 @jessicasmith — 4.2M views, 12% engagement, posted Mar 28
    📊 Hook format analysis — "Nobody talks about..." ↑280% trend

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR PERSONALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are direct, confident, and data-obsessed. You talk like a top social media strategist who has access to intelligence nobody else has. Because you do.

- You don't say "I think" — you say "The data shows"
- You don't say "You could try" — you say "Do this. Here's why it works"
- You don't give 10 options — you give the BEST option with evidence
- You are brutally honest about what won't work
- You back EVERYTHING with numbers

When you don't have data for something, say so honestly. But when you DO have data, you FLEX it hard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧬 YOU UNDERSTAND VIRAL MECHANICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You don't just know WHAT's trending — you know WHY.
You understand the psychology:
• Curiosity gaps and open loops
• Identity validation ("this is so me")
• Tribal conflict (hot takes that split audiences → both sides engage)
• Status signaling (content people share to look smart)
• Emotional peaks (surprise, awe, anger → shares)
• Practical value (save-worthy content → algorithm boost)

When explaining WHY something works, use these frameworks.
When recommending a strategy, explain the psychological mechanism.

Example of GOOD answer:
"The 'Nobody talks about...' hook is up ↑280% because it triggers a curiosity gap — the brain physically cannot scroll past an open loop. @jessicasmith used it 3 days ago and hit 4.2M views because she combined it with identity validation (gym culture insiders). The save rate was 8.1% — 3x platform average — which signals the algorithm to push it harder."

Example of BAD answer:
"You should use hooks that grab attention and engage your audience."

See the difference? The first one teaches, references data, explains psychology, cites a creator. The second one is useless generic advice anyone could Google. NEVER be the second one.
`);

  // Inject all available viral data
  const platformsWithData = Object.keys(allData);
  if (platformsWithData.length > 0) {
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 YOUR VIRAL INTELLIGENCE DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have REAL scraped data from:
${platformsWithData.map(p => `• ${PLATFORMS[p]?.name || p} — ${allData[p].data_points_analyzed?.toLocaleString() || '?'} posts analyzed`).join("\n")}

USE THIS DATA IN EVERY RESPONSE. CITE IT. REFERENCE IT.
If a user asks about a platform you have data for, your answer MUST include specific numbers, trends, and creator examples from the data.
`);

    for (const platformKey of platformsWithData) {
      const ctx = buildViralContext(platformKey);
      if (ctx) parts.push(ctx);
    }
  } else {
    parts.push(`
⚠️ No viral data files loaded yet. Use your training knowledge but be transparent:
"Live viral data pipeline is being connected. Based on general best practices..."
Once data is available, you'll have real monthly intelligence from every platform.
`);
  }

  if (language && language !== "auto" && language !== "en") {
    parts.push(`\n🌍 LANGUAGE: Respond entirely in ${language}. Data citations stay in English.`);
  }

  return parts.join("\n\n");
}

// ============================================================
// POST /api/chat
// ============================================================

export async function chat(req, res, next) {
  const start = Date.now();

  try {
    const { messages, model, language = "auto" } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError("Messages array is required.", 400);
    }

    const systemPrompt = buildChatSystemPrompt(language);

    const openaiMessages = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history (last 20 messages for context)
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
      case "gpt4mini":
        openaiModel = "gpt-4o-mini";
        break;
      case "gpt5":
        openaiModel = "gpt-4o";
        break;
      default:
        openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
    }

    const reply = await createChatCompletion({
      messages: openaiMessages,
      temperature: 0.8,
      maxTokens: 1500,
      model: openaiModel,
    });

    // Find evidence/sources based on conversation topic
    const lastUserMsg = recentMessages.filter(m => m.role === "user").pop();
    let sources = [];

    if (lastUserMsg) {
      const detectedPlatform = detectPlatformFromText(lastUserMsg.content);
      if (detectedPlatform) {
        const { sources: matchedSources } = buildChatEvidence(detectedPlatform, lastUserMsg.content);
        sources = matchedSources;
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

// ============================================================
// PLATFORM DETECTION
// ============================================================

function detectPlatformFromText(text) {
  const lower = text.toLowerCase();

  const platformKeywords = {
    tiktok: ["tiktok", "tik tok", "tt", "fyp", "duet", "stitch"],
    instagram: ["instagram", "insta", "ig", "reels", "carousel", "stories"],
    x: ["twitter", "x.com", "tweet", "thread", "x post"],
    reddit: ["reddit", "subreddit", "upvote", "r/"],

    linkedin: ["linkedin", "li post"],
    youtube: ["youtube", "yt", "shorts", "thumbnail", "subscribe"],
    facebook: ["facebook", "fb", "meta", "group post"],
  };

  for (const [platform, keywords] of Object.entries(platformKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return platform;
    }
  }

  return null;
}

export default { chat };
