import express from 'express';
import { transformText, translateText, getLanguages } from '../controllers/textTransformController.js';

const router = express.Router();

// Add request timing middleware
router.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Transform text with AI actions
router.post('/transform-text', transformText);

// Translate text to target language  
router.post('/translate-text', translateText);

// Get available languages for translation
router.get('/languages', getLanguages);

export default router;