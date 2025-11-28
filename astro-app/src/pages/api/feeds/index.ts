export const prerender = false;

import { z } from "zod";

import { requireUser } from "../../../lib/auth";
import { createSource, listSources } from "../../../lib/data/sources";

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
  const session = await requireUser();
  if (!session.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const feeds = await listSources(session.user.id);
  return new Response(JSON.stringify(feeds), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  const session = await requireUser();
  if (!session.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const parsed = feedInputSchema.parse(body);
    const feed = await createSource(session.user.id, parsed);
    return new Response(JSON.stringify(feed), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[feeds:POST]", error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Unable to create feed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
