// backend/services/whisperService.js

import axios from "axios";
import FormData from "form-data";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("⚠️ OPENAI_API_KEY missing – transcription will fail.");
  }
  return key;
}

/**
 * Transcribe audio buffer via Whisper
 */
export async function transcribeAudioBuffer(audioBuffer, filename = "audio.wav") {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const form = new FormData();
  form.append("file", audioBuffer, filename);
  form.append("model", "whisper-1");

  const response = await axios.post(
    `${OPENAI_BASE_URL}/audio/transcriptions`,
    form,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      timeout: 60000,
    }
  );

  return response.data.text || "";
}

