"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Minimize2 } from "lucide-react";
import type { Analysis, StyleVariant } from "@prisma/client";

export function PresentationView({
  analysis,
}: {
  analysis: Analysis & { variants: StyleVariant[] };
}) {
  const [idx, setIdx] = useState(0);
  const variants = analysis.variants;

  const next = useCallback(
    () => setIdx((i) => (i + 1) % variants.length),
    [variants.length],
  );
  const prev = useCallback(
    () => setIdx((i) => (i - 1 + variants.length) % variants.length),
    [variants.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") window.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const v = variants[idx];

  return (
    <div className="fixed inset-0 flex flex-col bg-brand-ink text-brand-cream">
      <div className="flex items-center justify-between px-8 py-5 text-xs uppercase tracking-[0.28em] text-brand-gold-soft">
        <span>BarberScan · Client Preview</span>
        <button
          onClick={() => window.close()}
          className="inline-flex items-center gap-2 text-brand-cream/70 hover:text-brand-cream"
        >
          <Minimize2 className="h-4 w-4" /> Exit
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-8 pb-12">
        {/* Original */}
        <div className="relative mx-6 hidden h-[70vh] w-[28vw] overflow-hidden rounded-2xl shadow-luxe md:block">
          <Image src={analysis.originalUrl} alt="Original" fill className="object-cover" sizes="28vw" priority />
          <div className="absolute bottom-4 left-4 text-[11px] uppercase tracking-widest text-brand-gold-soft">
            Before
          </div>
        </div>

        {/* Variant */}
        <div className="relative mx-6 h-[70vh] w-[90vw] overflow-hidden rounded-2xl shadow-luxe md:w-[34vw]">
          <AnimatePresence mode="wait">
            <motion.div
              key={v.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="absolute inset-0"
            >
              <Image src={v.imageUrl} alt={v.styleName} fill className="object-cover" sizes="34vw" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-6 left-0 right-0 text-center">
            <div className="mx-auto inline-flex items-center gap-3 rounded-full bg-brand-cream/10 px-5 py-2 backdrop-blur">
              <span className="font-display text-lg">{v.styleName}</span>
              <span className="text-xs text-brand-gold-soft">· Match {v.matchScore}%</span>
            </div>
            <p className="mx-auto mt-3 max-w-md text-balance text-sm text-brand-cream/80">
              {v.explanation}
            </p>
          </div>
        </div>

        {/* Nav */}
        <button
          onClick={prev}
          aria-label="Previous"
          className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-cream/10 backdrop-blur transition hover:bg-brand-cream/20"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-cream/10 backdrop-blur transition hover:bg-brand-cream/20"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex justify-center gap-2 border-t border-brand-cream/10 bg-brand-charcoal px-8 py-4">
        {variants.map((variant, i) => (
          <button
            key={variant.id}
            onClick={() => setIdx(i)}
            className={`relative h-14 w-14 overflow-hidden rounded-lg transition ${
              i === idx ? "ring-2 ring-brand-gold" : "opacity-60 hover:opacity-100"
            }`}
          >
            <Image src={variant.imageUrl} alt={variant.styleName} fill className="object-cover" sizes="56px" />
          </button>
        ))}
      </div>
    </div>
  );
}
