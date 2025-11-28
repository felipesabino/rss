export const prerender = false;

import { z } from "zod";

import { requireUser } from "../../../lib/auth";
import { deleteSource, getSourceById, updateSource } from "../../../lib/data/sources";

const feedUpdateSchema = z.object({
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  query: z.string().optional(),
  categories: z.array(z.string()).optional(),
  language: z.string().optional(),
  isActive: z.boolean().optional(),
});

type Context = {
  params: { id: string };
};

export async function GET({ params }: Context) {
  const session = await requireUser();
  if (!session.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const feed = await getSourceById(session.user.id, params.id);
  if (!feed) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(feed), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH({ request, params }: Context & { request: Request }) {
  const session = await requireUser();
  if (!session.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const parsed = feedUpdateSchema.parse(body);
    const feed = await updateSource(session.user.id, params.id, parsed);
    return new Response(JSON.stringify(feed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[feeds/:id:PATCH]", error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Unable to update feed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE({ params }: Context) {
  const session = await requireUser();
  if (!session.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const success = await deleteSource(session.user.id, params.id);
    if (!success) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[feeds/:id:DELETE]", error);
    return new Response(JSON.stringify({ error: "Unable to delete feed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
