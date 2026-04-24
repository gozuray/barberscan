import { NextResponse } from "next/server";
import { CUSTOM_HAIRSTYLE_PROMPT } from "@/lib/ai/custom-prompt";
import { generateNanoBananaProImage } from "@/lib/nanobanana/bananapro-gateway";
import { NanoBananaError } from "@/lib/nanobanana/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImagesResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { message?: string };
};

const OPENAI_IMAGE_EDIT_SIZE = "1024x1536";
const NANOBANANA_IMAGE_SIZE = "1080x1920";

type Provider = "openai" | "nanobanana";

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/jpeg"};base64,${buffer.toString("base64")}`;
}

async function generateWithOpenAI(image: File, prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE-ME")) {
    return {
      ok: false as const,
      status: 500,
      body: {
        error: "missing_api_key",
        message: "OPENAI_API_KEY is not configured in .env.local.",
      },
    };
  }

  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", OPENAI_IMAGE_EDIT_SIZE);
  form.append("n", "1");
  form.append("image", image, image.name || "portrait.jpg");

  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${baseUrl}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as ImagesResponse;

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      body: {
        error: "openai_error",
        message: data.error?.message ?? `OpenAI returned HTTP ${res.status}.`,
      },
    };
  }

  const first = data.data?.[0];
  const imageUrl = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);

  if (!imageUrl) {
    return {
      ok: false as const,
      status: 502,
      body: { error: "empty_response", message: "OpenAI did not return an image." },
    };
  }

  return {
    ok: true as const,
    body: { imageUrl, provider: "openai", providerLabel: "OpenAI", size: OPENAI_IMAGE_EDIT_SIZE },
  };
}

async function generateWithNanoBananaPro(image: File, prompt: string) {
  const apiKey = process.env.NANOBANANA_API_KEY;

  if (!apiKey || apiKey.includes("_xxx")) {
    return {
      ok: false as const,
      status: 500,
      body: {
        error: "missing_api_key",
        message: "NANOBANANA_API_KEY is not configured in .env.local.",
      },
    };
  }

  try {
    const imageUrl = await fileToDataUrl(image);
    const generated = await generateNanoBananaProImage({
      prompt,
      imageUrl,
      aspectRatio: "9:16",
      resolution: "2K",
    });

    return {
      ok: true as const,
      body: {
        imageUrl: generated.imageUrl,
        provider: "nanobanana",
        providerLabel: "Nano Banana Pro",
        size: NANOBANANA_IMAGE_SIZE,
      },
    };
  } catch (error) {
    if (error instanceof NanoBananaError) {
      return {
        ok: false as const,
        status: error.status ?? 502,
        body: {
          error: error.code ?? "nanobanana_error",
          message: error.message,
        },
      };
    }

    return {
      ok: false as const,
      status: 502,
      body: {
        error: "nanobanana_error",
        message: error instanceof Error ? error.message : "Nano Banana Pro request failed.",
      },
    };
  }
}

export async function POST(req: Request) {
  try {
    const input = await req.formData();
    const image = input.get("image");
    const promptFromForm = input.get("prompt");
    const providerFromForm = input.get("provider");
    const provider: Provider = providerFromForm === "nanobanana" ? "nanobanana" : "openai";
    const rawPrompt =
      typeof promptFromForm === "string" && promptFromForm.trim()
        ? promptFromForm.trim()
        : CUSTOM_HAIRSTYLE_PROMPT;
    const hairstyleFromForm = input.get("hairstyle");
    const hairstyle =
      typeof hairstyleFromForm === "string" && hairstyleFromForm.trim()
        ? hairstyleFromForm.trim()
        : "a different popular modern hairstyle";
    const prompt = rawPrompt.replace(/\[HAIRSTYLE\]/g, hairstyle);

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "missing_image", message: "Upload a JPG or PNG image." },
        { status: 400 },
      );
    }

    if (!image.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "invalid_image", message: "The uploaded file must be an image." },
        { status: 400 },
      );
    }

    const generated =
      provider === "nanobanana"
        ? await generateWithNanoBananaPro(image, prompt)
        : await generateWithOpenAI(image, prompt);

    if (!generated.ok) {
      return NextResponse.json(
        {
          ...generated.body,
          provider,
        },
        { status: generated.status },
      );
    }

    return NextResponse.json({ ...generated.body, prompt });
  } catch (error) {
    console.error("[/api/admin-test/generate]", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
