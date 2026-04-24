"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, AlertTriangle, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { UploadDropzone } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type { QuotaStatus } from "@/lib/auth/quota";

type ProviderId = "nanobanana" | "openai";
const PROVIDERS: Array<{ id: ProviderId; label: string; description: string }> = [
  {
    id: "nanobanana",
    label: "NanoBananaPRO",
    description: "Default engine — fast, tuned for barbering.",
  },
  {
    id: "openai",
    label: "ChatGPT 5.5",
    description: "OpenAI's latest vision + image editing stack.",
  },
];

type Props = {
  quota: QuotaStatus;
  /** When true, show a "paste image URL" fallback for local testing without UploadThing. */
  allowPasteUrl?: boolean;
  /**
   * When true, the backend will ignore the 8-style loop and send one custom
   * prompt instead (see `src/lib/ai/custom-prompt.ts`). We also force the
   * OpenAI provider because the prompt targets GPT-5.5.
   */
  customPromptMode?: boolean;
};

export function NewAnalysisForm({ quota, allowPasteUrl, customPromptMode }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [uploaded, setUploaded] = useState<{ url: string; key?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(customPromptMode ? "openai" : "nanobanana");
  const [pastedUrl, setPastedUrl] = useState("");

  const quotaReached = Number.isFinite(quota.limit) && quota.remaining <= 0;

  async function submit() {
    if (!uploaded || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: uploaded.url,
          imageKey: uploaded.key,
          provider,
          aspectRatio: "9:16",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't start analysis",
          description: data.message ?? data.error ?? "Please try again.",
        });
        return;
      }
      router.push(`/dashboard/analyses/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handlePastedUrl() {
    const trimmed = pastedUrl.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast({ variant: "destructive", title: "That doesn't look like a URL" });
      return;
    }
    setUploaded({ url: trimmed });
  }

  if (quotaReached) {
    return (
      <div className="card-surface flex items-start gap-4 p-6">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <div className="space-y-2">
          <h3 className="font-semibold">You've reached your monthly limit</h3>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan to keep running analyses this period.
          </p>
          <Button asChild variant="gold">
            <a href="/dashboard/billing">Upgrade plan</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!uploaded ? (
        <div className="card-surface space-y-4 p-6">
          <UploadDropzone
            endpoint="clientPhoto"
            className="ut-button:bg-brand-ink ut-button:text-brand-cream ut-button:rounded-full ut-label:text-foreground ut-allowed-content:text-muted-foreground border-2 border-dashed border-border bg-brand-cream/40 p-10 rounded-2xl"
            onClientUploadComplete={(res) => {
              const f = res?.[0];
              if (f) setUploaded({ url: f.url, key: f.key });
            }}
            onUploadError={(err) => {
              toast({ variant: "destructive", title: "Upload failed", description: err.message });
            }}
            content={{
              label: "Drop a client photo here",
              allowedContent: "PNG or JPG · up to 8MB",
              button: () => (
                <span className="inline-flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Choose file
                </span>
              ),
            }}
          />

          {allowPasteUrl ? (
            <div className="rounded-xl border border-dashed border-border bg-white/60 p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Link2 className="h-3.5 w-3.5" /> Local dev · paste image URL
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Skip UploadThing for quick testing. Paste any publicly-reachable image URL (https).
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="url"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 min-w-[240px] rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand-ink"
                />
                <Button type="button" onClick={handlePastedUrl} variant="outline">
                  Use this URL
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-surface grid gap-6 p-6 md:grid-cols-[220px_1fr] md:items-center"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-muted">
            <Image
              src={uploaded.url}
              alt="Uploaded"
              fill
              className="object-cover"
              sizes="220px"
              unoptimized
            />
          </div>
          <div className="space-y-4">
            <h3 className="font-display text-xl">Photo looks great</h3>
            <p className="text-sm text-muted-foreground">
              {customPromptMode
                ? "Test mode active: we'll send your custom prompt to GPT-5.5 once and display the result below."
                : "We'll analyze face shape, hair type and density, then generate 8 hairstyle previews in 9:16 phone format. This typically takes 45–90 seconds."}
            </p>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI engine
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((p) => {
                  const active = provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProvider(p.id)}
                      disabled={submitting}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition",
                        active
                          ? "border-brand-ink bg-brand-ink/[0.04] shadow-soft"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={submit} disabled={submitting} size="lg" variant="gold">
                {submitting ? (
                  <>Submitting…</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Run analysis
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setUploaded(null)} disabled={submitting}>
                Choose a different photo
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
