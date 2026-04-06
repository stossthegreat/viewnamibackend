// backend/routes/transcribe.js

import express from "express";
import multer from "multer";
import { transcribe } from "../controllers/transcribeController.js";

const router = express.Router();

// Multer setup – memory storage, 25MB limit, audio only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/webm",
      "audio/ogg",
      "audio/flac",
    ];
    const okMime = allowedMimes.includes(file.mimetype);
    const okExt = /\.(wav|mp3|m4a|webm|ogg|flac)$/i.test(file.originalname);
    if (okMime || okExt) return cb(null, true);
    return cb(new Error("Invalid file type. Please upload a valid audio file."));
  },
});

router.post("/", upload.single("audio"), transcribe);

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "Audio file must be < 25MB.",
      });
    }
    return res.status(400).json({
      error: "Upload error",
      message: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      error: "Invalid request",
      message: err.message,
    });
  }
  return next();
});

export default router;
