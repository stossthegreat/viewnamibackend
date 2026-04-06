// ============================================================
//        QUALITY VALIDATION ENGINE
// ============================================================
//
// The last line of defense before output reaches the user.
// Catches weak outputs, triggers self-correction if needed.
//
// Two modes:
// 1. VALIDATE — Check if output meets quality bar
// 2. ENHANCE — If weak, send back for improvement
//
// ============================================================

import { createChatCompletion } from "../services/openaiService.js";

// ============================================================
// LANGUAGE MAPPING
// ============================================================

const LANGUAGE_NAMES = {
  "en": "English", "es": "Spanish", "fr": "French", "de": "German",
  "it": "Italian", "pt": "Portuguese", "ru": "Russian", "ja": "Japanese",
  "ko": "Korean", "zh": "Chinese", "ar": "Arabic", "hi": "Hindi",
  "fa": "Farsi (Persian)", "tr": "Turkish", "vi": "Vietnamese",
  "nl": "Dutch", "pl": "Polish", "uk": "Ukrainian", "he": "Hebrew"
};

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || "English";
}

// ============================================================
// QUALITY RULES BY PRESET CATEGORY
// ============================================================

const QUALITY_RULES = {
  
  // === EMAILS ===
  email: {
    minLength: 50,
    maxLength: 800,
    mustContain: [],
    mustNotContain: ["here is your", "as an ai", "i cannot", "i can't"],
    checks: [
      { name: "hasGreeting", test: (text) => /^(hi|hello|hey|dear|good morning|good afternoon)/i.test(text.trim()) },
      { name: "hasSignoff", test: (text) => /(best|regards|thanks|cheers|sincerely|thank you)[,.]?\s*(\[|$)/im.test(text) },
      { name: "notTooFormal", test: (text) => !/(pursuant to|aforementioned|hereby|heretofore)/i.test(text) },
    ]
  },

  // === SOCIAL MEDIA — VIRAL BEAST VALIDATION ===
  social: {
    minLength: 20,
    maxLength: 2000,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot", "i can't", "here is your", "here's your", "i'd be happy to"],
    checks: [
      // Hook quality — first line MUST be punchy
      { name: "hookIsPunchy", test: (text) => {
        const firstLine = text.split('\n').find(l => l.trim().length > 0) || "";
        return firstLine.length < 80 && firstLine.length > 5;
      }},
      // Hook doesn't start weak
      { name: "hookNotWeak", test: (text) => {
        const first = (text.split('\n').find(l => l.trim().length > 0) || "").toLowerCase().trim();
        const weakStarts = ["i think", "in my opinion", "here are", "today i want", "so basically", "let me share", "i wanted to"];
        return !weakStarts.some(w => first.startsWith(w));
      }},
      // Not boring corporate garbage
      { name: "notBoring", test: (text) => !/(it is important to|we should all|in today's world|in this day and age|at the end of the day)/i.test(text) },
      // Not generic motivational slop
      { name: "notGenericMotivation", test: (text) => !/(embrace the journey|live your best life|be the change|unlock your potential|level up your|game.?changer)/i.test(text) },
      // Not AI slop phrases
      { name: "notAISlop", test: (text) => !/(delve|leverage|tapestry|multifaceted|it's worth noting|in the realm of|navigate the)/i.test(text) },
      // Has energy — uses short sentences (at least some under 8 words)
      { name: "hasEnergy", test: (text) => {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const shortOnes = sentences.filter(s => s.trim().split(/\s+/).length <= 8);
        return shortOnes.length >= Math.min(2, sentences.length);
      }},
      // Doesn't start with a label/header the user didn't ask for
      { name: "noUnwantedLabel", test: (text) => {
        const first = text.trim().toLowerCase();
        return !first.startsWith("sure!") && !first.startsWith("absolutely!") && !first.startsWith("great question");
      }},
    ]
  },

  // === QUICK REPLY ===
  reply: {
    minLength: 5,
    maxLength: 300,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot"],
    checks: [
      { name: "isShort", test: (text) => text.split(' ').length < 50 },
      { name: "notOverExplain", test: (text) => text.split('.').length < 5 },
    ]
  },

  // === CREATIVE (story, poem, script) ===
  creative: {
    minLength: 100,
    maxLength: 3000,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot", "here is your", "here's a"],
    checks: [
      { name: "hasDepth", test: (text) => text.length > 150 },
      { name: "notList", test: (text) => (text.match(/^[\-•\*\d]/gm) || []).length < 3 }, // Creative shouldn't be listy
    ]
  },

  // === UTILITY (shorten, expand, formal, casual) ===
  utility: {
    minLength: 10,
    maxLength: 2000,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot", "here is your"],
    checks: [
      { name: "transformed", test: (text, original) => text.toLowerCase() !== original?.toLowerCase() },
    ]
  },

  // === STRUCTURED (to-do, meeting notes) ===
  structured: {
    minLength: 20,
    maxLength: 1500,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot"],
    checks: [
      { name: "hasStructure", test: (text) => /[\-•☐\*]|^\d+\./m.test(text) || /##|:$/m.test(text) },
    ]
  },

  // === OUTCOMES (extraction) ===
  outcomes: {
    minLength: 0, // JSON
    maxLength: 5000,
    mustContain: [],
    mustNotContain: [],
    checks: [
      { name: "hasOutcomes", test: (text) => {
        try {
          const parsed = JSON.parse(text);
          return parsed.outcomes && parsed.outcomes.length > 0;
        } catch { return false; }
      }},
      { name: "validTypes", test: (text) => {
        try {
          const parsed = JSON.parse(text);
          const validTypes = ["message", "task", "idea", "content", "note"];
          return parsed.outcomes.every(o => validTypes.includes(o.type));
        } catch { return false; }
      }},
    ]
  },

  // === UNSTUCK (extraction) ===
  unstuck: {
    minLength: 0, // JSON
    maxLength: 2000,
    mustContain: [],
    mustNotContain: [],
    checks: [
      { name: "hasInsight", test: (text) => {
        try {
          const parsed = JSON.parse(text);
          return parsed.insight && parsed.insight.length > 20;
        } catch { return false; }
      }},
      { name: "hasAction", test: (text) => {
        try {
          const parsed = JSON.parse(text);
          return parsed.action && parsed.action.length > 15;
        } catch { return false; }
      }},
      { name: "actionIsSmall", test: (text) => {
        try {
          const parsed = JSON.parse(text);
          // Action should be doable quickly (no "create a full plan" etc)
          return !/(create a detailed|make a complete|develop a full|build a comprehensive)/i.test(parsed.action);
        } catch { return false; }
      }},
    ]
  },

  // === DEFAULT ===
  default: {
    minLength: 20,
    maxLength: 3000,
    mustContain: [],
    mustNotContain: ["as an ai", "i cannot", "i can't", "here is your rewritten", "here's your"],
    checks: []
  }
};

// ============================================================
// PRESET TO CATEGORY MAPPING
// ============================================================

const PRESET_CATEGORY_MAP = {
  // Emails
  "email_professional": "email",
  "email_casual": "email",
  
  // Social
  "x_thread": "social",
  "x_post": "social",
  "facebook_post": "social",
  "instagram_caption": "social",
  "instagram_hook": "social",
  "linkedin_post": "social",
  
  // Reply
  "quick_reply": "reply",
  
  // Creative
  "story_novel": "creative",
  "poem": "creative",
  "script_dialogue": "creative",
  
  // Utility
  "shorten": "utility",
  "expand": "utility",
  "formal_business": "utility",
  "casual_friendly": "utility",
  
  // Structured
  "to_do": "structured",
  "meeting_notes": "structured",
  
  // Extraction
  "outcomes": "outcomes",
  "unstuck": "unstuck",
  
  // Default
  "magic": "default",
};

// ============================================================
// MAIN VALIDATION FUNCTION
// ============================================================

/**
 * Validate output quality
 * @param {string} output - The AI output to validate
 * @param {string} presetId - The preset used
 * @param {string} originalInput - The original user input (for comparison)
 * @returns {object} { isValid, issues, score }
 */
export function validateOutput(output, presetId, originalInput = "") {
  const category = PRESET_CATEGORY_MAP[presetId] || "default";
  const rules = QUALITY_RULES[category];
  
  const issues = [];
  let score = 100;

  // 1. Check length
  if (output.length < rules.minLength) {
    issues.push(`Output too short (${output.length} < ${rules.minLength})`);
    score -= 30;
  }
  if (output.length > rules.maxLength) {
    issues.push(`Output too long (${output.length} > ${rules.maxLength})`);
    score -= 10;
  }

  // 2. Check mustNotContain (AI slop detection)
  for (const phrase of rules.mustNotContain) {
    if (output.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
      score -= 25;
    }
  }

  // 3. Check mustContain
  for (const phrase of rules.mustContain) {
    if (!output.toLowerCase().includes(phrase.toLowerCase())) {
      issues.push(`Missing required phrase: "${phrase}"`);
      score -= 15;
    }
  }

  // 4. Run category-specific checks
  for (const check of rules.checks) {
    if (!check.test(output, originalInput)) {
      issues.push(`Failed check: ${check.name}`);
      score -= 15;
    }
  }

  // 5. Universal AI slop detection
  const slopPatterns = [
    /^(sure|certainly|of course|absolutely)[,!]/i,
    /^(here is|here's|i've created|i have created)/i,
    /hope this helps/i,
    /let me know if you (need|want|would like)/i,
    /feel free to/i,
    /\bdelve\b/i,
    /\bevergreen\b/i,
    /\btapestry\b/i,
    /in conclusion,/i,
    /it's important to note/i,
    /at the end of the day/i,
  ];

  for (const pattern of slopPatterns) {
    if (pattern.test(output)) {
      issues.push(`AI slop detected: ${pattern}`);
      score -= 20;
    }
  }

  return {
    isValid: score >= 60,
    score: Math.max(0, score),
    issues,
    category,
  };
}

// ============================================================
// SELF-CORRECTION PROMPT
// ============================================================

const CORRECTION_SYSTEM_PROMPT = `You are a QUALITY CONTROL editor.

You've been given an AI output that has quality issues. Your job is to FIX IT.

RULES:
1. Keep the same intent and meaning
2. Fix ONLY the issues mentioned
3. Output ONLY the corrected text — no explanations
4. Never start with "Here is" or "Sure" or "Certainly"
5. Never end with "Let me know if you need anything"
6. Never use AI slop words: delve, tapestry, leverage, synergy, evergreen
7. Sound HUMAN, not AI

Just output the fixed version. Nothing else.`;

// ============================================================
// ENHANCE FUNCTION (SELF-CORRECTION)
// ============================================================

/**
 * Attempt to improve a weak output
 * @param {string} output - The weak output
 * @param {string} presetId - The preset used
 * @param {string} originalInput - Original user input
 * @param {string[]} issues - List of issues found
 * @param {string} language - Language code (e.g., "es", "fr")
 * @returns {Promise<string>} Improved output
 */
export async function enhanceOutput(output, presetId, originalInput, issues, language = "auto") {
  const issueList = issues.join("\n- ");
  
  // Add language instruction if non-English
  const languageName = language && language !== "auto" ? getLanguageName(language) : null;
  const languageInstruction = languageName 
    ? `\n\n⚠️ CRITICAL: Write your corrected output ENTIRELY in ${languageName}. Every word must be in ${languageName}.`
    : "";
  
  const messages = [
    { role: "system", content: CORRECTION_SYSTEM_PROMPT + languageInstruction },
    { 
      role: "user", 
      content: `ORIGINAL USER INPUT:\n${originalInput}\n\nAI OUTPUT WITH ISSUES:\n${output}\n\nISSUES TO FIX:\n- ${issueList}\n\nProvide the corrected output only:`
    }
  ];

  const enhanced = await createChatCompletion({
    messages,
    temperature: 0.5,
    maxTokens: 1000,
  });

  return enhanced.trim();
}

// ============================================================
// FULL VALIDATION + CORRECTION PIPELINE
// ============================================================

/**
 * Validate and optionally enhance output
 * @param {object} options
 * @param {string} options.output - AI output
 * @param {string} options.presetId - Preset used
 * @param {string} options.originalInput - User's original input
 * @param {boolean} options.autoCorrect - Whether to auto-correct issues
 * @param {string} options.language - Language code for enhancement
 * @returns {Promise<object>} { finalOutput, wasEnhanced, validation }
 */
export async function validateAndEnhance({ output, presetId, originalInput, autoCorrect = true, language = "auto" }) {
  // First validation
  const validation = validateOutput(output, presetId, originalInput);
  
  // If valid or auto-correct disabled, return as-is
  if (validation.isValid || !autoCorrect) {
    return {
      finalOutput: output,
      wasEnhanced: false,
      validation,
    };
  }

  // Attempt enhancement WITH LANGUAGE
  try {
    const enhanced = await enhanceOutput(output, presetId, originalInput, validation.issues, language);
    
    // Validate enhanced version
    const enhancedValidation = validateOutput(enhanced, presetId, originalInput);
    
    // Use enhanced only if it's better
    if (enhancedValidation.score > validation.score) {
      return {
        finalOutput: enhanced,
        wasEnhanced: true,
        validation: enhancedValidation,
        originalValidation: validation,
      };
    }
  } catch (err) {
    console.error("Enhancement failed:", err);
  }

  // Return original if enhancement didn't help
  return {
    finalOutput: output,
    wasEnhanced: false,
    validation,
  };
}

// ============================================================
// QUICK VALIDATION (NO CORRECTION)
// ============================================================

/**
 * Quick check if output passes quality bar
 * @param {string} output 
 * @param {string} presetId 
 * @returns {boolean}
 */
export function isOutputValid(output, presetId) {
  return validateOutput(output, presetId).isValid;
}

// ============================================================
// SLOP CLEANER (FAST POST-PROCESS)
// ============================================================

/**
 * Quick cleanup of common AI slop — no API call needed
 * @param {string} output 
 * @returns {string}
 */
export function cleanSlop(output) {
  let cleaned = output;

  // Remove common AI prefixes
  const prefixPatterns = [
    /^(sure[,!]?\s*)/i,
    /^(certainly[,!]?\s*)/i,
    /^(of course[,!]?\s*)/i,
    /^(absolutely[,!]?\s*)/i,
    /^(here is[^:]*:\s*)/i,
    /^(here's[^:]*:\s*)/i,
    /^(i've created[^:]*:\s*)/i,
  ];

  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Remove common AI suffixes
  const suffixPatterns = [
    /\s*let me know if you (need|want|would like)[^.]*\.?\s*$/i,
    /\s*feel free to[^.]*\.?\s*$/i,
    /\s*hope this helps[^.]*\.?\s*$/i,
    /\s*i hope this[^.]*\.?\s*$/i,
  ];

  for (const pattern of suffixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

// ============================================================
// EXPORT DEFAULT PIPELINE
// ============================================================

export default {
  validateOutput,
  enhanceOutput,
  validateAndEnhance,
  isOutputValid,
  cleanSlop,
  QUALITY_RULES,
  PRESET_CATEGORY_MAP,
}add them so i can see . 2- bro on outcome