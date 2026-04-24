import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { streamAsAttachment } from "@/server/services/download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a generated hairstyle photo back to the barber with a
 * `Content-Disposition: attachment` header so the browser triggers a
 * real download instead of opening the image inline (which is what a
 * plain <a download> would do for a cross-origin URL).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const variant = await db.styleVariant.findFirst({
      where: { id, analysis: { userId: user.id } },
      select: {
        imageUrl: true,
        styleName: true,
        analysis: { select: { client: { select: { name: true, clientNumber: true } } } },
      },
    });
    if (!variant) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const clientLabel =
      variant.analysis.client?.name ??
      (variant.analysis.client?.clientNumber != null
        ? `Cliente ${variant.analysis.client.clientNumber}`
        : "cliente");

    return streamAsAttachment(variant.imageUrl, `${clientLabel} - ${variant.styleName}`);
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/variants/:id/download]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
