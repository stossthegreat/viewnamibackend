// backend/controllers/transcribeController.js

import { AppError } from "../utils/errors.js";
import { transcribeAudioBuffer } from "../services/whisperService.js";
import {
  getTranscriptionFromCache,
  setTranscriptionInCache,
} from "../cache/transcriptionCache.js";

/**
 * POST /api/transcribe
 * Expects multer to have put audio file buffer on req.file
 */
export async function transcribe(req, res, next) {
  const start = Date.now();
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError(
        'No audio file provided. Upload under field name "audio".',
        400
      );
    }

    const audioBuffer = req.file.buffer;
    const filename = req.file.originalname || "audio.wav";

    // 1) Cache check
    const cached = await getTranscriptionFromCache(audioBuffer);
    if (cached) {
      const duration = Date.now() - start;
      return res.json({
        text: cached,
        cached: true,
        duration_ms: duration,
      });
    }

    // 2) Transcribe via Whisper
    const text = await transcribeAudioBuffer(audioBuffer, filename);

    // 3) Cache
    await setTranscriptionInCache(audioBuffer, text);

    const duration = Date.now() - start;
    return res.json({
      text,
      cached: false,
      duration_ms: duration,
    });
  } catch (err) {
    return next(err);
  }
}

