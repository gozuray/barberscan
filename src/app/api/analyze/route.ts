import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assertQuotaAvailable } from "@/lib/auth/quota";
import { analyzeRateLimit } from "@/lib/ratelimit";
import { startAnalysis } from "@/server/services/analysis-service";
import { DEFAULT_STYLE_KEYS } from "@/lib/nanobanana/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  imageUrl: z.string().url(),
  imageKey: z.string().optional(),
  clientId: z.string().optional(),
  styleKeys: z
    .array(
      z.enum([
        "textured_crop",
        "mid_fade_quiff",
        "side_part",
        "brush_up",
        "crew_cut",
        "pompadour",
        "messy_fringe",
        "longer_wavy",
      ]),
    )
    .optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const rl = await analyzeRateLimit.limit(user.id);
    if (!rl.success) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    await assertQuotaAvailable(user);

    const body = BodySchema.parse(await req.json());

    const analysis = await startAnalysis({
      userId: user.id,
      originalUrl: body.imageUrl,
      originalKey: body.imageKey,
      clientId: body.clientId,
      shopId: user.shopId ?? undefined,
      styleKeys: body.styleKeys ?? DEFAULT_STYLE_KEYS,
    });

    return NextResponse.json({ id: analysis.id, status: analysis.status });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", issues: err.issues }, { status: 400 });
    }
    const code = (err as Error & { code?: string }).code;
    if (code === "QUOTA_EXCEEDED") {
      return NextResponse.json(
        { error: "quota_exceeded", message: "You've reached your plan's monthly analysis limit." },
        { status: 402 },
      );
    }
    if ((err as Error).message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    console.error("[/api/analyze]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
