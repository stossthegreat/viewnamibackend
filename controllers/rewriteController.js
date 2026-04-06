// ============================================================
//        REWRITE CONTROLLER — WITH QUALITY VALIDATION
// ============================================================
//
// Handles all 17 pure output presets.
// Now with integrated quality validation + auto-correction.
//
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion, createChatCompletionStream } from "../services/openaiService.js";
import { buildMessages, getPresetParameters } from "../prompt_engine/builder.js";
import { getRewriteFromCache, setRewriteInCache } from "../cache/rewriteCache.js";
import { validateAndEnhance, cleanSlop } from "./qualityValidator.js";
import { getPlatformForPreset, getBonusCardData } from "../viral/store.js";
import { matchEvidence } from "../viral/evidenceMatcher.js";

// ============================================================
// POST /api/rewrite/batch
// ============================================================

/**
 * Batch rewrite endpoint (non-streaming)
 * Body: { text, presetId, language? }
 * Returns: { text, cached, enhanced, quality_score, duration_ms }
 */
export async function batchRewrite(req, res, next) {
  const start = Date.now();
  
  try {
    const { text, presetId, language = "auto" } = req.body || {};

    // Validation
    if (!text || typeof text !== "string") {
      throw new AppError("Text is required and must be a string.", 400);
    }
    if (!presetId || typeof presetId !== "string") {
      throw new AppError("presetId is required and must be a string.", 400);
    }

    // 1) Check cache first
    const cached = await getRewriteFromCache({ text, presetId, language });
    if (cached) {
      // Even cached results get slop cleaning
      const cleaned = cleanSlop(cached);
      const duration = Date.now() - start;
      
      return res.json({
        text: cleaned,
        cached: true,
        enhanced: false,
        quality_score: 100, // Cached = already validated
        duration_ms: duration,
      });
    }

    // 2) Build messages from prompt engine
    const messages = buildMessages({ presetId, userText: text, language });
    const params = getPresetParameters(presetId);

    // 3) Call OpenAI
    const rawOutput = await createChatCompletion({
      messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });

    // 4) Quick slop clean (no API call)
    const cleaned = cleanSlop(rawOutput);

    // 5) Quality validation + auto-correction if needed (WITH LANGUAGE)
    const { finalOutput, wasEnhanced, validation } = await validateAndEnhance({
      output: cleaned,
      presetId,
      originalInput: text,
      autoCorrect: true,
      language, // 🔥 PASS LANGUAGE TO ENHANCEMENT
    });

    // 6) Cache the final result
    await setRewriteInCache({ text, presetId, language, output: finalOutput });

    const duration = Date.now() - start;

    // 7) Build viral bonus cards + evidence if platform preset
    const platform = getPlatformForPreset(presetId);
    let bonus = null;
    let evidence = [];
    let trend_summary = null;

    if (platform) {
      bonus = getBonusCardData(platform);
      const matched = matchEvidence(platform, finalOutput, text, 3);
      evidence = matched.evidence;
      trend_summary = matched.trend_summary;
    }

    return res.json({
      text: finalOutput,
      cached: false,
      enhanced: wasEnhanced,
      quality_score: validation.score,
      duration_ms: duration,
      bonus,
      evidence,
      trend_summary,
    });

  } catch (err) {
    return next(err);
  }
}

// ============================================================
// POST /api/rewrite (STREAMING)
// ============================================================

/**
 * Streaming rewrite endpoint (SSE)
 * Body: { text, presetId, language? }
 * Streams chunks, then sends final validation
 */
export async function streamRewrite(req, res, next) {
  const start = Date.now();
  
  try {
    const { text, presetId, language = "auto" } = req.body || {};

    // Validation
    if (!text || typeof text !== "string") {
      throw new AppError("Text is required and must be a string.", 400);
    }
    if (!presetId || typeof presetId !== "string") {
      throw new AppError("presetId is required and must be a string.", 400);
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Check cache
    const cached = await getRewriteFromCache({ text, presetId, language });
    if (cached) {
      const cleaned = cleanSlop(cached);
      res.write(`data: ${JSON.stringify({ type: "chunk", chunk: cleaned })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", text: cleaned, cached: true })}\n\n`);
      return res.end();
    }

    // Build messages
    const messages = buildMessages({ presetId, userText: text, language });
    const params = getPresetParameters(presetId);

    // Stream from OpenAI
    let fullText = "";
    
    const stream = await createChatCompletionStream({
      messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        fullText += content;
        // Stream chunk to client
        res.write(`data: ${JSON.stringify({ type: "chunk", chunk: content })}\n\n`);
      }
    }

    // Clean and validate final output (WITH LANGUAGE)
    const cleaned = cleanSlop(fullText);
    const { finalOutput, wasEnhanced, validation } = await validateAndEnhance({
      output: cleaned,
      presetId,
      originalInput: text,
      autoCorrect: true,
      language, // 🔥 PASS LANGUAGE TO ENHANCEMENT
    });

    // Cache result
    await setRewriteInCache({ text, presetId, language, output: finalOutput });

    // Send final result
    const duration = Date.now() - start;
    res.write(`data: ${JSON.stringify({ 
      type: "done", 
      text: finalOutput,
      enhanced: wasEnhanced,
      quality_score: validation.score,
      duration_ms: duration,
    })}\n\n`);

    res.end();

  } catch (err) {
    // Send error via SSE
    res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
    res.end();
  }
}

// ============================================================
// POST /api/rewrite/batch (WITH CONTEXT)
// ============================================================

/**
 * Rewrite with context (for Continue feature)
 * Body: { text, presetId, language?, context: string[] }
 */
export async function batchRewriteWithContext(req, res, next) {
  const start = Date.now();
  
  try {
    const { text, presetId, language = "auto", context = [] } = req.body || {};

    // Validation
    if (!text || typeof text !== "string") {
      throw new AppError("Text is required and must be a string.", 400);
    }
    if (!presetId || typeof presetId !== "string") {
      throw new AppError("presetId is required and must be a string.", 400);
    }

    // Build messages with context
    const messages = buildMessages({ presetId, userText: text, language });
    const params = getPresetParameters(presetId);

    // Inject context into the conversation
    if (context.length > 0) {
      const contextPrompt = {
        role: "system",
        content: `CONTEXT FROM PREVIOUS ITEMS:\n${context.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}\n\nUse this context to inform your response. The user is CONTINUING from this context. Maintain consistency and flow.`
      };
      // Insert after system prompt, before examples
      messages.splice(1, 0, contextPrompt);
    }

    // Call OpenAI
    const rawOutput = await createChatCompletion({
      messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
    });

    // Clean + validate (WITH LANGUAGE)
    const cleaned = cleanSlop(rawOutput);
    const { finalOutput, wasEnhanced, validation } = await validateAndEnhance({
      output: cleaned,
      presetId,
      originalInput: text,
      autoCorrect: true,
      language, // 🔥 PASS LANGUAGE TO ENHANCEMENT
    });

    const duration = Date.now() - start;
    
    return res.json({
      text: finalOutput,
      cached: false,
      enhanced: wasEnhanced,
      quality_score: validation.score,
      duration_ms: duration,
    });

  } catch (err) {
    return next(err);
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  batchRewrite,
  streamRewrite,
  batchRewriteWithContext,
};