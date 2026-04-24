"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  MinusCircle,
  XCircle,
  Sparkles,
  Droplet,
  Wind,
  Calendar,
  Scissors,
  User,
} from "lucide-react";
import type { Analysis, StyleVariant, SuitabilityTag } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type AnalysisWithVariants = Analysis & { variants: StyleVariant[] };

export function AnalysisResults({ initialAnalysis }: { initialAnalysis: AnalysisWithVariants }) {
  const [analysis, setAnalysis] = useState(initialAnalysis);

  // Poll until completion
  useEffect(() => {
    if (analysis.status === "COMPLETED" || analysis.status === "FAILED") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/analyze/${analysis.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as AnalysisWithVariants;
        setAnalysis(data);
        if (data.status === "COMPLETED" || data.status === "FAILED") clearInterval(t);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [analysis.id, analysis.status]);

  if (analysis.status === "FAILED") {
    return (
      <div className="card-surface p-10 text-center">
        <h2 className="font-display text-2xl">We couldn't complete this analysis</h2>
        <p className="mt-2 text-sm text-muted-foreground">{analysis.errorMessage ?? "Please try again."}</p>
      </div>
    );
  }

  if (analysis.status !== "COMPLETED") {
    return <LoadingState analysis={analysis} />;
  }

  const good = analysis.variants.filter(
    (v) => v.suitability === "BEST_MATCH" || v.suitability === "GOOD_MATCH",
  );
  const neutral = analysis.variants.filter((v) => v.suitability === "NEUTRAL");
  const notIdeal = analysis.variants.filter((v) => v.suitability === "NOT_IDEAL");
  const sorted = [...good, ...neutral, ...notIdeal];
  const bestMatches = [...analysis.variants].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <Badge variant="outline" className="uppercase tracking-[0.18em]">Hairstyle analysis</Badge>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl">Find your best look</h1>
        </div>
      </div>

      {/* Main grid: left = original + insights, right = comparison grid */}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          <PanelHeader label="Your look" />
          <div className="card-surface overflow-hidden">
            <div className="relative aspect-[4/5] bg-muted">
              <Image
                src={analysis.originalUrl}
                alt="Client"
                fill
                className="object-cover"
                sizes="320px"
                priority
              />
            </div>
          </div>

          <PanelHeader label="Face & hair insights" />
          <div className="card-surface p-5">
            <InsightRow icon={User} label="Face shape" value={analysis.faceShape ?? "—"} />
            <InsightRow icon={Scissors} label="Hair type" value={analysis.hairType ?? "—"} />
            <InsightRow icon={Sparkles} label="Hair density" value={analysis.hairDensity ?? "—"} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <PanelHeader label="Hairstyle comparison" center />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {sorted.map((variant, i) => (
              <VariantCard key={variant.id} variant={variant} delay={i * 0.04} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            {/* Best matches */}
            <div className="card-surface border-2 border-emerald-300/50 bg-emerald-50/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
                  Best matches
                </span>
              </div>
              <div className="flex gap-4">
                {bestMatches.map((v) => (
                  <div key={v.id} className="flex flex-col items-center text-center">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-white shadow-soft">
                      <Image src={v.imageUrl} alt={v.styleName} fill className="object-cover" sizes="80px" />
                      <div className="absolute right-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-widest">
                      {v.styleName}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick tips */}
            <div className="card-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-gold" />
                <span className="text-xs font-semibold uppercase tracking-widest">Quick tips</span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <TipBlock icon={User} label="Keep sides tight for a clean look" />
                <TipBlock icon={Droplet} label="Use matte clay for texture" />
                <TipBlock icon={Wind} label="Blow dry up and back" />
                <TipBlock icon={Calendar} label="Trim every 3–4 weeks" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ label, center }: { label: string; center?: boolean }) {
  return (
    <div className={cn("flex", center && "justify-center")}>
      <div className="inline-flex rounded-full bg-brand-ink px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-brand-cream">
        {label}
      </div>
    </div>
  );
}

function InsightRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-none">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-beige/60">
          <Icon className="h-4 w-4 text-brand-ink" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div className="text-sm font-medium">{value}</div>
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, delay }: { variant: StyleVariant; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="card-surface overflow-hidden"
    >
      <div className="relative aspect-[4/5] bg-muted">
        <Image src={variant.imageUrl} alt={variant.styleName} fill className="object-cover" sizes="(min-width:768px) 200px, 45vw" />
      </div>
      <div className="flex items-center justify-between gap-2 bg-brand-sand/70 px-3 py-2">
        <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-brand-ink">
          {variant.styleName}
        </span>
        <SuitabilityIcon tag={variant.suitability} />
      </div>
    </motion.div>
  );
}

function SuitabilityIcon({ tag }: { tag: SuitabilityTag }) {
  switch (tag) {
    case "BEST_MATCH":
    case "GOOD_MATCH":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="h-3 w-3" />
        </span>
      );
    case "NEUTRAL":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white">
          <MinusCircle className="h-3 w-3" />
        </span>
      );
    case "NOT_IDEAL":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
          <XCircle className="h-3 w-3" />
        </span>
      );
  }
}

function TipBlock({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-beige/60">
        <Icon className="h-4 w-4 text-brand-ink" />
      </div>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function LoadingState({ analysis }: { analysis: AnalysisWithVariants }) {
  return (
    <div className="card-surface flex flex-col items-center gap-6 p-14 text-center">
      <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-muted">
        <Image src={analysis.originalUrl} alt="Client" fill className="object-cover" sizes="96px" />
        <div className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>
      <div>
        <h2 className="font-display text-2xl">Generating hairstyles…</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyzing face shape, hair type and density. This usually takes 45–90 seconds.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 w-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
