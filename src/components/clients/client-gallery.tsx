"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Download, Loader2, MinusCircle, XCircle } from "lucide-react";
import type { SuitabilityTag } from "@prisma/client";
import { cn } from "@/lib/utils";
import { PhotoViewer, saveVariantToGallery, type ViewerPhoto } from "@/components/analysis/photo-viewer";
import { useToast } from "@/components/ui/toaster";

type GalleryItem = ViewerPhoto & {
  matchScore: number;
  suitability: SuitabilityTag;
};

/**
 * Mosaic of generated hairstyle photos for a single client.
 * Each tile opens a 9:16 fullscreen viewer with share / link / download.
 * Each tile also exposes a quick-download affordance on hover for barbers
 * who already know which style their end-client picked.
 */
export function ClientGallery({ photos }: { photos: GalleryItem[] }) {
  const { toast } = useToast();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  if (photos.length === 0) {
    return (
      <div className="card-surface p-10 text-center text-sm text-muted-foreground">
        No photos yet for this client.
      </div>
    );
  }

  async function quickSave(photo: GalleryItem) {
    if (savingId) return;
    setSavingId(photo.id);
    try {
      await saveVariantToGallery(photo.id, photo.styleName);
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't save photo",
        description: "Please try again.",
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, i) => (
          <div key={photo.id} className="card-surface group relative overflow-hidden">
            <button
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Open ${photo.styleName} fullscreen`}
              className="relative block aspect-[9/16] w-full bg-muted"
            >
              <Image
                src={photo.imageUrl}
                alt={photo.styleName}
                fill
                className="object-cover transition duration-300 group-hover:scale-[1.03]"
                sizes="(min-width: 1024px) 220px, 45vw"
              />
              <SuitabilityBadge tag={photo.suitability} score={photo.matchScore} />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                quickSave(photo);
              }}
              disabled={savingId === photo.id}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-brand-ink opacity-0 shadow-soft transition hover:bg-white focus:opacity-100 group-hover:opacity-100 disabled:opacity-70"
              aria-label={`Save ${photo.styleName} to gallery`}
            >
              {savingId === photo.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>

            <div className="flex items-center justify-between gap-2 bg-brand-sand/70 px-3 py-2">
              <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-brand-ink">
                {photo.styleName}
              </span>
              <span className="text-[11px] font-semibold text-brand-ink/70">{photo.matchScore}%</span>
            </div>
          </div>
        ))}
      </div>

      <PhotoViewer
        photos={photos}
        activeIndex={activeIndex}
        onClose={() => setActiveIndex(null)}
        onIndexChange={setActiveIndex}
      />
    </>
  );
}

function SuitabilityBadge({ tag, score }: { tag: SuitabilityTag; score: number }) {
  const conf = {
    BEST_MATCH: { Icon: CheckCircle2, bg: "bg-emerald-500", label: "Best match" },
    GOOD_MATCH: { Icon: CheckCircle2, bg: "bg-emerald-400", label: "Good match" },
    NEUTRAL: { Icon: MinusCircle, bg: "bg-amber-400", label: "Neutral" },
    NOT_IDEAL: { Icon: XCircle, bg: "bg-red-500", label: "Not ideal" },
  }[tag];

  return (
    <div
      className={cn(
        "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white shadow-soft",
        conf.bg,
      )}
      aria-label={`${conf.label} — ${score}%`}
    >
      <conf.Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{conf.label}</span>
    </div>
  );
}
