// ============================================================
//   REWRITE CONTROLLER — RAG POWERED
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion, createChatCompletionStream } from "../services/openaiService.js";
import { buildMessages, getPresetParameters } from "../prompt_engine/builder.js";
import { getRewriteFromCache, setRewriteInCache } from "../cache/rewriteCache.js";
import { validateAndEnhance, cleanSlop } from "./qualityValidator.js";
import { buildRAGContext } from "../viral/ragPromptBuilder.js";

// Map preset IDs to platforms
const PRESET_PLATFORM = {
  ig_reel_script:"instagram",ig_caption:"instagram",ig_carousel:"instagram",ig_story:"instagram",ig_bio:"instagram",
  tt_hook:"tiktok",tt_script:"tiktok",tt_caption:"tiktok",tt_duet_stitch:"tiktok",tt_series:"tiktok",
  x_post:"x",x_thread:"x",x_hot_take:"x",x_quote_reply:"x",
  reddit_post:"reddit",reddit_comment:"reddit",reddit_story:"reddit",
  li_post:"linkedin",li_carousel:"linkedin",li_comment:"linkedin",
  yt_title_thumb:"youtube",yt_shorts_script:"youtube",yt_description:"youtube",yt_community:"youtube",
  fb_post:"facebook",fb_reel:"facebook",fb_group:"facebook",
};

export async function batchRewrite(req, res, next) {
  const start = Date.now();

  try {
    const { text, presetId, language = "auto" } = req.body || {};

    if (!text || typeof text !== "string") throw new AppError("Text is required.", 400);
    if (!presetId || typeof presetId !== "string") throw new AppError("presetId is required.", 400);

    // Check cache
    const cached = await getRewriteFromCache({ text, presetId, language });
    if (cached) {
      return res.json({ text: cleanSlop(cached), cached: true, enhanced: false, quality_score: 100, duration_ms: Date.now() - start });
    }

    // Build standard messages
    const messages = buildMessages({ presetId, userText: text, language });
    const params = getPresetParameters(presetId);

    // RAG: Get relevant viral posts for this text + platform
    const platform = PRESET_PLATFORM[presetId] || null;
    let ragContext = "";
    try {
      ragContext = await buildRAGContext(text, platform);
    } catch (e) {
      console.warn("RAG failed for rewrite:", e.message);
    }

    // Inject RAG context into system message
    if (ragContext && messages.length > 0 && messages[0].role === "system") {
      messages[0].content += "\n\n" + ragContext;
    }

    // Call AI
    const rawOutput = await createChatCompletion({
      messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });

    const cleaned = cleanSlop(rawOutput);

    // Quality validation
    const { finalOutput, wasEnhanced, validation } = await validateAndEnhance({
      output: cleaned,
      presetId,
      originalInput: text,
      autoCorrect: true,
      language,
    });

    // Cache
    await setRewriteInCache({ text, presetId, language, output: finalOutput });

    return res.json({
      text: finalOutput,
      cached: false,
      enhanced: wasEnhanced,
      quality_score: validation.score,
      duration_ms: Date.now() - start,
    });

  } catch (err) {
    return next(err);
  }
}

export async function streamRewrite(req, res, next) {
  const start = Date.now();

  try {
    const { text, presetId, language = "auto" } = req.body || {};
    if (!text || typeof text !== "string") throw new AppError("Text is required.", 400);
    if (!presetId || typeof presetId !== "string") throw new AppError("presetId is required.", 400);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const cached = await getRewriteFromCache({ text, presetId, language });
    if (cached) {
      const cleaned = cleanSlop(cached);
      res.write(`data: ${JSON.stringify({ type: "chunk", chunk: cleaned })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", text: cleaned, cached: true })}\n\n`);
      return res.end();
    }

    const messages = buildMessages({ presetId, userText: text, language });
    const params = getPresetParameters(presetId);

    // RAG
    const platform = PRESET_PLATFORM[presetId] || null;
    try {
      const ragContext = await buildRAGContext(text, platform);
      if (ragContext && messages[0]?.role === "system") {
        messages[0].content += "\n\n" + ragContext;
      }
    } catch (e) {}

    const fullText = await createChatCompletionStream({
      messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", chunk })}\n\n`);
      },
    });

    const cleaned = cleanSlop(fullText);
    await setRewriteInCache({ text, presetId, language, output: cleaned });
    res.write(`data: ${JSON.stringify({ type: "done", text: cleaned })}\n\n`);
    res.end();

  } catch (err) {
    if (!res.headersSent) return next(err);
    res.end();
  }
}
