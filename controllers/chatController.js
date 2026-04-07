import { AppError } from "../utils/errors.js";
import { createChatCompletion } from "../services/openaiService.js";

let getViralData = () => null;
let buildViralContext = () => "";
let PLATFORMS = {};
try {
  const store = await import("../viral/store.js");
  getViralData = store.getViralData;
  buildViralContext = store.buildViralContext;
  PLATFORMS = store.PLATFORMS;
} catch (e) {}

function detectFromText(text) {
  const lower = text.toLowerCase();
  let platform = null;
  const platMap = {
    tiktok:["tiktok","tik tok","tt ","fyp"],instagram:["instagram","insta","ig ","reels","carousel"],
    x:["twitter","x.com","tweet","thread"],youtube:["youtube","yt ","shorts"],
    linkedin:["linkedin"],facebook:["facebook","fb "],reddit:["reddit"],
  };
  for (const [p,kws] of Object.entries(platMap)) {
    if (kws.some(k => lower.includes(k))) { platform = p; break; }
  }
  let niche = null;
  const nicheMap = {
    fitness:["fitness","gym","workout","muscle","exercise"],food:["food","cook","recipe","baking","meal","restaurant"],
    beauty:["beauty","skincare","makeup","grwm"],business:["business","entrepreneur","startup","marketing"],
    tech:["tech","coding","ai","software","developer"],finance:["money","invest","finance","stock","crypto"],
    comedy:["funny","comedy","humor"],motivation:["motivation","mindset","discipline"],
    fashion:["fashion","outfit","style","ootd"],travel:["travel","vacation","adventure"],
  };
  for (const [n,kws] of Object.entries(nicheMap)) {
    if (kws.some(k => lower.includes(k))) { niche = n; break; }
  }
  return { platform, niche };
}

function buildPrompt(platform, niche, language) {
  const now = new Date();
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // Load the right viral data
  let viralContext = "";
  let topPosts = [];
  
  const keys = [];
  if (platform && niche) keys.push(`${platform}_${niche}`);
  if (platform) keys.push(platform);
  if (niche) {
    for (const p of ['tiktok','instagram','x','youtube']) keys.push(`${p}_${niche}`);
  }
  keys.push('tiktok_fitness');
  
  for (const key of keys) {
    const data = getViralData(key);
    if (data) {
      viralContext = buildViralContext(key);
      topPosts = data.top_posts || [];
      break;
    }
  }

  // Build the top posts section with REAL links
  let postsSection = "";
  if (topPosts.length > 0) {
    postsSection = `\n\nREAL VIRAL POSTS YOU MUST REFERENCE (these are real, with real URLs — share them):\n`;
    topPosts.slice(0, 10).forEach((p, i) => {
      postsSection += `\n${i+1}. ${p.author} (${(p.followers||0).toLocaleString()} followers)\n`;
      postsSection += `   "${p.caption}"\n`;
      postsSection += `   ${(p.views||0).toLocaleString()} views | ${(p.likes||0).toLocaleString()} likes | ${p.engagement_rate||0}% engagement\n`;
      postsSection += `   Posted: ${p.posted_date || 'recently'}\n`;
      postsSection += `   Link: ${p.url || 'N/A'}\n`;
    });
    postsSection += `\nWhen referencing these posts, ALWAYS include the link so the user can go watch them. Say "Go study this one" or "Watch how they do it" and give the link.\n`;
  }

  return `You are ViewNami — a viral social media intelligence engine. Today is ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}.

You have REAL scraped data from this month. You are NOT using old training data. Everything you reference below is REAL and CURRENT.

HOW YOU TALK:
- Like a sharp strategist texting a friend. Not formal. Not corporate. Not dry.
- Short punchy paragraphs. Mix short and medium sentences.
- Use real numbers naturally in your sentences — don't list them in bullet points.
- When you reference a creator, make it feel like a recommendation: "Go watch @creator's post — they hit 4.2M views doing exactly this. Link: [url]"
- Give the user something to DO, not just information to read.
- Be opinionated. "This works. That doesn't. Here's why."
- Sound like you've been studying this data all day and you're excited to share what you found.

WHAT TO INCLUDE IN EVERY RESPONSE:
1. What's actually working right now — be specific, use numbers
2. Real creators doing it well — name them, link their posts, tell the user to go study them
3. WHY it works — the psychology in one or two sentences, not an essay
4. What the user should do TODAY — specific action, not vague advice

WHAT TO AVOID:
- Bullet point walls
- "Here are some tips" style responses
- Academic tone
- Saying the same generic advice everyone knows
- Headers without substance under them
- Repeating the same creator twice

End with a Sources section — keep it clean:

**Sources**
[1] TikTok fitness data — April 2026, 1,045 posts
[2] @creator — views, engagement

${viralContext}
${postsSection}
${language && language !== "auto" && language !== "en" ? `Respond in ${language}.` : ""}`;
}

export async function chat(req, res, next) {
  const start = Date.now();
  try {
    const { messages, model, language = "auto" } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError("Messages array is required.", 400);
    }

    const allUserText = messages.filter(m => m.role === "user").map(m => m.content).join(" ");
    const { platform, niche } = detectFromText(allUserText);
    
    const systemPrompt = buildPrompt(platform, niche, language);
    const openaiMessages = [{ role: "system", content: systemPrompt }];

    for (const msg of messages.slice(-20)) {
      if (msg.role && msg.content) {
        openaiMessages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content });
      }
    }

    const reply = await createChatCompletion({
      messages: openaiMessages, temperature: 0.75, maxTokens: 1500, model: model || "gpt4mini",
    });

    return res.json({ reply, sources: [], model: model || "gpt4mini", duration_ms: Date.now() - start });
  } catch (err) { return next(err); }
}

export default { chat };
