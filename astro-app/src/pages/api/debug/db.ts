export const prerender = false;

import { prisma } from "../../../lib/db";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(JSON.stringify({ error: "Not available" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const userCount = await prisma.user.count();
    return new Response(JSON.stringify({ ok: true, userCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[debug-db-check]", error);
    return new Response(JSON.stringify({ ok: false, error: "Database check failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
