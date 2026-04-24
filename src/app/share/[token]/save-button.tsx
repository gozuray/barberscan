"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public-page variant of the "Save to gallery" action. Works against the
 * token-based download endpoint (no auth), and uses the native share sheet
 * on mobile so the file lands in Photos / Gallery directly.
 */
export function SharedSaveButton({
  token,
  styleName,
}: {
  token: string;
  styleName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/download`, { cache: "no-store" });
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const ext = blob.type.includes("png")
        ? "png"
        : blob.type.includes("webp")
          ? "webp"
          : "jpg";
      const safeName = styleName.replace(/[\\/:*?"<>|]+/g, " ").trim() || "BarberScan";
      const file = new File([blob], `${safeName}.${ext}`, { type: blob.type || "image/jpeg" });

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: `BarberScan — ${styleName}` });
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
    } catch {
      setError("Couldn't save the photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button type="button" variant="gold" size="lg" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Save to gallery
      </Button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
