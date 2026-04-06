// ============================================================
//        TEXT TRANSFORMATION CONTROLLER
// ============================================================
//
// Elite AI text transformations with deadly precision.
// The backend that powers the viral AI actions menu.
//
// ============================================================

const { openai } = require('../config/openai');

// Elite transformation prompts - deadly precise
const TRANSFORMATION_PROMPTS = {
  rewrite: `You are an elite writing coach. Rewrite this text to be:
- Clearer and more impactful
- Better structured and flowing
- More engaging and memorable
- Grammatically perfect
- Maintain the original meaning and tone

Text: {text}

Rewritten version:`,

  expand: `You are a master content creator. Expand this text by:
- Adding rich, relevant details
- Including concrete examples
- Providing deeper context
- Making it more comprehensive
- Keep the same style and voice

Text: {text}

Expanded version:`,

  shorten: `You are an expert editor. Make this text concise by:
- Removing unnecessary words
- Keeping all key points
- Making it punchy and direct
- Maintaining clarity
- Preserving the core message

Text: {text}

Shortened version:`,

  professional: `Transform this text to sound:
- Highly professional and authoritative
- Confident and credible
- Appropriate for business contexts
- Polished and sophisticated
- Error-free and precise

Text: {text}

Professional version:`,

  casual: `Make this text sound:
- Friendly and conversational
- Relaxed and approachable
- Natural and authentic
- Easy to relate to
- Warm and engaging

Text: {text}

Casual version:`,

  powerful: `Rewrite this to be incredibly persuasive:
- Use power words and strong language
- Create emotional impact
- Build compelling arguments
- Make it memorable and quotable
- Drive action and engagement

Text: {text}

Powerful version:`,

  explain: `Explain this in simple, easy-to-understand terms:
- Use plain language
- Break down complex concepts
- Add helpful analogies
- Make it accessible to everyone
- Keep it clear and concise

Text: {text}

Simple explanation:`,
};

const TRANSLATION_PROMPT = `Translate the following text to {targetLanguage}. 
Maintain the tone, style, and meaning. Provide only the translation:

Text: {text}

Translation:`;

/**
 * Transform text using AI
 */
exports.transformText = async (req, res) => {
  try {
    const { text, action, context } = req.body;

    if (!text || !action) {
      return res.status(400).json({
        success: false,
        error: 'Text and action are required'
      });
    }

    const prompt = TRANSFORMATION_PROMPTS[action];
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });
    }

    const formattedPrompt = prompt.replace('{text}', text);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: formattedPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const transformedText = completion.choices[0].message.content.trim();

    res.json({
      success: true,
      transformedText,
      originalLength: text.length,
      newLength: transformedText.length,
      action
    });

  } catch (error) {
    console.error('Text transformation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transform text'
    });
  }
};

/**
 * Translate text to target language
 */
exports.translateText = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Text and target language are required'
      });
    }

    const prompt = TRANSLATION_PROMPT
      .replace('{text}', text)
      .replace('{targetLanguage}', targetLanguage);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const translatedText = completion.choices[0].message.content.trim();

    res.json({
      success: true,
      translatedText,
      originalText: text,
      targetLanguage,
      originalLength: text.length,
      newLength: translatedText.length
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to translate text'
    });
  }
};

/**
 * Get available transformation actions
 */
exports.getActions = async (req, res) => {
  try {
    const actions = Object.keys(TRANSFORMATION_PROMPTS).map(action => ({
      id: action,
      name: action.charAt(0).toUpperCase() + action.slice(1),
      description: getActionDescription(action)
    }));

    res.json({
      success: true,
      actions
    });

  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get actions'
    });
  }
};

function getActionDescription(action) {
  const descriptions = {
    rewrite: 'Make it clearer & more impactful',
    expand: 'Add detail & examples',
    shorten: 'Make it concise & punchy',
    professional: 'Business-ready & authoritative',
    casual: 'Friendly & conversational',
    powerful: 'Compelling & persuasive',
    explain: 'Easy to understand'
  };
  
  return descriptions[action] || 'Transform text';
}