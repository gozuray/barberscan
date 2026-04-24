import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
});

/**
 * Rename a client. Only the owning barber can mutate.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = PatchSchema.parse(await req.json());

    const existing = await db.client.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const updated = await db.client.update({
      where: { id },
      data: { name: body.name },
    });
    return NextResponse.json({ id: updated.id, name: updated.name });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", issues: err.issues }, { status: 400 });
    }
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[PATCH /api/clients/:id]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/**
 * Delete a client and their associated analyses (cascade deletes variants).
 * Files in UploadThing are intentionally *not* removed — only the app-level
 * records are purged. The client number is not reused.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const existing = await db.client.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

    await db.$transaction([
      db.analysis.deleteMany({ where: { clientId: id, userId: user.id } }),
      db.client.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[DELETE /api/clients/:id]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
