import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@/lib/auth";
import { createSource, listSources } from "@/lib/data/sources";

const feedInputSchema = z
  .object({
    type: z.string().min(1),
    name: z.string().min(1),
    url: z.string().url().optional(),
    query: z.string().optional(),
    categories: z.array(z.string()).optional().default([]),
    language: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    (value) => Boolean(value.url || value.query),
    "Either url or query is required"
  );

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feeds = await listSources(session.user.id);
  return NextResponse.json(feeds);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = feedInputSchema.parse(body);
    const feed = await createSource(session.user.id, parsed);
    return NextResponse.json(feed, { status: 201 });
  } catch (error) {
    console.error("[feeds:POST]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create feed" }, { status: 500 });
  }
}
