/**
 * Provider-agnostic AI types. Each concrete provider (NanoBananaPRO,
 * OpenAI, etc.) must conform to the `AIProvider` interface so we can
 * A/B test them without touching the analysis pipeline.
 */

export type {
  FaceAnalysisInput,
  FaceAnalysisResult,
  StyleGenerationInput,
  StyleGenerationResult,
  HairstyleKey,
  OutputAspectRatio,
} from "@/lib/nanobanana/types";

import type {
  FaceAnalysisInput,
  FaceAnalysisResult,
  StyleGenerationInput,
  StyleGenerationResult,
} from "@/lib/nanobanana/types";

export type AIProviderId = "nanobanana" | "openai";

export interface AIProvider {
  id: AIProviderId;
  label: string;
  analyzeFace(input: FaceAnalysisInput): Promise<FaceAnalysisResult>;
  generateHairstyle(input: StyleGenerationInput): Promise<StyleGenerationResult>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: AIProviderId,
    public readonly status?: number,
    public readonly code?: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
