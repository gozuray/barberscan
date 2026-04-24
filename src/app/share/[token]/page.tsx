import Image from "next/image";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { SharedSaveButton } from "./save-button";

export const dynamic = "force-dynamic";

export default async function SharedPhotoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const variant = await db.styleVariant.findUnique({
    where: { shareToken: token },
    select: { id: true, imageUrl: true, styleName: true },
  });

  if (!variant) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
          <Sparkles className="h-3 w-3 text-brand-gold" />
          BarberScan
        </div>

        <div
          className="relative w-full max-w-[min(92vw,420px)] overflow-hidden rounded-[28px] bg-neutral-900 shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
          style={{ aspectRatio: "9 / 16" }}
        >
          <Image
            src={variant.imageUrl}
            alt={variant.styleName}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 420px, 92vw"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="pointer-events-none absolute left-4 top-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90">
            {variant.styleName}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          <SharedSaveButton token={token} styleName={variant.styleName} />
          <p className="text-xs text-white/60">Shared privately by your barber.</p>
        </div>
      </div>
    </div>
  );
}
