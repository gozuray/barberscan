import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newShareToken() {
  return randomBytes(18).toString("base64url");
}

/**
 * Returns a shareable public URL for a given style variant.
 * Lazily provisions a token the first time it's requested.
 * Only the barber who owns the parent analysis may generate/read the link.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const variant = await db.styleVariant.findFirst({
      where: { id, analysis: { userId: user.id } },
      select: { id: true, shareToken: true },
    });
    if (!variant) return NextResponse.json({ error: "not_found" }, { status: 404 });

    let token = variant.shareToken;
    if (!token) {
      token = newShareToken();
      await db.styleVariant.update({ where: { id }, data: { shareToken: token } });
    }

    return NextResponse.json({ url: absoluteUrl(`/share/${token}`), token });
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/variants/:id/share]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
