export const prerender = false;

import { z } from "zod";

import { requireUser } from "../../../lib/auth";

const payloadSchema = z.object({
  prompt: z.string().min(5),
  type: z.enum(["feed", "report"]).optional().default("feed"),
});

export async function POST({ request }: { request: Request }) {
  await requireUser();

  try {
    const json = await request.json();
    const body = payloadSchema.parse(json);

    const suggestion =
      body.type === "report"
        ? `A concise overview for ${body.prompt} highlighting top trends and risks.`
        : `Curated updates about ${body.prompt}, focusing on reputable sources and clear summaries.`;

    return new Response(JSON.stringify({ suggestion }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ai/generate-description]", error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Failed to generate suggestion" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
