import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Elite AI prompts for deadly precise text transformations
const TRANSFORMATION_PROMPTS = {
  rewrite: `You are an elite writing coach. Rewrite this text to be:
- Clearer and more impactful
- Better structured and flowing
- More engaging and memorable
- Grammatically perfect
- Maintain the original meaning and tone

Text to rewrite:`,

  expand: `You are a master content creator. Expand this text by:
- Adding rich, relevant details
- Including concrete examples
- Providing deeper context
- Making it more comprehensive
- Keep the same style and voice

Text to expand:`,

  shorten: `You are an expert editor. Make this text concise by:
- Removing unnecessary words
- Keeping all key points
- Maintaining clarity and impact
- Preserving the original meaning
- Making every word count

Text to shorten:`,

  professional: `Transform this text to sound:
- Highly professional and authoritative
- Confident and credible
- Appropriate for business contexts
- Polished and sophisticated
- Error-free and precise

Text to make professional:`,

  casual: `Rewrite this text to be:
- Friendly and conversational
- Approachable and relatable
- Natural and easy-going
- Warm and personable
- Still clear and effective

Text to make casual:`,

  powerful: `Rewrite this to be incredibly persuasive:
- Use power words and strong language
- Create emotional impact
- Build compelling arguments
- Make it memorable and quotable
- Drive action and engagement

Text to make powerful:`,

  translate: `Translate this text accurately to {targetLanguage}:
- Maintain the original meaning and tone
- Use natural, fluent language
- Preserve any formatting or structure
- Ensure cultural appropriateness
- Keep the same level of formality

Text to translate:`,
};

const transformText = async (req, res) => {
  try {
    const { text, action, targetLanguage } = req.body;

    if (!text || !action) {
      return res.status(400).json({ 
        error: 'Text and action are required' 
      });
    }

    if (!TRANSFORMATION_PROMPTS[action]) {
      return res.status(400).json({ 
        error: 'Invalid action. Supported actions: rewrite, expand, shorten, professional, casual, powerful, translate' 
      });
    }

    let prompt = TRANSFORMATION_PROMPTS[action];
    
    // Handle translation with target language
    if (action === 'translate') {
      if (!targetLanguage) {
        return res.status(400).json({ 
          error: 'Target language is required for translation' 
        });
      }
      prompt = prompt.replace('{targetLanguage}', targetLanguage);
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const transformedText = completion.choices[0].message.content.trim();

    res.json({
      success: true,
      transformedText,
      originalText: text,
      action,
      targetLanguage: targetLanguage || null,
    });

  } catch (error) {
    console.error('Text transformation error:', error);
    res.status(500).json({
      error: 'Failed to transform text',
      details: error.message,
    });
  }
};

// Add missing functions for the route
const translateText = async (req, res) => {
  req.body.action = 'translate';
  return transformText(req, res);
};

const getLanguages = async (req, res) => {
  res.json({
    languages: [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' },
    ]
  });
};

export {
  transformText,
  translateText,
  getLanguages,
};