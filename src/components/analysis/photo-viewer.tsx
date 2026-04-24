"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

/**
 * Fetches a variant as a `File` so we can hand it to the native share sheet.
 * Routing through our own /api download endpoint avoids CORS and gives us a
 * predictable filename, which the OS uses as the photo name on save.
 */
async function fetchVariantAsFile(variantId: string, styleName: string): Promise<File> {
  const res = await fetch(`/api/variants/${variantId}/download`, { cache: "no-store" });
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("webp")
      ? "webp"
      : "jpg";
  const safeName = styleName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "BarberScan";
  return new File([blob], `${safeName}.${ext}`, { type: blob.type || "image/jpeg" });
}

/**
 * True when the browser can natively share image files (iOS/Android share
 * sheet includes "Save to Photos" / "Save to gallery" as a target).
 */
function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (!nav.share || !nav.canShare) return false;
  try {
    return nav.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * Attempts to save a variant photo to the user's device gallery.
 *
 * Strategy:
 *  1. Fetch the image as a `File` (via our own proxy endpoint).
 *  2. If the browser supports sharing files (mobile), open the native share
 *     sheet — iOS Photos and Android Gallery appear there as "Save".
 *  3. Otherwise trigger a regular blob download (desktop fallback).
 *
 * Rethrows on fetch failure so callers can surface an error toast.
 */
export async function saveVariantToGallery(variantId: string, styleName: string) {
  const file = await fetchVariantAsFile(variantId, styleName);
  if (canShareFiles([file])) {
    try {
      await navigator.share({
        files: [file],
        title: `BarberScan — ${styleName}`,
      });
      return;
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ViewerPhoto = {
  id: string;
  imageUrl: string;
  styleName: string;
};

type Props = {
  photos: ViewerPhoto[];
  activeIndex: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
};

/**
 * Fullscreen photo viewer locked to a 9:16 (phone portrait) frame.
 * - Tap outside / ESC to close
 * - Arrow keys or swipe-friendly buttons to navigate
 * - Actions: native share, copy shareable public link, download as file
 */
export function PhotoViewer({ photos, activeIndex, onClose, onIndexChange }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"share" | "link" | "download" | null>(null);

  const active = activeIndex !== null ? photos[activeIndex] : null;

  const go = useCallback(
    (delta: number) => {
      if (activeIndex === null || photos.length === 0) return;
      const next = (activeIndex + delta + photos.length) % photos.length;
      onIndexChange(next);
    },
    [activeIndex, photos.length, onIndexChange],
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [activeIndex, go, onClose]);

  const fetchShareUrl = useCallback(async (variantId: string): Promise<string> => {
    const res = await fetch(`/api/variants/${variantId}/share`, { method: "POST" });
    if (!res.ok) throw new Error("share_failed");
    const { url } = (await res.json()) as { url: string };
    return url;
  }, []);

  async function handleShare() {
    if (!active) return;
    setBusy("share");
    try {
      const url = await fetchShareUrl(active.id);
      const shareData: ShareData = {
        title: `BarberScan — ${active.styleName}`,
        text: active.styleName,
        url,
      };
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          if ((err as DOMException).name === "AbortError") return;
        }
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share sheet isn't available here, so we copied the link instead." });
    } catch {
      toast({ variant: "destructive", title: "Couldn't share", description: "Please try again." });
    } finally {
      setBusy(null);
    }
  }


  async function handleCopyLink() {
    if (!active) return;
    setBusy("link");
    try {
      const url = await fetchShareUrl(active.id);
      await navigator.clipboard.writeText(url);
      toast({ title: "Public link copied", description: "Anyone with this link can view the photo." });
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy link", description: "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (!active) return;
    setBusy("download");
    try {
      await saveVariantToGallery(active.id, active.styleName);
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't save photo",
        description: "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  const frameStyle = useMemo(
    () => ({ aspectRatio: "9 / 16" }) as const,
    [],
  );

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="viewer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close */}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-6 md:top-6"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-6"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Frame */}
          <motion.div
            key={active.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full max-h-[92vh] items-center"
          >
            <div
              style={frameStyle}
              className="relative h-full max-h-[92vh] overflow-hidden rounded-[28px] bg-neutral-900 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10"
            >
              <Image
                src={active.imageUrl}
                alt={active.styleName}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 768px) 45vh, 92vw"
              />

              {/* Gradient + label */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
              <div className="pointer-events-none absolute left-4 top-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
                {active.styleName}
              </div>

              {/* Actions */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/75 via-black/40 to-transparent pb-5 pt-16">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/10 p-1.5 backdrop-blur-md ring-1 ring-white/15">
                  <ViewerAction
                    label="Share"
                    icon={busy === "share" ? Loader2 : Share2}
                    spinning={busy === "share"}
                    onClick={handleShare}
                  />
                  <ViewerAction
                    label="Copy link"
                    icon={busy === "link" ? Loader2 : Link2}
                    spinning={busy === "link"}
                    onClick={handleCopyLink}
                  />
                  <ViewerAction
                    label="Save"
                    icon={busy === "download" ? Loader2 : Download}
                    spinning={busy === "download"}
                    onClick={handleDownload}
                    primary
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-6"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Counter */}
          {photos.length > 1 && activeIndex !== null && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur">
              {activeIndex + 1} / {photos.length}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ViewerAction({
  label,
  icon: Icon,
  onClick,
  primary,
  spinning,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  primary?: boolean;
  spinning?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={primary ? "gold" : "ghost"}
      size="sm"
      onClick={onClick}
      className={
        primary
          ? "h-9 gap-2 rounded-full px-4"
          : "h-9 gap-2 rounded-full px-4 text-white hover:bg-white/15 hover:text-white"
      }
    >
      <Icon className={spinning ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
    </Button>
  );
}
