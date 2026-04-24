import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createCheckoutSession } from "@/lib/stripe/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  priceId: z.string().min(1),
  trialDays: z.number().min(0).max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = BodySchema.parse(await req.json());

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      priceId: body.priceId,
      trialDays: body.trialDays,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", issues: err.issues }, { status: 400 });
    }
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[/api/billing/checkout]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
