import type { AIProvider, AIProviderId } from "./types";
import { nanobananaProvider } from "./providers/nanobanana";
import { openaiProvider } from "./providers/openai";

export * from "./types";

const REGISTRY: Record<AIProviderId, AIProvider> = {
  nanobanana: nanobananaProvider,
  openai: openaiProvider,
};

const PROVIDER_IDS: AIProviderId[] = ["nanobanana", "openai"];

/**
 * Returns the default AIProvider. Can be overridden via the `AI_PROVIDER`
 * env var (`nanobanana` | `openai`). Falls back to NanoBananaPRO so nothing
 * breaks on machines that haven't yet configured OpenAI.
 */
export function getDefaultProvider(): AIProvider {
  const id = (process.env.AI_PROVIDER ?? "nanobanana") as AIProviderId;
  return REGISTRY[id] ?? nanobananaProvider;
}

/**
 * Resolves a provider by id, with graceful fallback to the default.
 * Useful when the caller (e.g. `/api/analyze`) wants to let barbers pick
 * the provider on a per-request basis for A/B testing.
 */
export function getProvider(id?: string | null): AIProvider {
  if (!id) return getDefaultProvider();
  return REGISTRY[id as AIProviderId] ?? getDefaultProvider();
}

export function isValidProviderId(id: string): id is AIProviderId {
  return PROVIDER_IDS.includes(id as AIProviderId);
}

export function listProviders(): Array<Pick<AIProvider, "id" | "label">> {
  return PROVIDER_IDS.map((id) => ({ id, label: REGISTRY[id].label }));
}
