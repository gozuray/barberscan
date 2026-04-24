import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createBillingPortalSession } from "@/lib/stripe/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireUser();
    const portal = await createBillingPortalSession(user.id);
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[/api/billing/portal]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
