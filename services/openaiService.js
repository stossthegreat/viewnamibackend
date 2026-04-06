// backend/services/openaiService.js

import axios from "axios";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("⚠️ OPENAI_API_KEY missing – OpenAI calls will fail.");
  }
  return key;
}

function getDefaultModel() {
  // Using GPT-4o mini for cost efficiency
  // You can override with OPENAI_MODEL if needed.
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/**
 * Non-streaming chat completion
 */
export async function createChatCompletion({
  messages,
  temperature = 0.7,
  maxTokens = 800,
  model,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model: model || getDefaultModel(),
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

  const content = response.data.choices?.[0]?.message?.content || "";
  return content.trim();
}

/**
 * Streaming chat completion (Server-Sent Events style)
 * onChunk(chunk: string) is called for every new token piece.
 * Resolves with the full text.
 */
export async function createChatCompletionStream({
  messages,
  temperature = 0.7,
  maxTokens = 800,
  model,
  onChunk,
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await axios.post(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      model: model || getDefaultModel(),
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
      const lines = raw
        .toString()
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.trim() === "data: [DONE]") {
          return resolve(full);
        }

        if (!line.startsWith("data:")) continue;

        const json = line.replace("data:", "").trim();
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            if (onChunk) onChunk(delta);
          }
        } catch (err) {
          // swallow malformed partial chunks
        }
      }
    });

    response.data.on("end", () => resolve(full));
    response.data.on("error", (err) =>
      reject(new Error(`OpenAI stream error: ${err.message}`))
    );
  });
}

