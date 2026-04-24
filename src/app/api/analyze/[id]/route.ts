import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const analysis = await db.analysis.findFirst({
      where: { id, userId: user.id },
      include: { variants: { orderBy: { matchScore: "desc" } } },
    });

    if (!analysis) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(analysis);
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[/api/analyze/:id]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
