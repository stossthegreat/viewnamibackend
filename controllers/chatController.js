// ============================================================
//   CHAT CONTROLLER — RAG-POWERED VIRAL INTELLIGENCE
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";
import { buildChatRAGContext } from "../viral/ragPromptBuilder.js";
import { isRAGReady, getPostCount } from "../viral/ragEngine.js";

function buildSystemPrompt(ragContext, language) {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return `You are ViewNami — a viral social media intelligence engine. Today is ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}.

You have access to REAL scraped viral data from this month. ${getPostCount().toLocaleString()} posts analyzed across TikTok, Instagram, YouTube, and X.

HOW YOU RESPOND:
- Sharp, confident, data-driven. Like a strategist who just spent 6 hours analyzing the data.
- Short paragraphs, 2-3 sentences max each.
- Use real numbers naturally: views, engagement rates, percentages.
- When you reference a creator, ALWAYS include a clickable markdown link: [Watch @name's post](url)
- Be opinionated: "Do this. Not that. Here's the data."
- Include posting time and hashtag recommendations when relevant.

STRUCTURE:
Write in flowing prose with headers. End with Sources.

**What's working**
Paragraph with inline data...

**Why it works**
Psychology in 2 sentences...

**What to do**
Specific action...

**Sources**
[1] Platform data — month year, X posts
[2] @creator — views, engagement

${ragContext}

${language && language !== "auto" && language !== "en" ? `Respond in ${language}. Citations in English.` : ""}`;
}

export async function chat(req, res, next) {
  const start = Date.now();
  try {
    const { messages, model, language = "auto" } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError("Messages array is required.", 400);
    }

    // Get all user text for RAG context
    const allUserText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");

    // Build RAG context — searches vector DB for relevant posts
    let ragContext = "";
    try {
      ragContext = await buildChatRAGContext(allUserText);
    } catch (e) {
      console.warn("RAG context failed:", e.message);
    }

    const systemPrompt = buildSystemPrompt(ragContext, language);
    const openaiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of messages.slice(-20)) {
      if (msg.role && msg.content) {
        openaiMessages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
      }
    }

    const reply = await createChatCompletion({
      messages: openaiMessages,
      temperature: 0.75,
      maxTokens: 1500,
      model: model || "gpt4mini",
    });

    return res.json({
      reply,
      sources: [],
      model: model || "gpt4mini",
      duration_ms: Date.now() - start,
      rag_ready: isRAGReady(),
    });
  } catch (err) {
    return next(err);
  }
}

export default { chat };
