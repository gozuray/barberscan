import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mirror Clerk's user lifecycle into our `User` table so we can foreign-key
 * against a stable `userId`, independent of Clerk.
 */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "missing_secret" }, { status: 400 });

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = new Webhook(secret).verify(payload, headers) as typeof evt;
  } catch (err) {
    console.error("[clerk/webhook] bad signature", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const data = evt.data as {
    id: string;
    email_addresses?: { id: string; email_address: string }[];
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
  const email =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses?.[0]?.email_address;

  try {
    if (evt.type === "user.created" || evt.type === "user.updated") {
      if (!email) return NextResponse.json({ ok: true });
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      await db.user.upsert({
        where: { clerkId: data.id },
        create: {
          clerkId: data.id,
          email,
          name,
          imageUrl: data.image_url,
          subscription: { create: { tier: "FREE", status: "TRIALING" } },
        },
        update: { email, name, imageUrl: data.image_url },
      });
    } else if (evt.type === "user.deleted") {
      await db.user.deleteMany({ where: { clerkId: data.id } });
    }
  } catch (err) {
    console.error("[clerk/webhook] processing error", err);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
