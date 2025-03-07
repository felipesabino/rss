import OpenAI from "openai";

export async function summarizeText(text: string): Promise<string> {

  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL
  });

  const truncatedText = text.length > 50000 ? text.substring(0, 50000) : text;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL_NAME,
      messages: [
        {
          role: "system",
          content: "You are a skilled content summarizer. Create a concise summary of the provided text. Focus on the key points and main ideas."
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