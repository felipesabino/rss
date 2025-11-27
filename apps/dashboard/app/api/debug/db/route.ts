import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const userCount = await prisma.user.count();
    return NextResponse.json({ ok: true, userCount });
  } catch (error) {
    console.error("[debug-db-check]", error);
    return NextResponse.json(
      { ok: false, error: "Database check failed" },
      { status: 500 }
    );
  }
}
