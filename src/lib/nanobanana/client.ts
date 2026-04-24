import { sleep } from "@/lib/utils";
import {
  NanoBananaError,
  type FaceAnalysisInput,
  type FaceAnalysisResult,
  type StyleGenerationInput,
  type StyleGenerationResult,
} from "./types";

/**
 * NanoBananaPRO HTTP client.
 *
 * Responsibilities:
 *  - single source of truth for vendor auth and base URL
 *  - request retries with jittered exponential backoff
 *  - uniform error type (NanoBananaError) for upstream callers
 *  - graceful timeouts
 *
 * Swap this file to change provider. All upstream code depends
 * only on the exported functions, not the vendor response shape.
 */

type HttpOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
};

const DEFAULT_TIMEOUT = Number(process.env.NANOBANANA_TIMEOUT_MS ?? 60_000);
const DEFAULT_MAX_RETRIES = 3;

function getConfig() {
  const apiKey = process.env.NANOBANANA_API_KEY;
  const baseUrl = process.env.NANOBANANA_BASE_URL ?? "https://api.nanobananapro.ai/v1";
  if (!apiKey) {
    throw new NanoBananaError(
      "NANOBANANA_API_KEY is not configured",
      500,
      "missing_api_key",
    );
  }
  return { apiKey, baseUrl };
}

async function http<T>(path: string, opts: HttpOptions = {}): Promise<T> {
  const { apiKey, baseUrl } = getConfig();
  const url = `${baseUrl}${path}`;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-client": "barberscan/1.0",
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(t);

      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = res.status >= 500 || res.status === 429;
      const errText = await res.text().catch(() => res.statusText);
      const err = new NanoBananaError(
        `NanoBananaPRO request failed: ${res.status} ${errText}`,
        res.status,
        res.status === 429 ? "rate_limited" : "http_error",
        retryable,
      );
      if (!retryable || attempt === maxRetries) throw err;
      lastErr = err;
    } catch (e) {
      clearTimeout(t);
      const isAbort = e instanceof DOMException && e.name === "AbortError";
      const wrapped =
        e instanceof NanoBananaError
          ? e
          : new NanoBananaError(
              isAbort
                ? `NanoBananaPRO request timed out after ${timeout}ms`
                : (e as Error).message ?? "network_error",
              isAbort ? 408 : undefined,
              isAbort ? "timeout" : "network_error",
              true,
            );
      if (!wrapped.retryable || attempt === maxRetries) throw wrapped;
      lastErr = wrapped;
    }

    // Exponential backoff with jitter: 400ms, 800ms, 1600ms (± 30%)
    const base = 400 * Math.pow(2, attempt);
    const jitter = base * (0.7 + Math.random() * 0.6);
    await sleep(jitter);
    attempt += 1;
  }

  throw lastErr ?? new NanoBananaError("Unknown NanoBananaPRO failure");
}

// ─────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────

export async function analyzeFace(
  input: FaceAnalysisInput,
): Promise<FaceAnalysisResult> {
  type Raw = {
    face_shape: string;
    hair_type: string;
    hair_density: string;
    skin_tone?: string;
    age_bracket?: string;
  };
  const raw = await http<Raw>("/analyze/face", {
    body: { image_url: input.imageUrl },
  });
  return {
    faceShape: raw.face_shape,
    hairType: raw.hair_type,
    hairDensity: raw.hair_density,
    skinTone: raw.skin_tone,
    ageBracket: raw.age_bracket,
    raw,
  };
}

export async function generateHairstyle(
  input: StyleGenerationInput,
): Promise<StyleGenerationResult> {
  type Raw = { image_url: string; generation_ms?: number };
  const start = Date.now();
  const aspectRatio = input.aspectRatio ?? "9:16";
  const raw = await http<Raw>("/generate/hairstyle", {
    body: {
      image_url: input.imageUrl,
      prompt: input.prompt,
      style_key: input.styleKey,
      aspect_ratio: aspectRatio,
      size: aspectRatio === "9:16" ? "1080x1920" : aspectRatio === "4:5" ? "1024x1280" : "1024x1024",
      analysis: input.analysis
        ? {
            face_shape: input.analysis.faceShape,
            hair_type: input.analysis.hairType,
            hair_density: input.analysis.hairDensity,
          }
        : undefined,
    },
    timeoutMs: 90_000,
  });
  return {
    styleKey: input.styleKey,
    imageUrl: raw.image_url,
    generationMs: raw.generation_ms ?? Date.now() - start,
    raw,
  };
}

export const nanobanana = {
  analyzeFace,
  generateHairstyle,
};
