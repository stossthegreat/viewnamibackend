// backend/services/openaiService.js
//
// Multi-model AI service — supports OpenAI (GPT) + Anthropic (Claude)
//

import axios from "axios";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY;
}

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY;
}

/**
 * Check if a model is Claude
 */
function isClaude(model) {
  return model && (model.startsWith("claude") || model === "opus" || model === "sonnet" || model === "haiku");
}

/**
 * Map friendly model names to actual API model IDs
 */
function resolveModel(model) {
  const modelMap = {
    // OpenAI
    "gpt4mini": "gpt-4o-mini",
    "gpt4o-mini": "gpt-4o-mini",
    "gpt5": "gpt-4o",
    "gpt4o": "gpt-4o",
    // Claude
    "opus": "claude-sonnet-4-20250514",
    "sonnet": "claude-sonnet-4-20250514",
    "haiku": "claude-haiku-4-5-20251001",
    "claude": "claude-sonnet-4-20250514",
  };
  return modelMap[model] || model || "gpt-4o-mini";
}

/**
 * Non-streaming chat completion — routes to OpenAI or Claude
 */
export async function createChatCompletion({
  messages,
  temperature = 0.7,
  maxTokens = 800,
  model,
}) {
  const resolvedModel = resolveModel(model);

  if (isClaude(resolvedModel)) {
    return callClaude({ messages, temperature, maxTokens, model: resolvedModel });
  }

  return callOpenAI({ messages, temperature, maxTokens, model: resolvedModel });
}

/**
 * Call OpenAI API
 */
async function callOpenAI({ messages, temperature, maxTokens, model }) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  return (response.data.choices?.[0]?.message?.content || "").trim();
}

/**
 * Call Anthropic Claude API
 */
async function callClaude({ messages, temperature, maxTokens, model }) {
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  // Convert OpenAI message format to Anthropic format
  // Anthropic needs system message separate, and messages array of {role, content}
  let systemPrompt = "";
  const anthropicMessages = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemPrompt += (systemPrompt ? "\n\n" : "") + msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      });
    }
  }

  // Ensure messages alternate user/assistant (Anthropic requirement)
  // and first message is from user
  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: "user", content: "Hello" });
  }

  const response = await axios.post(
    `${ANTHROPIC_BASE_URL}/messages`,
    {
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  // Anthropic returns content as array of blocks
  const content = response.data.content;
  if (Array.isArray(content)) {
    return content.map(block => block.text || "").join("").trim();
  }
  return (content || "").trim();
}

/**
 * Streaming chat completion (OpenAI only for now)
 */
export async function createChatCompletionStream({
  messages,
  temperature = 0.7,
  maxTokens = 800,
  model,
  onChunk,
}) {
  const apiKey = getOpenAIKey();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resolvedModel = resolveModel(model);

  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model: resolvedModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 60000,
    }
  );

  return new Promise((resolve, reject) => {
    let full = "";

    response.data.on("data", (raw) => {
      const lines = raw.toString().split("\n").filter((line) => line.trim() !== "");
      for (const line of lines) {
        if (line.trim() === "data: [DONE]") return resolve(full);
        if (!line.startsWith("data:")) continue;
        try {
          const parsed = JSON.parse(line.replace("data:", "").trim());
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            if (onChunk) onChunk(delta);
          }
        } catch (err) {}
      }
    });

    response.data.on("end", () => resolve(full));
    response.data.on("error", (err) => reject(new Error(`Stream error: ${err.message}`)));
  });
}
