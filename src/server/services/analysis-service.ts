import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai";
import { STYLE_CATALOG, buildPrompt, DEFAULT_STYLE_KEYS } from "@/lib/nanobanana/prompts";
import {
  DEFAULT_OUTPUT_ASPECT_RATIO,
  type FaceAnalysisResult,
  type HairstyleKey,
  type OutputAspectRatio,
} from "@/lib/nanobanana/types";
import { USE_CUSTOM_PROMPT } from "@/lib/dev-mode";
import { CUSTOM_HAIRSTYLE_PROMPT, CUSTOM_STYLE_NAME } from "@/lib/ai/custom-prompt";
import { SuitabilityTag, type Analysis, type Client } from "@prisma/client";

type StartInput = {
  userId: string;
  originalUrl: string;
  originalKey?: string;
  clientId?: string;
  shopId?: string;
  styleKeys?: HairstyleKey[];
  /** AI provider override — otherwise uses `AI_PROVIDER` env or default. */
  providerId?: string;
  aspectRatio?: OutputAspectRatio;
};

/**
 * Atomically allocates the next sequential client number for a barber and
 * creates a default-named Client ("Cliente N"). The counter is monotonic:
 * deleting a client never reuses its number.
 */
async function allocateDefaultClient(
  userId: string,
  shopId?: string,
): Promise<Client> {
  const { clientCounter } = await db.user.update({
    where: { id: userId },
    data: { clientCounter: { increment: 1 } },
    select: { clientCounter: true },
  });

  return db.client.create({
    data: {
      userId,
      shopId,
      clientNumber: clientCounter,
      name: `Cliente ${clientCounter}`,
    },
  });
}

/**
 * Creates a new analysis row and kicks off the generation pipeline.
 * The pipeline runs in the same request for simplicity, but is designed
 * so it can be moved to a background worker (Inngest/QStash/Trigger.dev)
 * without changing the callers — just replace `runPipeline` with an enqueue.
 *
 * If no `clientId` is provided, a new default-named Client is allocated so
 * every analysis always lives inside a client entry in the barber's gallery.
 */
export async function startAnalysis(input: StartInput): Promise<Analysis> {
  let clientId = input.clientId;
  if (!clientId) {
    const created = await allocateDefaultClient(input.userId, input.shopId);
    clientId = created.id;
  }

  const provider = getProvider(input.providerId);
  const aspectRatio = input.aspectRatio ?? DEFAULT_OUTPUT_ASPECT_RATIO;

  const analysis = await db.analysis.create({
    data: {
      userId: input.userId,
      originalUrl: input.originalUrl,
      originalKey: input.originalKey,
      clientId,
      shopId: input.shopId,
      status: "PENDING",
      aiProvider: provider.id,
      aspectRatio,
    },
  });

  await db.usageEvent.create({
    data: {
      userId: input.userId,
      kind: "ANALYSIS_CREATED",
      metadata: { providerId: provider.id, aspectRatio },
    },
  });

  // Fire-and-forget (caller should `await` only if they want to block).
  // In production, swap for: await enqueuePipeline(analysis.id)
  runPipeline(analysis.id, input.styleKeys ?? DEFAULT_STYLE_KEYS, {
    providerId: provider.id,
    aspectRatio,
  }).catch(async (err) => {
    console.error("[analysis-pipeline] failed", { id: analysis.id, err });
    await db.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "unknown_error",
      },
    });
  });

  return analysis;
}

type PipelineOptions = {
  providerId: string;
  aspectRatio: OutputAspectRatio;
};

async function runPipeline(
  analysisId: string,
  styleKeys: HairstyleKey[],
  options: PipelineOptions,
) {
  const provider = getProvider(options.providerId);

  const analysis = await db.analysis.update({
    where: { id: analysisId },
    data: { status: "PROCESSING" },
  });

  // ── TEST MODE ───────────────────────────────────────────────────────────
  // When `AI_USE_CUSTOM_PROMPT=true`, skip the 8-style loop and face-analysis
  // call entirely: send exactly one image-generation request using the prompt
  // from `src/lib/ai/custom-prompt.ts`. Lets you iterate quickly on wording
  // and see the raw model output in the app.
  if (USE_CUSTOM_PROMPT) {
    const started = Date.now();
    const gen = await provider.generateHairstyle({
      imageUrl: analysis.originalUrl,
      styleKey: "textured_crop",
      prompt: CUSTOM_HAIRSTYLE_PROMPT,
      aspectRatio: options.aspectRatio,
    });

    const variant = await db.styleVariant.create({
      data: {
        analysisId,
        styleKey: "textured_crop",
        styleName: CUSTOM_STYLE_NAME,
        imageUrl: gen.imageUrl,
        matchScore: 100,
        suitability: "BEST_MATCH",
        explanation: "Custom test prompt output.",
        promptUsed: CUSTOM_HAIRSTYLE_PROMPT,
        generationMs: gen.generationMs ?? Date.now() - started,
      },
    });

    await db.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        bestMatchIds: [variant.id],
      },
    });

    await db.usageEvent.create({
      data: { userId: analysis.userId, kind: "STYLE_GENERATED" },
    });

    return;
  }

  // 1. Face & hair insights
  const insights = await provider.analyzeFace({ imageUrl: analysis.originalUrl });

  await db.analysis.update({
    where: { id: analysisId },
    data: {
      faceShape: insights.faceShape,
      hairType: insights.hairType,
      hairDensity: insights.hairDensity,
      skinTone: insights.skinTone,
      insightsJson: (insights.raw as object) ?? undefined,
    },
  });

  // 2. Generate all hairstyle variants in parallel (with bounded concurrency)
  const results = await mapWithConcurrency(styleKeys, 3, async (styleKey) => {
    const def = STYLE_CATALOG[styleKey];
    const prompt = buildPrompt(styleKey, insights, options.aspectRatio);
    const gen = await provider.generateHairstyle({
      imageUrl: analysis.originalUrl,
      styleKey,
      prompt,
      aspectRatio: options.aspectRatio,
      analysis: insights,
    });

    const { score, tag, explanation } = scoreStyleForFace(styleKey, insights);

    return db.styleVariant.create({
      data: {
        analysisId,
        styleKey,
        styleName: def.name,
        imageUrl: gen.imageUrl,
        matchScore: score,
        suitability: tag,
        explanation,
        promptUsed: prompt,
        generationMs: gen.generationMs,
      },
    });
  });

  const bestMatchIds = results
    .filter((v) => v.suitability === "BEST_MATCH")
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map((v) => v.id);

  await db.analysis.update({
    where: { id: analysisId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      bestMatchIds,
    },
  });

  await Promise.all(
    results.map(() =>
      db.usageEvent.create({
        data: { userId: analysis.userId, kind: "STYLE_GENERATED" },
      }),
    ),
  );
}

// ─────────────────────────────────────────────────────────
//  Scoring heuristic — combines face-shape fit + hair density
//  This is intentionally deterministic so the UI remains stable.
// ─────────────────────────────────────────────────────────

function scoreStyleForFace(
  key: HairstyleKey,
  insights: FaceAnalysisResult,
): { score: number; tag: SuitabilityTag; explanation: string } {
  const def = STYLE_CATALOG[key];
  const faceShape = insights.faceShape ?? "Oval";
  const density = (insights.hairDensity ?? "Medium").toLowerCase();

  const shapeFit = def.idealFaceShapes.includes(faceShape) ? 1 : 0.45;
  const densityBoost = density.includes("high") ? 0.08 : density.includes("low") ? -0.05 : 0.03;

  // Stable pseudo-randomness per style so results feel real but consistent.
  const seed = hash(`${key}:${faceShape}:${insights.hairType}`);
  const wobble = ((seed % 17) - 8) / 100;

  const raw = Math.max(0.25, Math.min(0.99, 0.55 + shapeFit * 0.35 + densityBoost + wobble));
  const score = Math.round(raw * 100);

  let tag: SuitabilityTag;
  if (score >= 85) tag = "BEST_MATCH";
  else if (score >= 72) tag = "GOOD_MATCH";
  else if (score >= 58) tag = "NEUTRAL";
  else tag = "NOT_IDEAL";

  const explanation = buildExplanation(def.name, faceShape, tag, insights);
  return { score, tag, explanation };
}

function buildExplanation(
  styleName: string,
  faceShape: string,
  tag: SuitabilityTag,
  insights: FaceAnalysisResult,
) {
  switch (tag) {
    case "BEST_MATCH":
      return `${styleName} complements a ${faceShape.toLowerCase()} face and works beautifully with ${insights.hairType.toLowerCase()} hair.`;
    case "GOOD_MATCH":
      return `${styleName} is a strong option for a ${faceShape.toLowerCase()} face; will flatter the subject's proportions.`;
    case "NEUTRAL":
      return `${styleName} is workable on a ${faceShape.toLowerCase()} face, but other styles may flatter the features more.`;
    default:
      return `${styleName} is not ideal for a ${faceShape.toLowerCase()} face shape — consider a recommended style instead.`;
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
