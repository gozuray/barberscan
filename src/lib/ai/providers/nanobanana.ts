import { analyzeFace, generateHairstyle } from "@/lib/nanobanana/client";
import type { AIProvider } from "@/lib/ai/types";

/**
 * Adapter that plugs the existing NanoBananaPRO HTTP client into the
 * provider-agnostic AIProvider interface. This is the default provider
 * (`AI_PROVIDER=nanobanana`).
 */
export const nanobananaProvider: AIProvider = {
  id: "nanobanana",
  label: "NanoBananaPRO",
  analyzeFace,
  generateHairstyle,
};
