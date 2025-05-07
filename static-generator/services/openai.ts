import OpenAI from "openai";
import { CONTENT_FILTERING_THEMES } from "../../config/constants";

export async function summarizeText(text: string): Promise<string> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. Skipping summarization.");
    return "Summary not available (API key not configured).";
  }

  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });


  const truncatedText = text.length > 50000 ? text.substring(0, 50000) : text;

  try {
    // Use a default model if not specified in environment variables
    const modelName = process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo";
    
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are a skilled content summarizer. Create a concise summary of the provided text. Focus on the key points and main ideas, and regardless of the text's language, provide the summary in english."
        },
        {
          role: "user",
          content: truncatedText,
        },
      ],
    }, {
      // 15 minutes
      timeout: 15 * 60 * 1000,
      maxRetries: 3
    });

    return response.choices[0]?.message?.content || "Summary not available.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Error generating summary.";
  }
}


export async function analyzeSentiment(text: string): Promise<boolean> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. Skipping sentiment analysis.");
    return false; // Default to not positive when API key is missing
  }

  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

  const truncatedText = text.length > 50000 ? text.substring(0, 50000) : text;

  try {
    console.log(`Analyzing sentiment for text (length: ${truncatedText.length})`);
    
    // Use the specified model or fall back to the summary model or a default if not available
    const modelName = process.env.OPENAI_SENTIMENT_MODEL_NAME || process.env.OPENAI_MODEL_NAME || "gpt-3.5-turbo";
    
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `You are a sentiment analyzer. Determine if the provided content has a positive/uplifting sentiment. Respond ONLY with 'true' for positive/uplifting content or 'false' for negative/neutral content. Do not include any explanation or additional text in your response. Automatically flag as negative if the content is related to any of the following themes: ${CONTENT_FILTERING_THEMES.join(", ")}.`
        },
        {
          role: "user",
          content: truncatedText,
        },
      ],
    }, {
      // 5 minutes
      timeout: 5 * 60 * 1000,
      maxRetries: 2
    });

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    console.log(`Sentiment analysis result: "${result}"`);
    
    // Handle various possible responses
    if (result === 'true' || result === '"true"') {
      return true;
    } else if (result === 'false' || result === '"false"') {
      return false;
    } else if (result && (result.includes('true') || result.includes('positive') || result.includes('uplifting'))) {
      console.log(`Interpreting as positive: "${result}"`);
      return true;
    } else {
      console.log(`Interpreting as not positive: "${result}"`);
      return false;
    }
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return false; // Default to not positive if there's an error
  }
}
