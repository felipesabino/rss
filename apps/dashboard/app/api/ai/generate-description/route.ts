import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@/lib/auth";

const payloadSchema = z.object({
  prompt: z.string().min(5),
  type: z.enum(["feed", "report"]).optional().default("feed"),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const body = payloadSchema.parse(json);

    // Deterministic, local suggestion to keep the API usable without external calls.
    const suggestion =
      body.type === "report"
        ? `A concise overview for ${body.prompt} highlighting top trends and risks.`
        : `Curated updates about ${body.prompt}, focusing on reputable sources and clear summaries.`;

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("[ai/generate-description]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}
