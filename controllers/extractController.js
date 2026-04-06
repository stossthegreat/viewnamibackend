// ============================================================
//        EXTRACT CONTROLLER — NUCLEAR REBUILD
// ============================================================
//
// Handles two special presets:
// 1. OUTCOMES — Extract atomic, actionable items from chaos
// 2. UNSTUCK — One insight + one tiny action
//
// These are NOT rewrites. They are EXTRACTIONS.
// The AI must understand, categorize, and structure.
//
// ============================================================

import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";

// Maximum retry attempts
const MAX_QUALITY_RETRIES = 2;
const MIN_OUTCOMES_SCORE = 60;
const MIN_UNSTUCK_SCORE = 60;

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
// QUALITY VALIDATION HELPERS
// ============================================================

function validateOutcomesQuality(outcomes) {
  let score = 100;
  const issues = [];
  
  // Must have at least 1 outcome
  if (!outcomes || outcomes.length === 0) {
    return { score: 0, issues: ["No outcomes extracted"] };
  }
  
  // Check each outcome
  outcomes.forEach((outcome, i) => {
    if (!outcome.text || outcome.text.length < 5) {
      score -= 30;
      issues.push(`Outcome ${i + 1} is too short or empty`);
    }
    if (outcome.text && outcome.text.length > 300) {
      score -= 10;
      issues.push(`Outcome ${i + 1} is too long (should be atomic)`);
    }
    if (!outcome.type || !["message", "task", "idea", "content", "note"].includes(outcome.type)) {
      score -= 20;
      issues.push(`Outcome ${i + 1} has invalid type`);
    }
  });
  
  return { score: Math.max(0, score), issues };
}

function validateUnstuckQuality(insight, action, originalInput) {
  let score = 100;
  const issues = [];
  
  // Insight checks
  if (!insight || insight.length < 10) {
    score -= 40;
    issues.push("Insight is too short or empty");
  }
  if (insight && insight.length > 250) {
    score -= 20;
    issues.push("Insight is too long (should be concise)");
  }
  
  // Action checks
  if (!action || action.length < 5) {
    score -= 40;
    issues.push("Action is too short or empty");
  }
  if (action && action.length > 150) {
    score -= 20;
    issues.push("Action is too long (should be one small move)");
  }
  
  return { score: Math.max(0, score), issues };
}

// ============================================================
// OUTCOMES — SYSTEM PROMPT
// ============================================================
const OUTCOMES_SYSTEM_PROMPT = `You are an OUTCOME EXTRACTION ENGINE.

Your job: Take messy human voice input and extract CLEAR, ATOMIC, ACTIONABLE outcomes.

═══════════════════════════════════════════════════════════════
🎯 WHAT IS AN OUTCOME?
═══════════════════════════════════════════════════════════════

An outcome is ONE independently actionable item. Not a paragraph. Not a summary.
ONE thing someone can DO, SEND, CREATE, or REMEMBER.

═══════════════════════════════════════════════════════════════
📦 OUTCOME TYPES (choose ONE per item)
═══════════════════════════════════════════════════════════════

MESSAGE — Something to communicate to someone
  • Emails, texts, DMs, calls to make
  • "Tell X about Y", "Reply to Z", "Ask about..."
  • Anything that involves SENDING information to another person

TASK — An action to complete
  • Physical actions: buy, fix, clean, book, schedule
  • Work tasks: review, submit, update, finish
  • Clear deliverables with implied completion
  
IDEA — A concept to explore or develop
  • Feature ideas, business ideas, creative concepts
  • "What if we...", "Maybe try...", "Could explore..."
  • Things that need thinking, not immediate action

CONTENT — Something to create/publish
  • Posts, articles, videos, designs
  • Creative output meant for an audience
  • "Write a post about...", "Create a video on..."

NOTE — Information to remember
  • Facts, observations, things learned
  • Reference information, insights
  • Not actionable, just worth capturing

═══════════════════════════════════════════════════════════════
🔬 EXTRACTION RULES
═══════════════════════════════════════════════════════════════

1. ATOMIC = Each outcome stands ALONE
   ❌ "Email John about budget and timeline" 
   ✅ "Email John about budget" + "Email John about timeline"

2. ACTIONABLE = Clear what to do
   ❌ "Think about the project"
   ✅ "Decide on project deadline by Friday"

3. SPECIFIC = No vague fluff
   ❌ "Do something about marketing"
   ✅ "Draft 3 Instagram post ideas for product launch"

4. SHORT = 1-2 sentences MAX per outcome
   ❌ Long paragraph explaining context
   ✅ Crisp, clear statement

5. PRESERVE INTENT = Capture what they MEANT
   - Fix speech errors, remove filler words
   - But keep their actual intention intact

6. SMART CATEGORIZATION
   - "Tell my wife I'll be late" → MESSAGE (not task)
   - "Post on Instagram about the trip" → CONTENT (not task)
   - "Remember to bring umbrella" → NOTE (not task)
   - "Maybe we could add dark mode" → IDEA (not task)

═══════════════════════════════════════════════════════════════
📊 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON:

{
  "outcomes": [
    {"type": "task", "text": "Schedule dentist appointment"},
    {"type": "message", "text": "Email Sarah the meeting notes"},
    {"type": "idea", "text": "Add user onboarding flow to the app"}
  ]
}

═══════════════════════════════════════════════════════════════
⚠️ QUALITY GATES
═══════════════════════════════════════════════════════════════

MINIMUM: 1 outcome (even simple input has something)
MAXIMUM: 10 outcomes (if more, prioritize most important)
IDEAL: 2-6 outcomes for typical input

If input is gibberish/unclear: Extract what you can, skip what you can't.
If input is a question TO you: Treat it as content they want to send to someone else.

NEVER output empty outcomes array unless input is truly empty.
NEVER add outcomes that weren't implied in the input.
NEVER explain your reasoning — just output the JSON.`;

// ============================================================
// OUTCOMES — FEW-SHOT EXAMPLES
// ============================================================
const OUTCOMES_EXAMPLES = [
  {
    input: "I need to email John about the budget and also remember to pick up groceries and maybe we should add a dark mode feature to the app oh and post something on LinkedIn about the product launch",
    output: {
      outcomes: [
        { type: "message", text: "Email John about the budget" },
        { type: "task", text: "Pick up groceries" },
        { type: "idea", text: "Add dark mode feature to the app" },
        { type: "content", text: "Write LinkedIn post about the product launch" }
      ]
    }
  },
  {
    input: "had a great meeting with the team today we decided to push the launch to march and sarah will handle the testing and i need to update the roadmap also tom mentioned that the competitor just raised funding which is interesting",
    output: {
      outcomes: [
        { type: "note", text: "Launch pushed to March" },
        { type: "note", text: "Sarah is handling testing" },
        { type: "task", text: "Update the roadmap" },
        { type: "note", text: "Competitor just raised funding" }
      ]
    }
  },
  {
    input: "tell my wife ill be late for dinner probably around 8 and remind me to book flights for the conference next month",
    output: {
      outcomes: [
        { type: "message", text: "Tell wife will be late for dinner, arriving around 8pm" },
        { type: "task", text: "Book flights for next month's conference" }
      ]
    }
  },
  {
    input: "what if we created a weekly newsletter and also partnered with influencers for the launch and maybe do a referral program too",
    output: {
      outcomes: [
        { type: "idea", text: "Create a weekly newsletter" },
        { type: "idea", text: "Partner with influencers for launch" },
        { type: "idea", text: "Build a referral program" }
      ]
    }
  },
  {
    input: "the client said they want the blue version not the red one and they need it by friday also they asked if we can add animation",
    output: {
      outcomes: [
        { type: "note", text: "Client wants blue version, not red" },
        { type: "task", text: "Deliver to client by Friday" },
        { type: "note", text: "Client asked about adding animation" }
      ]
    }
  }
];

// ============================================================
// UNSTUCK — SYSTEM PROMPT
// ============================================================
const UNSTUCK_SYSTEM_PROMPT = `You are a CLARITY ENGINE for people who feel stuck.

Someone is overwhelmed, confused, or paralyzed. Your job:
1. Cut through the noise to find what's ACTUALLY going on
2. Give them ONE tiny action that creates momentum

═══════════════════════════════════════════════════════════════
🧠 THE PSYCHOLOGY OF STUCK
═══════════════════════════════════════════════════════════════

People get stuck because of:
• OVERWHELM — Too many things, brain shuts down
• FEAR — Afraid of failure, judgment, or the unknown
• PERFECTIONISM — Can't start because it won't be perfect
• CLARITY — Don't know what they actually want
• ENERGY — Depleted, burned out, running on empty
• CONFLICT — Competing priorities or values
• AVOIDANCE — Dodging something uncomfortable

Your insight should NAME what's really happening.
Not therapy speak. Not generic motivation. The REAL thing.

═══════════════════════════════════════════════════════════════
🎯 THE INSIGHT
═══════════════════════════════════════════════════════════════

1-2 sentences that:
• Name the ACTUAL blocker (not the surface symptom)
• Feel like "oh shit, that's exactly it"
• Are specific to THEIR situation
• Show you understand, not judge

GOOD INSIGHTS:
✅ "You're not procrastinating — you're afraid of finding out you're not good enough."
✅ "You have decision fatigue. Too many options, zero filters."
✅ "You're waiting for motivation, but motivation comes AFTER action, not before."
✅ "You're not stuck on the task. You're stuck on what people will think."

BAD INSIGHTS:
❌ "It sounds like you're feeling overwhelmed." (too generic)
❌ "You should try to be more positive." (useless)
❌ "Many people feel this way." (who cares)

═══════════════════════════════════════════════════════════════
🚀 THE ACTION
═══════════════════════════════════════════════════════════════

ONE tiny, specific action that:
• Takes less than 10 minutes
• Requires zero motivation
• Creates immediate momentum
• Is embarrassingly simple
• They can do RIGHT NOW

The action should feel almost too easy.
That's the point. Stuck people need WINS, not more tasks.

GOOD ACTIONS:
✅ "Open the document. Just open it. Don't write anything."
✅ "Set a timer for 5 minutes. Work on it until it rings. Then stop."
✅ "Write one sentence. The worst sentence. Just to break the blank page."
✅ "Text one person: 'Hey, can we talk this week?'"
✅ "Delete 3 things from your to-do list that don't actually matter."

BAD ACTIONS:
❌ "Make a detailed plan" (too big)
❌ "Think about what you really want" (too vague)
❌ "Try to stay positive" (not an action)
❌ "Finish the project" (that's the whole problem)

═══════════════════════════════════════════════════════════════
📊 OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON:

{
  "insight": "Your one-liner insight here.",
  "action": "Your tiny specific action here."
}

═══════════════════════════════════════════════════════════════
⚠️ RULES
═══════════════════════════════════════════════════════════════

• NEVER be preachy or motivational-poster
• NEVER give multiple actions (ONE only)
• NEVER be vague ("try harder", "believe in yourself")
• NEVER diagnose mental health conditions
• NEVER make them feel worse about being stuck

TONE: Calm, direct, like a smart friend who sees clearly.

Be the person who says the thing everyone's thinking but no one says.`;

// ============================================================
// UNSTUCK — FEW-SHOT EXAMPLES
// ============================================================
const UNSTUCK_EXAMPLES = [
  {
    input: "I have so much to do and I just can't start I keep scrolling my phone and then feeling guilty about it",
    output: {
      insight: "You're using your phone to avoid the discomfort of choosing. Too many tasks = paralysis, so your brain picks the easy dopamine hit instead.",
      action: "Pick ONE task. Set a 5-minute timer. Work only until it rings. That's it."
    }
  },
  {
    input: "I want to start my own business but I've been planning for 6 months and haven't done anything",
    output: {
      insight: "Planning feels productive but it's actually hiding. You're afraid that starting will prove you can't do it. Spoiler: you can't plan your way to certainty.",
      action: "Today, tell one person out loud: 'I'm starting a business.' That's the commitment. Do it before tonight."
    }
  },
  {
    input: "I know I should work out but I have no energy and no motivation",
    output: {
      insight: "You're waiting to feel motivated before you start. But motivation is a result of action, not a prerequisite for it.",
      action: "Put your workout clothes on. That's it. Don't even commit to exercising. Just change clothes and see what happens."
    }
  },
  {
    input: "I need to have a hard conversation with my partner but I keep putting it off",
    output: {
      insight: "You're not avoiding the conversation — you're avoiding the discomfort of not knowing how they'll react. The anticipation is worse than the reality.",
      action: "Say exactly this: 'There's something I've been wanting to talk about. Can we find 15 minutes tonight?' Send it now."
    }
  },
  {
    input: "I feel stuck in my job but I don't know what else I would do",
    output: {
      insight: "You're trying to figure out your entire future before taking a single step. That's not how clarity works — it comes from motion, not meditation.",
      action: "Write down 3 jobs that sound even slightly interesting. No judgment, no research. Just 3 titles. Takes 2 minutes."
    }
  },
  {
    input: "my apartment is a mess and it's stressing me out but I can't bring myself to clean it",
    output: {
      insight: "The mess feels like one giant impossible task. It's not. It's just a bunch of small tasks pretending to be a monster.",
      action: "Set a timer for 10 minutes. Clean ONE surface — your desk, the kitchen counter, whatever. When the timer stops, you stop."
    }
  }
];

// ============================================================
// CONTROLLER: Extract Outcomes
// ============================================================
export async function extractOutcomes(req, res, next) {
  const start = Date.now();
  
  try {
    const { text, language = "auto" } = req.body || {};

    if (!text || typeof text !== "string") {
      throw new AppError("Text is required and must be a string.", 400);
    }

    const cleanedText = text.trim();
    if (cleanedText.length < 5) {
      throw new AppError("Text too short to extract outcomes.", 400);
    }

    // Build base messages
    const languageName = getLanguageName(language);
    const languageInstruction = languageName 
      ? `\n\n🌍 LANGUAGE REQUIREMENT: You MUST write ALL outcome text in ${languageName}. Every word must be in ${languageName}. JSON keys stay in English, but all text values must be ${languageName}.`
      : "";
    
    const baseMessages = [
      { 
        role: "system", 
        content: OUTCOMES_SYSTEM_PROMPT + languageInstruction
      }
    ];

    // Add few-shot examples
    for (const example of OUTCOMES_EXAMPLES) {
      baseMessages.push({ role: "user", content: example.input });
      baseMessages.push({ role: "assistant", content: JSON.stringify(example.output) });
    }

    // Quality validation loop
    let validatedOutcomes = [];
    let validation;
    let attempts = 0;
    
    for (let i = 0; i <= MAX_QUALITY_RETRIES; i++) {
      attempts = i + 1;
      
      // Add actual user input (fresh each attempt)
      const messages = [...baseMessages, { role: "user", content: cleanedText }];
      
      // Slightly increase temperature on retries
      const temperature = i === 0 ? 0.4 : 0.4 + (i * 0.1);
      
      const output = await createChatCompletion({
        messages,
        temperature,
        maxTokens: 800,
      });

      // Parse JSON
      let parsed;
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(output);
        }
      } catch (parseError) {
        console.error(`[Outcomes] Parse failed (attempt ${attempts}):`, output.substring(0, 200));
        continue; // Retry
      }

      if (!parsed.outcomes || !Array.isArray(parsed.outcomes)) {
        console.error(`[Outcomes] Invalid structure (attempt ${attempts})`);
        continue; // Retry
      }

      // Validate each outcome
      const validTypes = ["message", "task", "idea", "content", "note"];
      validatedOutcomes = parsed.outcomes.filter(o => {
        return o && 
               typeof o.text === "string" && 
               o.text.trim().length > 0 &&
               validTypes.includes(o.type);
      });

      // Clean up outcome texts
      validatedOutcomes = validatedOutcomes.map(o => ({
        type: o.type,
        text: cleanOutcomeText(o.text)
      }));

      // Validate quality
      validation = validateOutcomesQuality(validatedOutcomes);
      
      if (validation.score >= MIN_OUTCOMES_SCORE) {
        break;
      }
      
      console.log(`[Outcomes] Quality check failed (attempt ${attempts}, score: ${validation.score}):`, 
        validation.issues.map(i => i.code).join(", "));
    }

    // Log if sub-optimal
    if (validation && validation.score < MIN_OUTCOMES_SCORE) {
      console.warn(`[Outcomes] Returning sub-optimal (${attempts} attempts, score: ${validation.score})`);
    }

    const duration = Date.now() - start;
    
    return res.json({
      outcomes: validatedOutcomes,
      count: validatedOutcomes.length,
      duration_ms: duration,
      quality_score: validation?.score || 0,
      attempts,
    });
    
  } catch (err) {
    return next(err);
  }
}

// Helper to clean outcome text
function cleanOutcomeText(text) {
  return text
    .trim()
    .replace(/^[-•*]\s*/, "") // Remove leading bullets
    .replace(/^\d+\.\s*/, "") // Remove leading numbers
    .replace(/\s+/g, " "); // Normalize whitespace
}

// ============================================================
// CONTROLLER: Extract Unstuck
// ============================================================
export async function extractUnstuck(req, res, next) {
  const start = Date.now();
  
  try {
    const { text, language = "auto" } = req.body || {};

    if (!text || typeof text !== "string") {
      throw new AppError("Text is required and must be a string.", 400);
    }

    const cleanedText = text.trim();
    if (cleanedText.length < 10) {
      throw new AppError("Text too short - tell me more about what's going on.", 400);
    }

    // Build base messages
    const baseMessages = [
      { 
        role: "system", 
        content: UNSTUCK_SYSTEM_PROMPT + (language !== "auto" ? `\n\nLANGUAGE: You MUST respond in "${language}" language. JSON keys stay in English.` : "")
      }
    ];

    // Add few-shot examples
    for (const example of UNSTUCK_EXAMPLES) {
      baseMessages.push({ role: "user", content: example.input });
      baseMessages.push({ role: "assistant", content: JSON.stringify(example.output) });
    }

    // Quality validation loop
    let insight = "";
    let action = "";
    let validation;
    let attempts = 0;
    
    for (let i = 0; i <= MAX_QUALITY_RETRIES; i++) {
      attempts = i + 1;
      
      // Add actual user input
      const messages = [...baseMessages, { role: "user", content: cleanedText }];
      
      // Slightly increase temperature on retries for variety
      const temperature = i === 0 ? 0.6 : 0.6 + (i * 0.1);
      
      const output = await createChatCompletion({
        messages,
        temperature,
        maxTokens: 500,
      });

      // Parse JSON
      let parsed;
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(output);
        }
      } catch (parseError) {
        console.error(`[Unstuck] Parse failed (attempt ${attempts}):`, output.substring(0, 200));
        continue; // Retry
      }

      if (!parsed.insight || !parsed.action) {
        console.error(`[Unstuck] Invalid structure (attempt ${attempts})`);
        continue; // Retry
      }

      insight = cleanUnstuckText(parsed.insight);
      action = cleanUnstuckText(parsed.action);

      // Validate quality
      validation = validateUnstuckQuality(insight, action, cleanedText);
      
      if (validation.score >= MIN_UNSTUCK_SCORE) {
        break;
      }
      
      console.log(`[Unstuck] Quality check failed (attempt ${attempts}, score: ${validation.score}):`, 
        validation.issues.map(i => i.code).join(", "));
    }

    // Final validation
    if (!insight || !action) {
      throw new AppError("Failed to generate helpful response after multiple attempts", 500);
    }

    // Log if sub-optimal
    if (validation && validation.score < MIN_UNSTUCK_SCORE) {
      console.warn(`[Unstuck] Returning sub-optimal (${attempts} attempts, score: ${validation.score})`);
    }

    const duration = Date.now() - start;
    
    return res.json({
      insight,
      action,
      duration_ms: duration,
      quality_score: validation?.score || 0,
      attempts,
    });
    
  } catch (err) {
    return next(err);
  }
}

// Helper to clean unstuck text
function cleanUnstuckText(text) {
  return text
    .trim()
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/^\*\*|\*\*$/g, "") // Remove markdown bold
    .replace(/\s+/g, " "); // Normalize whitespace
}