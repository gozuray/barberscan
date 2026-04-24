import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { streamAsAttachment } from "@/server/services/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public download endpoint resolved by share token.
 * Anyone with a valid token may download that single photo.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;
    if (!token) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const variant = await db.styleVariant.findUnique({
      where: { shareToken: token },
      select: { imageUrl: true, styleName: true },
    });
    if (!variant) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return streamAsAttachment(variant.imageUrl, `BarberScan - ${variant.styleName}`);
  } catch (err) {
    console.error("[GET /api/share/:token/download]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
