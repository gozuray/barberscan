/**
 * Type contracts for the NanoBananaPRO API abstraction layer.
 *
 * These types reflect our application's domain model. The concrete
 * HTTP shape of the vendor API is encapsulated inside client.ts,
 * so swapping providers later only requires changing that one file.
 */

export type FaceAnalysisInput = {
  imageUrl: string;
};

export type FaceAnalysisResult = {
  faceShape: string;            // "Oval" | "Round" | "Square" | "Heart" | "Diamond" | "Oblong"
  hairType: string;             // "Straight / Thick" | "Wavy / Medium" | "Curly / Fine" | ...
  hairDensity: string;          // "Low" | "Medium" | "Medium - High" | "High"
  skinTone?: string;
  ageBracket?: string;
  raw?: unknown;                // preserved for forward-compat
};

export type HairstyleKey =
  | "textured_crop"
  | "mid_fade_quiff"
  | "side_part"
  | "brush_up"
  | "crew_cut"
  | "pompadour"
  | "messy_fringe"
  | "longer_wavy";

export type StyleGenerationInput = {
  imageUrl: string;
  styleKey: HairstyleKey;
  prompt: string;
  analysis?: FaceAnalysisResult; // helps the model stay consistent with the subject
};

export type StyleGenerationResult = {
  styleKey: HairstyleKey;
  imageUrl: string;              // hosted URL from provider (we re-pin to our storage)
  generationMs: number;
  raw?: unknown;
};

export class NanoBananaError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "NanoBananaError";
  }
}
