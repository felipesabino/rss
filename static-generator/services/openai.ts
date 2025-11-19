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
          content: "You are a skilled content summarizer. Create a concise summary of the provided text. Focus on the key points and main ideas. Regardless of the text's language, provide the summary in English. Output ONLY the summary text. Do not start with 'Summary:', 'Here is a summary', or dashes. Do not use conversational fillers."
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

    let summary = response.choices[0]?.message?.content || "Summary not available.";

    // Clean up the summary
    summary = summary.trim();

    // Remove "Summary:" or "Here is a summary:" prefixes (case insensitive)
    summary = summary.replace(/^(summary|here is a summary|this text is about|the text describes)[:\s-]*/i, "");

    // Remove leading dashes or bullets
    summary = summary.replace(/^[\s\-\*]+/, "");

    // Remove "what is this" type prefixes if they appear (though less likely with the new prompt)
    summary = summary.replace(/^what is this[:\s]*/i, "");

    return summary.trim();
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

export interface ReportItem {
  title: string;
  summary?: string;
  url: string;
  published: Date;
  sourceName: string;
  score?: number; // Optional score if we want to pass it
}

export async function generateCategoryReport(category: string, items: ReportItem[], customInstructions?: string): Promise<string> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. Skipping report generation.");
    return "";
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

  // Prepare the items for the prompt
  // We limit the number of items to avoid token limits, prioritizing those with summaries or recent ones
  // For now, let's take top 20 items

  // TODO: Define a strategy to score, rank and select the best items
  const topItems = items.slice(0, 20);

  const itemsText = topItems.map((item, index) => {
    const summaryText = item.summary ? `Summary: ${item.summary}` : "No summary available.";
    return `Item ${index + 1}:
Title: ${item.title}
Source: ${item.sourceName}
Date: ${item.published.toISOString()}
URL: ${item.url}
${summaryText}
---`;
  }).join("\n");

  // Static system prompt - heavily cached
  const systemPrompt = `You are a helpful assistant that generates newsletter-style reports.
You are writing a Morning Brew–style daily newsletter with a conversational, witty, high-density tone.
Style: short sentences/paragraphs, light humor, crisp headers, Markdown output.

Structure:
- HEADER: 1–3 lines playful intro/byline about this specific category.
- MAIN STORIES: Select the most impactful stories (1-3 stories). For each:
  - SECTION TAG (e.g., GEOPOLITICS, SECURITY, ECONOMY, SUPPLY CHAIN, AVIATION, ENERGY, ETC - make sure to adapt to and make it relevant to the category and content of the story).
  - Bold, punchy headline
  - Source name with a markdown link to the source URL
  - Subsections:
    - What Happened (facts).
    - Why It Matters (context and impact).
    - Short-Term Impact (weeks).
    - Long-Term Impact (6–24 months).
    - Sentiment: Positive/Negative/Mixed with 1-line rationale.
- WHAT ELSE IS GOING ON: 3-6 bullets, 1-2 sentences each, covering other interesting stories. Include the source name with a link to the source URL on each item.
- BY THE NUMBERS: one impactful number + witty commentary (if applicable data exists, otherwise skip).
- SIGN-OFF: playful 1–2 lines.

Rules:
- Prioritize higher signal stories.
- If a story has no summary, judge importance by title.
- Keep Markdown clean and readable.
- Do not use the terms "Morning Brew" or "Brew".
- Do not fabricate images or data.
- If there are not enough interesting stories, keep it shorter.`;



  // Dynamic user prompt - variable content at the end
  let userPrompt = `Category: "${category}"`;

  if (customInstructions) {
    userPrompt += `\n\nSPECIFIC INSTRUCTIONS FOR CATEGORY "${category}":\n${customInstructions}\n\nPlease prioritize these specific instructions over the general structure where they conflict.`;
  }

  userPrompt += `\n\nNews Items:\n${itemsText}`;

  try {
    console.log(`Generating report for category: ${category} with ${topItems.length} items...`);

    const modelName = process.env.OPENAI_REPORT_MODEL_NAME || process.env.OPENAI_MODEL_NAME || "gpt-4o";

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }, {
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    return response.choices[0]?.message?.content || "";
  } catch (error) {
    console.error(`Error generating report for category ${category}:`, error);
    return "";
  }
}
