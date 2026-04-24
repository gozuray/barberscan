"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Upload, Sparkles, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { UploadDropzone } from "@/lib/uploadthing";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import type { QuotaStatus } from "@/lib/auth/quota";

export function NewAnalysisForm({ quota }: { quota: QuotaStatus }) {
  const router = useRouter();
  const { toast } = useToast();
  const [uploaded, setUploaded] = useState<{ url: string; key: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const quotaReached = Number.isFinite(quota.limit) && quota.remaining <= 0;

  async function submit() {
    if (!uploaded || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploaded.url, imageKey: uploaded.key }),
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
        <div className="card-surface p-6">
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
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-surface grid gap-6 p-6 md:grid-cols-[220px_1fr] md:items-center"
        >
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted">
            <Image src={uploaded.url} alt="Uploaded" fill className="object-cover" sizes="220px" />
          </div>
          <div className="space-y-4">
            <h3 className="font-display text-xl">Photo looks great</h3>
            <p className="text-sm text-muted-foreground">
              We'll analyze face shape, hair type and density, then generate 8 hairstyle previews. This typically takes 45–90 seconds.
            </p>
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
