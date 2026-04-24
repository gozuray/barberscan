import { sleep } from "@/lib/utils";
import {
  AIProviderError,
  type AIProvider,
  type FaceAnalysisInput,
  type FaceAnalysisResult,
  type OutputAspectRatio,
  type StyleGenerationInput,
  type StyleGenerationResult,
} from "@/lib/ai/types";

/**
 * OpenAI-backed implementation of the AIProvider interface.
 *
 *  - Face analysis runs through the Chat Completions API with a vision
 *    message (`OPENAI_ANALYSIS_MODEL`, default "gpt-5.5"). We ask the model
 *    to return a strict JSON payload so we can map it to FaceAnalysisResult.
 *
 *  - Hairstyle generation uses the OpenAI Images API (`OPENAI_IMAGE_MODEL`,
 *    default "gpt-image-1") with the subject photo passed as a reference so
 *    identity is preserved. Aspect ratio maps to a `size` the API supports.
 *
 * Both endpoints share a common retry/backoff helper so transient 5xx or
 * 429 responses don't fail the pipeline.
 */

const DEFAULT_TIMEOUT = Number(process.env.OPENAI_TIMEOUT_MS ?? 90_000);
const DEFAULT_MAX_RETRIES = 3;

const PROVIDER_ID = "openai" as const;

type HttpOptions = {
  method?: "GET" | "POST";
  body?: BodyInit | null;
  json?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
};

function getConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  if (!apiKey) {
    throw new AIProviderError(
      "OPENAI_API_KEY is not configured",
      PROVIDER_ID,
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
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "x-client": "barberscan/1.0",
        ...(opts.headers ?? {}),
      };
      let body: BodyInit | null | undefined = opts.body;
      if (opts.json !== undefined) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.json);
      }

      const res = await fetch(url, {
        method: opts.method ?? "POST",
        headers,
        body,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(t);

      if (res.ok) {
        return (await res.json()) as T;
      }

      const retryable = res.status >= 500 || res.status === 429;
      const errText = await res.text().catch(() => res.statusText);
      const err = new AIProviderError(
        `OpenAI request failed: ${res.status} ${errText}`,
        PROVIDER_ID,
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
        e instanceof AIProviderError
          ? e
          : new AIProviderError(
              isAbort
                ? `OpenAI request timed out after ${timeout}ms`
                : (e as Error).message ?? "network_error",
              PROVIDER_ID,
              isAbort ? 408 : undefined,
              isAbort ? "timeout" : "network_error",
              true,
            );
      if (!wrapped.retryable || attempt === maxRetries) throw wrapped;
      lastErr = wrapped;
    }

    const base = 400 * Math.pow(2, attempt);
    const jitter = base * (0.7 + Math.random() * 0.6);
    await sleep(jitter);
    attempt += 1;
  }

  throw lastErr ?? new AIProviderError("Unknown OpenAI failure", PROVIDER_ID);
}

// ─────────────────────────────────────────────────────────
//  Face analysis — GPT-5.5 vision → structured JSON
// ─────────────────────────────────────────────────────────

type ChatCompletionsResponse = {
  choices: Array<{ message: { content: string | null } }>;
};

const ANALYSIS_SYSTEM_PROMPT = `You are a professional barber's assistant. Look at the supplied client photo and output a STRICT JSON object describing the subject's facial and hair attributes. Do not include prose, markdown, or comments — only JSON.

Schema:
{
  "face_shape": "Oval" | "Round" | "Square" | "Heart" | "Diamond" | "Oblong",
  "hair_type": string,      // e.g. "Straight / Medium", "Wavy / Thick", "Curly / Fine"
  "hair_density": "Low" | "Medium" | "Medium - High" | "High",
  "skin_tone": string,      // concise descriptor, e.g. "Warm medium"
  "age_bracket": string     // e.g. "20-30"
}`;

async function openaiAnalyzeFace(input: FaceAnalysisInput): Promise<FaceAnalysisResult> {
  const model = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-5.5";

  const data = await http<ChatCompletionsResponse>("/chat/completions", {
    json: {
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this client's photo and return the JSON payload." },
            { type: "image_url", image_url: { url: input.imageUrl } },
          ],
        },
      ],
    },
  });

  const content = data.choices?.[0]?.message?.content ?? "{}";
  let raw: {
    face_shape?: string;
    hair_type?: string;
    hair_density?: string;
    skin_tone?: string;
    age_bracket?: string;
  };
  try {
    raw = JSON.parse(content);
  } catch {
    throw new AIProviderError(
      "OpenAI analysis returned non-JSON content",
      PROVIDER_ID,
      502,
      "bad_response",
    );
  }

  return {
    faceShape: raw.face_shape ?? "Oval",
    hairType: raw.hair_type ?? "Straight / Medium",
    hairDensity: raw.hair_density ?? "Medium",
    skinTone: raw.skin_tone,
    ageBracket: raw.age_bracket,
    raw,
  };
}

// ─────────────────────────────────────────────────────────
//  Hairstyle generation — OpenAI Images API (image edits)
// ─────────────────────────────────────────────────────────

type ImagesResponse = {
  data: Array<{ url?: string; b64_json?: string }>;
};

function sizeForRatio(aspect: OutputAspectRatio): string {
  switch (aspect) {
    case "9:16":
      return "1024x1792";
    case "4:5":
      return "1024x1280";
    case "1:1":
    default:
      return "1024x1024";
  }
}

async function openaiGenerateHairstyle(
  input: StyleGenerationInput,
): Promise<StyleGenerationResult> {
  const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const aspect = input.aspectRatio ?? "9:16";
  const size = sizeForRatio(aspect);
  const start = Date.now();

  // Multipart upload: we need to pass the subject photo as a File so the
  // model can use it as the identity reference for the edit.
  const upstream = await fetch(input.imageUrl, { cache: "no-store" });
  if (!upstream.ok) {
    throw new AIProviderError(
      `Failed to fetch subject image (${upstream.status})`,
      PROVIDER_ID,
      502,
      "source_fetch_failed",
    );
  }
  const blob = await upstream.blob();
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("webp")
      ? "webp"
      : "jpg";

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", input.prompt);
  form.append("size", size);
  form.append("n", "1");
  form.append("image", new File([blob], `subject.${ext}`, { type: blob.type || "image/jpeg" }));

  const data = await http<ImagesResponse>("/images/edits", {
    body: form,
    timeoutMs: 120_000,
  });

  const first = data.data?.[0];
  if (!first || (!first.url && !first.b64_json)) {
    throw new AIProviderError(
      "OpenAI returned no image data",
      PROVIDER_ID,
      502,
      "empty_response",
    );
  }

  const imageUrl = first.url ?? `data:image/png;base64,${first.b64_json}`;

  return {
    styleKey: input.styleKey,
    imageUrl,
    generationMs: Date.now() - start,
    raw: data,
  };
}

export const openaiProvider: AIProvider = {
  id: PROVIDER_ID,
  label: "OpenAI GPT-5.5",
  analyzeFace: openaiAnalyzeFace,
  generateHairstyle: openaiGenerateHairstyle,
};
