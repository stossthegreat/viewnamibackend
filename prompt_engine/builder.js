// ============================================================
//        MESSAGE BUILDER — UPGRADED
// ============================================================
//
// Constructs OpenAI messages by combining:
// 1. Global Engine (master brain)
// 2. Mode Amplifier (social/email/creative/extraction)
// 3. Preset Behaviour (specific instructions)
// 4. Language Requirement (if specified)
// 5. Few-shot Examples (pattern learning)
//
// ============================================================

import { GLOBAL_ENGINE, MODE_AMPLIFIERS } from "./global.js";
import { PRESET_DEFINITIONS } from "./presets.js";
import { buildViralContext, getPlatformForPreset } from "../viral/store.js";

// ============================================================
// LANGUAGE CODE TO NAME MAPPING
// ============================================================

const LANGUAGE_NAMES = {
  "en": "English",
  "es": "Spanish",
  "fr": "French",
  "de": "German",
  "it": "Italian",
  "pt": "Portuguese",
  "ru": "Russian",
  "ja": "Japanese",
  "ko": "Korean",
  "zh": "Chinese (Simplified)",
  "ar": "Arabic",
  "hi": "Hindi",
  "bn": "Bengali",
  "pa": "Punjabi",
  "te": "Telugu",
  "mr": "Marathi",
  "ta": "Tamil",
  "ur": "Urdu",
  "tr": "Turkish",
  "vi": "Vietnamese",
  "fa": "Farsi (Persian)",
  "pl": "Polish",
  "uk": "Ukrainian",
  "nl": "Dutch",
  "ro": "Romanian",
  "el": "Greek",
  "cs": "Czech",
  "sv": "Swedish",
  "hu": "Hungarian",
  "fi": "Finnish",
  "da": "Danish",
  "no": "Norwegian",
  "sk": "Slovak",
  "bg": "Bulgarian",
  "hr": "Croatian",
  "sr": "Serbian",
  "lt": "Lithuanian",
  "lv": "Latvian",
  "et": "Estonian",
  "sl": "Slovenian",
  "th": "Thai",
  "id": "Indonesian",
  "ms": "Malay",
  "fil": "Filipino (Tagalog)",
  "sw": "Swahili",
  "am": "Amharic",
  "ne": "Nepali",
  "si": "Sinhala",
  "km": "Khmer",
  "lo": "Lao",
  "my": "Burmese",
  "ka": "Georgian",
  "hy": "Armenian",
  "az": "Azerbaijani",
  "kk": "Kazakh",
  "uz": "Uzbek",
  "he": "Hebrew",
  "yi": "Yiddish",
  "af": "Afrikaans",
  "sq": "Albanian",
  "eu": "Basque",
  "be": "Belarusian",
  "bs": "Bosnian",
  "ca": "Catalan",
  "co": "Corsican",
  "cy": "Welsh",
  "eo": "Esperanto",
  "fo": "Faroese",
  "fy": "Frisian",
  "ga": "Irish",
  "gd": "Scottish Gaelic",
  "gl": "Galician",
  "gu": "Gujarati",
  "ha": "Hausa",
  "haw": "Hawaiian",
  "is": "Icelandic",
  "ig": "Igbo",
  "jv": "Javanese",
  "kn": "Kannada",
  "ky": "Kyrgyz",
  "lb": "Luxembourgish",
  "mk": "Macedonian",
  "mg": "Malagasy",
  "ml": "Malayalam",
  "mt": "Maltese",
  "mi": "Maori",
  "mn": "Mongolian",
  "ps": "Pashto",
  "sa": "Sanskrit",
  "sm": "Samoan",
  "sn": "Shona",
  "sd": "Sindhi",
  "so": "Somali",
  "st": "Southern Sotho",
  "su": "Sundanese",
  "tg": "Tajik",
  "tt": "Tatar",
  "tk": "Turkmen",
  "ug": "Uyghur",
  "xh": "Xhosa",
  "yo": "Yoruba",
  "zu": "Zulu"
};

function getLanguageName(code) {
  if (!code || code === "auto") return null;
  return LANGUAGE_NAMES[code] || code;
}

// ============================================================
// PRESET TO MODE MAPPING
// ============================================================

const PRESET_TO_MODE = {
  // ── Legacy Social (from ViewNami era) ──
  "x_thread": "social",
  "x_post": "social",
  "facebook_post": "social",
  "instagram_caption": "social",
  "instagram_hook": "social",
  "linkedin_post": "social",

  // ── VIRAL SOCIAL — Instagram ──
  "ig_reel_script": "social",
  "ig_caption": "social",
  "ig_carousel": "social",
  "ig_story": "social",
  "ig_bio": "social",

  // ── VIRAL SOCIAL — TikTok ──
  "tt_hook": "social",
  "tt_script": "social",
  "tt_caption": "social",
  "tt_duet_stitch": "social",
  "tt_series": "social",

  // ── VIRAL SOCIAL — X/Twitter ──
  "x_hot_take": "social",
  "x_quote_reply": "social",

  // ── VIRAL SOCIAL — Reddit ──
  "reddit_post": "social",
  "reddit_comment": "social",
  "reddit_story": "social",

  // ── VIRAL SOCIAL — LinkedIn ──
  "li_post": "social",
  "li_carousel": "social",
  "li_comment": "social",

  // ── VIRAL SOCIAL — YouTube ──
  "yt_title_thumb": "social",
  "yt_shorts_script": "social",
  "yt_description": "social",
  "yt_community": "social",

  // ── VIRAL SOCIAL — Facebook ──
  "fb_post": "social",
  "fb_reel": "social",
  "fb_group": "social",

  // ── VIRAL TOOLS ──
  "magic_viral": "social",
  "repurpose": "social",
  "rewrite_viral": "social",

  // ── Email ──
  "email_professional": "email",
  "email_casual": "email",

  // ── Creative ──
  "story_novel": "creative",
  "poem": "creative",
  "script_dialogue": "creative",

  // ── Extraction ──
  "outcomes": "extraction",
  "unstuck": "extraction",
  "to_do": "extraction",
  "meeting_notes": "extraction",

  // ── Others (no amplifier) ──
  "magic": null,
  "quick_reply": null,
  "shorten": null,
  "expand": null,
  "formal_business": null,
  "casual_friendly": null,
};

// ============================================================
// GET PRESET CONFIG
// ============================================================

/**
 * Get configuration for a specific preset
 * @param {string} presetId 
 * @returns {object} Preset config or magic as fallback
 */
export function getPresetConfig(presetId) {
  const config = PRESET_DEFINITIONS[presetId];
  if (!config) {
    console.warn(`Unknown preset: ${presetId}, falling back to magic`);
    return PRESET_DEFINITIONS["magic"];
  }
  return config;
}

// ============================================================
// BUILD SYSTEM CONTENT
// ============================================================

/**
 * Build the complete system message
 * @param {string} presetId 
 * @param {string} language 
 * @returns {string}
 */
function buildSystemContent(presetId, language = "auto") {
  const preset = getPresetConfig(presetId);
  const mode = PRESET_TO_MODE[presetId];
  
  // Start with global engine
  const parts = [GLOBAL_ENGINE];
  
  // Add mode amplifier if applicable
  if (mode && MODE_AMPLIFIERS[mode]) {
    parts.push(MODE_AMPLIFIERS[mode]);
  }

  // Inject viral data if this preset is platform-specific
  const platform = getPlatformForPreset(presetId);
  if (platform) {
    const viralContext = buildViralContext(platform);
    if (viralContext) {
      parts.push(viralContext);
    }
  }

  // Add language requirement
  if (language && language !== "auto") {
    const languageName = getLanguageName(language);
    parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 LANGUAGE REQUIREMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT LANGUAGE: ${languageName}

You MUST write your ENTIRE response in ${languageName}.
This is non-negotiable. Every word of output must be in ${languageName}.
If outputting JSON, write JSON values in ${languageName} (keys stay English).
`);
  }
  
  // Add preset-specific behaviour
  parts.push(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ACTIVE PRESET: ${presetId.toUpperCase()} (${preset.label})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preset.behaviour ? preset.behaviour.trim() : "Apply standard transformation rules."}
`);

  return parts.join("\n\n");
}

// ============================================================
// BUILD MESSAGES
// ============================================================

/**
 * Build complete OpenAI chat messages
 * @param {object} options
 * @param {string} options.presetId - The preset to use
 * @param {string} options.userText - User's input text
 * @param {string} [options.language] - Target language ('auto' or ISO code)
 * @returns {Array} Messages array for OpenAI
 */
export function buildMessages({ presetId, userText, language = "auto" }) {
  const preset = getPresetConfig(presetId);
  const systemContent = buildSystemContent(presetId, language);

  const messages = [
    {
      role: "system",
      content: systemContent
    }
  ];

  // 🔥 FIX: Only add examples if language is English or auto
  // English examples confuse the model when outputting other languages
  const useExamples = !language || language === "auto" || language === "en";
  
  if (useExamples && Array.isArray(preset.examples) && preset.examples.length > 0) {
    for (const example of preset.examples) {
      if (!example || !example.input || !example.output) continue;
      
      messages.push({ 
        role: "user", 
        content: example.input 
      });
      messages.push({ 
        role: "assistant", 
        content: typeof example.output === "string" 
          ? example.output 
          : JSON.stringify(example.output)
      });
    }
  }

  // Add actual user input
  messages.push({
    role: "user",
    content: userText
  });

  return messages;
}

// ============================================================
// GET PRESET PARAMETERS
// ============================================================

/**
 * Get OpenAI parameters for a preset
 * @param {string} presetId 
 * @returns {object} { temperature, max_tokens }
 */
export function getPresetParameters(presetId) {
  const preset = getPresetConfig(presetId);
  return {
    temperature: preset.temperature ?? 0.7,
    max_tokens: preset.max_tokens ?? 600
  };
}

// ============================================================
// GET PRESET INFO (for debugging/logging)
// ============================================================

/**
 * Get preset metadata
 * @param {string} presetId 
 * @returns {object}
 */
export function getPresetInfo(presetId) {
  const preset = getPresetConfig(presetId);
  const mode = PRESET_TO_MODE[presetId];
  
  return {
    id: presetId,
    label: preset.label,
    mode: mode || "default",
    temperature: preset.temperature,
    max_tokens: preset.max_tokens,
    exampleCount: preset.examples?.length || 0,
  };
}

// ============================================================
// VALIDATE PRESET EXISTS
// ============================================================

/**
 * Check if a preset ID is valid
 * @param {string} presetId 
 * @returns {boolean}
 */
export function isValidPreset(presetId) {
  return presetId in PRESET_DEFINITIONS;
}

// ============================================================
// GET ALL PRESET IDS
// ============================================================

/**
 * Get list of all available preset IDs
 * @returns {string[]}
 */
export function getAllPresetIds() {
  return Object.keys(PRESET_DEFINITIONS);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
  getPresetConfig,
  buildMessages,
  getPresetParameters,
  getPresetInfo,
  isValidPreset,
  getAllPresetIds,
};