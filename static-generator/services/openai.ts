import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CONTENT_FILTERING_THEMES } from "../../config/constants";

// Schema for Item Analysis
export const ItemAnalysisSchema = z.object({
  summary: z.string().describe("A concise summary of the text, focusing on key points and main ideas."),
  isPositive: z.boolean().describe("True if the content has a positive/uplifting sentiment, false otherwise."),
});

export type ItemAnalysis = z.infer<typeof ItemAnalysisSchema>;

// Schema for Category Report
export const ReportSchema = z.object({
  header: z.string().describe("1–3 lines playful intro/byline about this specific category."),
  mainStories: z.array(z.object({
    sectionTag: z.string().describe("A relevant tag for the story (e.g., GEOPOLITICS, ECONOMY)."),
    headline: z.string().describe("Bold, punchy headline."),
    sourceName: z.string(),
    sourceUrl: z.string(),
    whatHappened: z.string().describe("Facts about what happened."),
    whyItMatters: z.string().describe("Context and impact."),
    shortTermImpact: z.string().describe("Short-term impact (weeks)."),
    longTermImpact: z.string().describe("Long-term impact (6–24 months)."),
    sentiment: z.enum(['Positive', 'Negative', 'Mixed']),
    sentimentRationale: z.string().describe("1-line rationale for the sentiment."),
  })).describe("Select the most impactful stories (1-3 stories)."),
  whatElseIsGoingOn: z.array(z.object({
    text: z.string().describe("1-2 sentences covering the story."),
    sourceName: z.string(),
    sourceUrl: z.string(),
  })).describe("3-6 bullets covering other interesting stories."),
  byTheNumbers: z.object({
    number: z.string(),
    commentary: z.string(),
  }).optional().describe("One impactful number + witty commentary (if applicable data exists)."),
  signOff: z.string().describe("Playful 1–2 lines sign-off."),
});

export type Report = z.infer<typeof ReportSchema>;

export async function analyzeItem(text: string, title: string): Promise<ItemAnalysis> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. Skipping analysis.");
    return { summary: "Summary not available (API key not configured).", isPositive: false };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

  const truncatedText = text.length > 50000 ? text.substring(0, 50000) : text;
  const textToAnalyze = truncatedText.length > 200 ? truncatedText : `Title: ${title}\nContent: ${truncatedText}`;

  try {
    const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o-2024-08-06"; // Use a model that supports structured outputs reliably

    const response = await openai.beta.chat.completions.parse({
      model: modelName,
      messages: [
        {
          role: "system",
          content: `You are a skilled content analyst. 
          1. Summarize the provided text concisely in English.
          2. Analyze the sentiment. Return 'isPositive' as true ONLY if the content is genuinely positive/uplifting. 
          Automatically flag as negative (isPositive: false) if the content is related to: ${CONTENT_FILTERING_THEMES.join(", ")}.`
        },
        {
          role: "user",
          content: textToAnalyze,
        },
      ],
      response_format: zodResponseFormat(ItemAnalysisSchema, "item_analysis"),
    }, {
      timeout: 15 * 60 * 1000, // 15 minutes
      maxRetries: 3
    });

    const result = response.choices[0]?.message?.parsed;

    if (!result) {
      throw new Error("Failed to parse structured output");
    }

    return result;
  } catch (error) {
    console.error("Error analyzing item:", error);
    return { summary: "Error generating summary.", isPositive: false };
  }
}

export interface ReportItem {
  title: string;
  summary?: string;
  url: string;
  published: Date;
  sourceName: string;
  score?: number;
}

export async function generateCategoryReport(category: string, items: ReportItem[], customInstructions?: string): Promise<Report | null> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not set. Skipping report generation.");
    return null;
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

  // Limit items
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

  const systemPrompt = `You are a helpful assistant that generates newsletter-style reports.
You are writing a Morning Brew–style daily newsletter with a conversational, witty, high-density tone.
Style: short sentences/paragraphs, light humor, crisp headers.

Structure requirements are defined in the output schema.
- MAIN STORIES: Select the most impactful stories (1-3 stories).
- WHAT ELSE IS GOING ON: 3-6 bullets covering other interesting stories.
- BY THE NUMBERS: one impactful number + witty commentary (if applicable data exists).
- SIGN-OFF: playful 1–2 lines.

Rules:
- Prioritize higher signal stories.
- If a story has no summary, judge importance by title.
- Do not use the terms "Morning Brew" or "Brew".
- Do not fabricate images or data.
- If there are not enough interesting stories, keep it shorter.`;

  let userPrompt = `Category: "${category}"`;

  if (customInstructions) {
    userPrompt += `\n\nSPECIFIC INSTRUCTIONS FOR CATEGORY "${category}":\n${customInstructions}\n\nPlease prioritize these specific instructions over the general structure where they conflict.`;
  }

  userPrompt += `\n\nNews Items:\n${itemsText}`;

  try {
    console.log(`Generating report for category: ${category} with ${topItems.length} items...`);

    const modelName = process.env.OPENAI_REPORT_MODEL_NAME || process.env.OPENAI_MODEL_NAME || "gpt-4o-2024-08-06";

    const response = await openai.beta.chat.completions.parse({
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
      response_format: zodResponseFormat(ReportSchema, "category_report"),
    }, {
      timeout: 5 * 60 * 1000, // 5 minutes
    });

    const result = response.choices[0]?.message?.parsed;
    return result || null;
  } catch (error) {
    console.error(`Error generating report for category ${category}:`, error);
    return null;
  }
}
