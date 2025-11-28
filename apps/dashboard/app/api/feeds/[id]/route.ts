import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerSession } from "@/lib/auth";
import { deleteSource, getSourceById, updateSource } from "@/lib/data/sources";

const feedUpdateSchema = z.object({
  type: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  query: z.string().optional(),
  categories: z.array(z.string()).optional(),
  language: z.string().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = {
  params: { id: string };
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feed = await getSourceById(session.user.id, context.params.id);
  if (!feed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(feed);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = feedUpdateSchema.parse(body);
    const feed = await updateSource(session.user.id, context.params.id, parsed);
    return NextResponse.json(feed);
  } catch (error) {
    console.error("[feeds/:id:PATCH]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update feed" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const success = await deleteSource(session.user.id, context.params.id);
    if (!success) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[feeds/:id:DELETE]", error);
    return NextResponse.json({ error: "Unable to delete feed" }, { status: 500 });
  }
}
