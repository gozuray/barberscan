import { db } from "@/lib/db";
import {
  analyzeFace,
  generateHairstyle,
} from "@/lib/nanobanana/client";
import { STYLE_CATALOG, buildPrompt, DEFAULT_STYLE_KEYS } from "@/lib/nanobanana/prompts";
import type { HairstyleKey, FaceAnalysisResult } from "@/lib/nanobanana/types";
import { SuitabilityTag, type Analysis } from "@prisma/client";

type StartInput = {
  userId: string;
  originalUrl: string;
  originalKey?: string;
  clientId?: string;
  shopId?: string;
  styleKeys?: HairstyleKey[];
};

/**
 * Creates a new analysis row and kicks off the generation pipeline.
 * The pipeline runs in the same request for simplicity, but is designed
 * so it can be moved to a background worker (Inngest/QStash/Trigger.dev)
 * without changing the callers — just replace `runPipeline` with an enqueue.
 */
export async function startAnalysis(input: StartInput): Promise<Analysis> {
  const analysis = await db.analysis.create({
    data: {
      userId: input.userId,
      originalUrl: input.originalUrl,
      originalKey: input.originalKey,
      clientId: input.clientId,
      shopId: input.shopId,
      status: "PENDING",
    },
  });

  await db.usageEvent.create({
    data: { userId: input.userId, kind: "ANALYSIS_CREATED" },
  });

  // Fire-and-forget (caller should `await` only if they want to block).
  // In production, swap for: await enqueuePipeline(analysis.id)
  runPipeline(analysis.id, input.styleKeys ?? DEFAULT_STYLE_KEYS).catch(async (err) => {
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

async function runPipeline(analysisId: string, styleKeys: HairstyleKey[]) {
  const analysis = await db.analysis.update({
    where: { id: analysisId },
    data: { status: "PROCESSING" },
  });

  // 1. Face & hair insights
  const insights = await analyzeFace({ imageUrl: analysis.originalUrl });

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
    const prompt = buildPrompt(styleKey, insights);
    const gen = await generateHairstyle({
      imageUrl: analysis.originalUrl,
      styleKey,
      prompt,
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
