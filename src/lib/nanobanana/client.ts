import { openaiProvider } from "@/lib/ai/providers/openai";
import { generateNanoBananaProImage } from "@/lib/nanobanana/bananapro-gateway";
import {
  type FaceAnalysisInput,
  type FaceAnalysisResult,
  type StyleGenerationInput,
  type StyleGenerationResult,
} from "./types";

/**
 * NanoBananaPRO HTTP client.
 *
 * Responsibilities:
 *  - single source of truth for Nano Banana Pro gateway calls
 *  - uniform error type (NanoBananaError) for upstream callers
 *
 * Swap this file to change provider. All upstream code depends
 * only on the exported functions, not the vendor response shape.
 */

// ─────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────

export async function analyzeFace(
  input: FaceAnalysisInput,
): Promise<FaceAnalysisResult> {
  // The public Nano Banana Pro gateway (bananapro.site) documents image generation,
  // but does not expose the legacy `/analyze/face` endpoint used by older builds.
  //
  // For local/dev parity, we prefer OpenAI vision analysis when configured, and
  // fall back to safe defaults otherwise.
  if (process.env.OPENAI_API_KEY) {
    return openaiProvider.analyzeFace(input);
  }

  return {
    faceShape: "Oval",
    hairType: "Straight / Medium",
    hairDensity: "Medium",
    skinTone: undefined,
    ageBracket: undefined,
    raw: {
      note:
        "Fallback analysis: configure OPENAI_API_KEY for real vision analysis, or implement a dedicated Nano Banana analysis endpoint.",
    },
  };
}

export async function generateHairstyle(
  input: StyleGenerationInput,
): Promise<StyleGenerationResult> {
  const start = Date.now();
  const aspectRatio = input.aspectRatio ?? "9:16";

  const generated = await generateNanoBananaProImage({
    prompt: input.prompt,
    imageUrl: input.imageUrl,
    aspectRatio,
    resolution: "2K",
  });

  return {
    styleKey: input.styleKey,
    imageUrl: generated.imageUrl,
    generationMs: Date.now() - start,
    raw: generated.raw,
  };
}

export const nanobanana = {
  analyzeFace,
  generateHairstyle,
};
