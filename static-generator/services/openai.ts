import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CONTENT_FILTERING_THEMES } from "../../config/constants";

// Schema for Item Analysis
export const ItemAnalysisSchema = z.object({
  summary: z.string().describe("A concise summary of the text, focusing on key points and main ideas."),
  eli5: z.string().describe("Explain like I'm five: a 1-2 line ultra-simple recap."),
  sentiment: z.enum(['Positive', 'Negative', 'Mixed']).describe("Overall sentiment classification across the content."),
  tags: z.array(
    z.string().describe("Single-word topic tag (e.g., cloud, chips, earnings).")
  ).min(2).max(3).describe("2-3 short, single-word tags capturing the core themes."),
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
    return { summary: "Summary not available (API key not configured).", eli5: "Summary not available.", sentiment: 'Mixed', tags: [] };
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
          content: `You are an expert tech editor and summarizer, similar to the engine behind "WhatHappened.tech". Your goal is to extract the core value from a webpage's HTML content and present it in three distinct, easy-to-digest formats.
**Input:**
I will provide you with the raw HTML content of a webpage.
**Instructions:**
1.  **Parse & Clean:** Ignore HTML boilerplate, scripts, styles, navigation bars, footers, and advertisements. Focus strictly on the main article body or the primary discussion text.
2.  **Analyze:** Identify the central thesis, key technical details, and the "so what?" factor of the content.
3.  **Generate Output:** Create a response with the following three clearly labeled sections:
  * **## Summary**
      A professional, objective paragraph (approx. 3-5 sentences) that summarizes the article. Imagine this as the opening abstract for a busy executive or senior engineer. Mention specific technologies, companies, or people involved.
  * **## TL;DR (Too Long; Didn't Read)**
      Provide 3-5 concise bullet points. These should be "skimmable" takeaways that cover the most important facts, stats, or arguments.
      * *Style:* Direct, factual, and high-signal.
  * **## ELI5 (Explain Like I'm 5)**
      A short, simplified explanation of the topic. Use an analogy if helpful. Avoid jargon completely. Explain *why* this matters in the simplest terms possible.
      * *Style:* Conversational and educational.
4. Classify sentiment as Positive, Negative, or Mixed. Automatically flag as Negative if the content is related to: ${CONTENT_FILTERING_THEMES.join(", ")}.
5. Produce 2-3 short, single-word tags that capture the primary topics. Keep them simple and avoid punctuation. Be generic to reflect broad themes (e.g. use Finance instead of FinTech, Debt, etc). Use Title Case for the tags, and correct capitalization for proper nouns (e.g. use AWS instead of aws, AI instead of ai).
**Constraints:**
* If the HTML content is empty or unreadable, state: "Content could not be extracted."
* Do not hallucinate facts not present in the text.
* Keep the tone neutral and informative.`,
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

    const sentiment = result.sentiment || 'Mixed';
    return { ...result, sentiment, tags: result.tags || [] };
  } catch (error) {
    console.error("Error analyzing item:", error);
    return { summary: "Error generating summary.", eli5: "ELI5 unavailable.", sentiment: 'Mixed', tags: [] };
  }
}

export const REPORT_ITEM_LIMIT = 20;

export interface ReportItem {
  title: string;
  summary?: string;
  url: string;
  published: Date;
  sourceName: string;
  score?: number;
  sourceItemId?: number;
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
  const topItems = items.slice(0, REPORT_ITEM_LIMIT);

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
