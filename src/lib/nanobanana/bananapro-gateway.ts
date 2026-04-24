import { sleep } from "@/lib/utils";
import { NanoBananaError, type OutputAspectRatio } from "./types";

type GenerateResponse = {
  success?: boolean;
  data?: { task_id?: string };
  error?: { message?: string };
};

type TaskResponse = {
  success?: boolean;
  data?: {
    task_id?: string;
    status?: string;
    image_url?: string;
    error?: string;
  };
  error?: { message?: string };
};

const DEFAULT_GATEWAY_ROOT = "https://gateway.bananapro.site/api";

function normalizeGatewayRoot(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_GATEWAY_ROOT;

  // Accept either:
  //  - https://gateway.bananapro.site
  //  - https://gateway.bananapro.site/api
  if (trimmed.endsWith("/api")) return trimmed;
  if (trimmed.endsWith("bananapro.site")) return `${trimmed}/api`;

  return trimmed;
}

export function getNanoBananaGatewayRoot(): string {
  return normalizeGatewayRoot(process.env.NANOBANANA_BASE_URL);
}

function gatewayAspectRatio(aspect?: OutputAspectRatio): "1:1" | "16:9" | "9:16" | "4:3" | "3:4" {
  switch (aspect) {
    case "1:1":
      return "1:1";
    case "4:5":
      // Closest supported portrait ratio on the Nano Banana Pro gateway.
      return "3:4";
    case "9:16":
    default:
      return "9:16";
  }
}

const DEFAULT_GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta";

function normalizeGeminiRoot(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_GEMINI_ROOT;
  return trimmed;
}

function geminiAspectRatio(aspect?: OutputAspectRatio): "1:1" | "9:16" | "4:5" {
  switch (aspect) {
    case "1:1":
      return "1:1";
    case "4:5":
      return "4:5";
    case "9:16":
    default:
      return "9:16";
  }
}

async function fetchReferenceImageForGemini(imageUrl: string): Promise<{ mimeType: string; base64: string }> {
  if (imageUrl.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.*)$/i.exec(imageUrl);
    if (!match) {
      throw new NanoBananaError("Invalid data: URL for reference image", 400, "invalid_image");
    }
    return { mimeType: match[1] || "image/jpeg", base64: match[2] };
  }

  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new NanoBananaError(`Failed to fetch reference image (${res.status})`, 502, "source_fetch_failed");
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, base64: buf.toString("base64") };
}

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

async function generateGeminiNanoBananaImage(input: {
  apiKey: string;
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio?: OutputAspectRatio;
}): Promise<{ imageUrl: string; taskId: string; raw?: unknown }> {
  const model = process.env.NANOBANANA_MODEL ?? "gemini-3-pro-image-preview";
  const configured = process.env.NANOBANANA_BASE_URL?.trim() ?? "";
  const root = configured.includes("generativelanguage.googleapis.com")
    ? normalizeGeminiRoot(configured)
    : DEFAULT_GEMINI_ROOT;
  const url = `${root}/models/${model}:generateContent`;

  const parts: Array<Record<string, unknown>> = [{ text: input.prompt }];
  if (input.referenceImageUrl) {
    const ref = await fetchReferenceImageForGemini(input.referenceImageUrl);
    parts.push({
      inline_data: {
        mime_type: ref.mimeType,
        data: ref.base64,
      },
    });
  }

  const imageSize = (process.env.NANOBANANA_GEMINI_IMAGE_SIZE ?? "2K") as "512" | "1K" | "2K" | "4K";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
      "x-client": "barberscan/1.0",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        // Gemini image generation commonly returns both text + image parts.
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: geminiAspectRatio(input.aspectRatio),
          imageSize,
        },
      },
    }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as GeminiGenerateResponse;
  if (!res.ok) {
    throw new NanoBananaError(
      data.error?.message ?? `Gemini generateContent failed (${res.status})`,
      res.status,
      "http_error",
    );
  }

  const flatParts = data.candidates?.flatMap((c) => c.content?.parts ?? []) ?? [];
  const imagePart = flatParts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const inline = imagePart?.inlineData ?? imagePart?.inline_data;
  const mimeType =
    inline && "mimeType" in inline ? inline.mimeType : (inline as { mime_type?: string } | undefined)?.mime_type;
  const b64 = inline?.data;

  if (!b64) {
    const text = flatParts.map((p) => p.text).filter(Boolean).join("\n");
    throw new NanoBananaError(text || "Gemini returned no inline image data", 502, "empty_response");
  }

  return {
    imageUrl: `data:${mimeType || "image/png"};base64,${b64}`,
    taskId: `gemini:${model}`,
    raw: data,
  };
}

export async function generateNanoBananaProImage(input: {
  prompt: string;
  imageUrl?: string;
  aspectRatio?: OutputAspectRatio;
  resolution?: "1K" | "2K" | "4K";
}): Promise<{ imageUrl: string; taskId: string; raw?: unknown }> {
  const apiKey = process.env.NANOBANANA_API_KEY;
  if (!apiKey) {
    throw new NanoBananaError("NANOBANANA_API_KEY is not configured", 500, "missing_api_key");
  }

  if (apiKey.startsWith("AIza")) {
    return generateGeminiNanoBananaImage({
      apiKey,
      prompt: input.prompt,
      referenceImageUrl: input.imageUrl,
      aspectRatio: input.aspectRatio,
    });
  }

  const root = getNanoBananaGatewayRoot();
  const aspect = gatewayAspectRatio(input.aspectRatio);
  const resolution = input.resolution ?? "2K";

  const body: Record<string, unknown> = {
    model: "nano-banana-pro",
    type: input.imageUrl ? "image-to-image" : "text-to-image",
    resolution,
    prompt: input.prompt,
    aspect_ratio: aspect,
    num_images: 1,
  };

  if (input.imageUrl) {
    body.image_urls = [input.imageUrl];
  }

  const genRes = await fetch(`${root}/v1/images/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-client": "barberscan/1.0",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const genJson = (await genRes.json().catch(() => ({}))) as GenerateResponse;
  if (!genRes.ok) {
    throw new NanoBananaError(
      genJson.error?.message ?? `Nano Banana Pro generate failed (${genRes.status})`,
      genRes.status,
      "http_error",
    );
  }

  const taskId = genJson.data?.task_id;
  if (!taskId) {
    throw new NanoBananaError("Nano Banana Pro did not return a task_id", 502, "bad_response");
  }

  const started = Date.now();
  const timeoutMs = Number(process.env.NANOBANANA_TIMEOUT_MS ?? 120_000);

  while (Date.now() - started < timeoutMs) {
    const taskRes = await fetch(`${root}/v1/images/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-client": "barberscan/1.0",
      },
      cache: "no-store",
    });

    const taskJson = (await taskRes.json().catch(() => ({}))) as TaskResponse;
    if (!taskRes.ok) {
      throw new NanoBananaError(
        taskJson.error?.message ?? `Nano Banana Pro task poll failed (${taskRes.status})`,
        taskRes.status,
        "http_error",
      );
    }

    const status = taskJson.data?.status;
    if (status === "completed" && taskJson.data?.image_url) {
      return { imageUrl: taskJson.data.image_url, taskId, raw: taskJson };
    }

    if (status === "failed" || status === "error") {
      throw new NanoBananaError(
        taskJson.data?.error ?? "Nano Banana Pro task failed",
        502,
        "task_failed",
      );
    }

    await sleep(900);
  }

  throw new NanoBananaError(
    `Nano Banana Pro task timed out after ${timeoutMs}ms (task_id=${taskId})`,
    408,
    "timeout",
  );
}
