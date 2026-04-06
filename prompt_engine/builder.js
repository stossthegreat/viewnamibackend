// ============================================================
//        MESSAGE BUILDER — UPGRADED
// ============================================================

import { GLOBAL_ENGINE, MODE_AMPLIFIERS } from "./global.js";
import { PRESET_DEFINITIONS } from "./presets.js";

// Safe viral imports — app works without viral data
let buildViralContext = () => "";
let getPlatformForPreset = () => null;
try {
  const store = await import("../viral/store.js");
  buildViralContext = store.buildViralContext;
  getPlatformForPreset = store.getPlatformForPreset;
} catch (e) {
  console.warn("⚠️ Viral store not available:", e.message);
}

// ============================================================
// LANGUAGE CODE TO NAME MAPPING
// ============================================================

const LANGUAGE_NAMES = {
  "en": "English", "es": "Spanish", "fr": "French", "de": "German",
  "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
  "ko": "Korean", "zh": "Chinese (Simplified)", "ar": "Arabic", "hi": "Hindi",
  "bn": "Bengali", "pa": "Punjabi", "te": "Telugu", "mr": "Marathi",
  "ta": "Tamil", "ur": "Urdu", "tr": "Turkish", "vi": "Vietnamese",
  "fa": "Farsi (Persian)", "pl": "Polish", "uk": "Ukrainian", "nl": "Dutch",
  "ro": "Romanian", "el": "Greek", "cs": "Czech", "sv": "Swedish",
  "hu": "Hungarian", "fi": "Finnish", "da": "Danish", "no": "Norwegian",
  "sk": "Slovak", "bg": "Bulgarian", "hr": "Croatian", "sr": "Serbian",
  "lt": "Lithuanian", "lv": "Latvian", "et": "Estonian", "sl": "Slovenian",
  "th": "Thai", "id": "Indonesian", "ms": "Malay", "fil": "Filipino (Tagalog)",
  "sw": "Swahili", "am": "Amharic", "ne": "Nepali", "si": "Sinhala",
  "km": "Khmer", "lo": "Lao", "my": "Burmese", "ka": "Georgian",
  "hy": "Armenian", "az": "Azerbaijani", "kk": "Kazakh", "uz": "Uzbek",
  "he": "Hebrew", "yi": "Yiddish", "af": "Afrikaans", "sq": "Albanian",
  "eu": "Basque", "be": "Belarusian", "bs": "Bosnian", "ca": "Catalan",
  "co": "Corsican", "cy": "Welsh", "eo": "Esperanto", "fo": "Faroese",
  "fy": "Frisian", "ga": "Irish", "gd": "Scottish Gaelic", "gl": "Galician",
  "gu": "Gujarati", "ha": "Hausa", "haw": "Hawaiian", "is": "Icelandic",
  "ig": "Igbo", "jv": "Javanese", "kn": "Kannada", "ky": "Kyrgyz",
  "lb": "Luxembourgish", "mk": "Macedonian", "mg": "Malagasy", "ml": "Malayalam",
  "mt": "Maltese", "mi": "Maori", "mn": "Mongolian", "ps": "Pashto",
  "sa": "Sanskrit", "sm": "Samoan", "sn": "Shona", "sd": "Sindhi",
  "so": "Somali", "st": "Southern Sotho", "su": "Sundanese", "tg": "Tajik",
  "tt": "Tatar", "tk": "Turkmen", "ug": "Uyghur", "xh": "Xhosa",
  "yo": "Yoruba", "zu": "Zulu"
};

function getLanguageName(code) {
  if (!code || code === "auto") return null;
  return LANGUAGE_NAMES[code] || code;
}

// ============================================================
// PRESET TO MODE MAPPING
// ============================================================

const PRESET_TO_MODE = {
  // Legacy Social
  "x_thread": "social", "x_post": "social", "facebook_post": "social",
  "instagram_caption": "social", "instagram_hook": "social", "linkedin_post": "social",
  // Viral Social — Instagram
  "ig_reel_script": "social", "ig_caption": "social", "ig_carousel": "social",
  "ig_story": "social", "ig_bio": "social",
  // Viral Social — TikTok
  "tt_hook": "social", "tt_script": "social", "tt_caption": "social",
  "tt_duet_stitch": "social", "tt_series": "social",
  // Viral Social — X/Twitter
  "x_hot_take": "social", "x_quote_reply": "social",
  // Viral Social — Reddit
  "reddit_post": "social", "reddit_comment": "social", "reddit_story": "social",
  // Viral Social — LinkedIn
  "li_post": "social", "li_carousel": "social", "li_comment": "social",
  // Viral Social — YouTube
  "yt_title_thumb": "social", "yt_shorts_script": "social",
  "yt_description": "social", "yt_community": "social",
  // Viral Social — Facebook
  "fb_post": "social", "fb_reel": "social", "fb_group": "social",
  // Viral Tools
  "magic_viral": "social", "repurpose": "social", "rewrite_viral": "social",
  // Email
  "email_professional": "email", "email_casual": "email",
  // Creative
  "story_novel": "creative", "poem": "creative", "script_dialogue": "creative",
  // Extraction
  "outcomes": "extraction", "unstuck": "extraction",
  "to_do": "extraction", "meeting_notes": "extraction",
  // Others
  "magic": null, "quick_reply": null, "shorten": null,
  "expand": null, "formal_business": null, "casual_friendly": null,
};

// ============================================================
// GET PRESET CONFIG
// ============================================================

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

function buildSystemContent(presetId, language = "auto") {
  const preset = getPresetConfig(presetId);
  const mode = PRESET_TO_MODE[presetId];

  const parts = [GLOBAL_ENGINE];

  if (mode && MODE_AMPLIFIERS[mode]) {
    parts.push(MODE_AMPLIFIERS[mode]);
  }

  // Inject viral data if available
  try {
    const platform = getPlatformForPreset(presetId);
    if (platform) {
      const viralContext = buildViralContext(platform);
      if (viralContext) parts.push(viralContext);
    }
  } catch (e) {
    // Viral data not available — that's fine
  }

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

export function buildMessages({ presetId, userText, language = "auto" }) {
  const preset = getPresetConfig(presetId);
  const systemContent = buildSystemContent(presetId, language);

  const messages = [{ role: "system", content: systemContent }];

  const useExamples = !language || language === "auto" || language === "en";

  if (useExamples && Array.isArray(preset.examples) && preset.examples.length > 0) {
    for (const example of preset.examples) {
      if (!example || !example.input || !example.output) continue;
      messages.push({ role: "user", content: example.input });
      messages.push({
        role: "assistant",
        content: typeof example.output === "string" ? example.output : JSON.stringify(example.output)
      });
    }
  }

  messages.push({ role: "user", content: userText });
  return messages;
}

// ============================================================
// GET PRESET PARAMETERS
// ============================================================

export function getPresetParameters(presetId) {
  const preset = getPresetConfig(presetId);
  return {
    temperature: preset.temperature ?? 0.7,
    max_tokens: preset.max_tokens ?? 600
  };
}

export function getPresetInfo(presetId) {
  const preset = getPresetConfig(presetId);
  const mode = PRESET_TO_MODE[presetId];
  return {
    id: presetId, label: preset.label, mode: mode || "default",
    temperature: preset.temperature, max_tokens: preset.max_tokens,
    exampleCount: preset.examples?.length || 0,
  };
}

export function isValidPreset(presetId) {
  return presetId in PRESET_DEFINITIONS;
}

export function getAllPresetIds() {
  return Object.keys(PRESET_DEFINITIONS);
}

export default {
  getPresetConfig, buildMessages, getPresetParameters,
  getPresetInfo, isValidPreset, getAllPresetIds,
};
