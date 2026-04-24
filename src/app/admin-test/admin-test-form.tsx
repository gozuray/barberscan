"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CUSTOM_HAIRSTYLE_PROMPT, POPULAR_HAIRSTYLES } from "@/lib/ai/custom-prompt";

type Result = {
  imageUrl: string;
  prompt: string;
  provider: Provider;
  providerLabel: string;
  size: string;
};

type Provider = "openai" | "nanobanana";

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  description: string;
  requiredEnv: string;
}> = [
  {
    id: "openai",
    label: "OpenAI",
    description: "Usa OPENAI_IMAGE_MODEL, normalmente gpt-image-1.",
    requiredEnv: "OPENAI_API_KEY",
  },
  {
    id: "nanobanana",
    label: "Nano Banana Pro",
    description:
      "Si `NANOBANANA_API_KEY` empieza por `sk-`, usa el gateway `gateway.bananapro.site`. Si empieza por `AIza`, usa Gemini (`NANOBANANA_MODEL`, p.ej. `gemini-3-pro-image-preview`).",
    requiredEnv: "NANOBANANA_API_KEY",
  },
];

export function AdminTestForm() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState(CUSTOM_HAIRSTYLE_PROMPT);
  const [provider, setProvider] = useState<Provider>("openai");
  const [hairstyle, setHairstyle] = useState<string>(POPULAR_HAIRSTYLES[0] ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  async function runTest() {
    if (!file || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("image", file);
      form.append("prompt", prompt);
      form.append("provider", provider);
      if (hairstyle.trim()) {
        form.append("hairstyle", hairstyle.trim());
      }

      const res = await fetch("/api/admin-test/openai", {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Provider request failed.");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="rounded-3xl border border-border bg-white p-5 shadow-soft">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold">1. Sube tu foto</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
              className="mt-2 block w-full rounded-xl border border-border bg-brand-cream/40 p-3 text-sm"
            />
          </div>

          {previewUrl ? (
            <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-muted">
              <Image src={previewUrl} alt="Preview" fill className="object-cover" unoptimized />
            </div>
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center rounded-2xl border border-dashed border-border bg-brand-cream/40 text-sm text-muted-foreground">
              Vista previa de la foto
            </div>
          )}

          <div>
            <label className="text-sm font-semibold">2. Elige el modelo/proveedor</label>
            <div className="mt-2 grid gap-2">
              {PROVIDERS.map((option) => {
                const active = provider === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setProvider(option.id);
                      setResult(null);
                      setError(null);
                    }}
                    disabled={loading}
                    className={[
                      "rounded-xl border p-3 text-left transition",
                      active
                        ? "border-brand-ink bg-brand-ink/[0.04] shadow-soft"
                        : "border-border bg-white hover:bg-brand-cream/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className="rounded-full bg-brand-cream px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {option.requiredEnv}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">3. Peinado a probar</label>
            <p className="mt-1 text-xs text-muted-foreground">
              El texto sustituye a <code>[HAIRSTYLE]</code> dentro del prompt. Un peinado por imagen —
              los collages 2×2 rompen la identidad del rostro.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR_HAIRSTYLES.map((option) => {
                const active = option === hairstyle;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setHairstyle(option)}
                    disabled={loading}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition",
                      active
                        ? "border-brand-ink bg-brand-ink text-brand-cream"
                        : "border-border bg-white hover:bg-brand-cream/50",
                    ].join(" ")}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={hairstyle}
              onChange={(event) => setHairstyle(event.target.value)}
              placeholder="Descripción del peinado (ej. 'textured side part, medium length')"
              className="mt-2 w-full rounded-xl border border-border bg-white p-3 text-sm outline-none focus:border-brand-ink"
            />
          </div>

          <div>
            <label className="text-sm font-semibold">4. Prompt que se enviará al proveedor</label>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={8}
              className="mt-2 w-full rounded-xl border border-border bg-white p-3 text-sm outline-none focus:border-brand-ink"
            />
          </div>

          <button
            type="button"
            onClick={runTest}
            disabled={!file || loading}
            className="w-full rounded-full bg-brand-ink px-5 py-3 text-sm font-semibold text-brand-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generando imagen..." : "Probar API con mi foto"}
          </button>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-white p-5 shadow-soft">
        <div className="mb-4">
          <h2 className="font-display text-2xl font-semibold">Resultado</h2>
          <p className="text-sm text-muted-foreground">
            Aquí aparecerá la imagen devuelta por el proveedor seleccionado. Esta prueba no guarda nada en base de datos.
          </p>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="relative mx-auto aspect-[9/16] max-h-[760px] overflow-hidden rounded-3xl bg-muted">
              <Image src={result.imageUrl} alt="Generated result" fill className="object-contain" unoptimized />
            </div>
            <div className="rounded-xl bg-brand-cream/60 p-3 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Proveedor:</span> {result.providerLabel}
              </div>
              <div className="mt-1">
                <span className="font-semibold text-foreground">Size:</span> {result.size}
              </div>
              <div className="mt-1">
                <span className="font-semibold text-foreground">Prompt:</span> {result.prompt}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center rounded-3xl border border-dashed border-border bg-brand-cream/40 text-sm text-muted-foreground">
            Todavía no hay resultado
          </div>
        )}
      </section>
    </div>
  );
}
