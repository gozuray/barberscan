import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import type { StyleVariant } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ClientActions } from "@/components/clients/client-actions";
import { ClientGallery } from "@/components/clients/client-gallery";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const client = await db.client.findFirst({
    where: { id, userId: user.id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        include: { variants: { orderBy: { matchScore: "desc" } } },
      },
    },
  });

  if (!client) notFound();

  const displayName =
    client.name ?? (client.clientNumber != null ? `Cliente ${client.clientNumber}` : "Unnamed client");

  const firstAnalysis = client.analyses[0];
  const photos = client.analyses.flatMap((a) =>
    a.variants.map((v: StyleVariant) => ({
      id: v.id,
      imageUrl: v.imageUrl,
      styleName: v.styleName,
      matchScore: v.matchScore,
      suitability: v.suitability,
    })),
  );

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </Link>

      <div className="space-y-2">
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Client</Badge>
        <ClientActions clientId={client.id} initialName={displayName} />
        <div className="text-xs text-muted-foreground">
          Added {formatDate(client.createdAt)} ·{" "}
          {client.analyses.length} {client.analyses.length === 1 ? "analysis" : "analyses"} ·{" "}
          {photos.length} photos
        </div>
      </div>

      {firstAnalysis && (
        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Original photo
            </div>
            <div className="card-surface overflow-hidden">
              <div className="relative aspect-[4/5] bg-muted">
                <Image
                  src={firstAnalysis.originalUrl}
                  alt="Original"
                  fill
                  className="object-cover"
                  sizes="280px"
                />
              </div>
            </div>
            <div className="card-surface space-y-1 p-4 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Face shape:</span>{" "}
                {firstAnalysis.faceShape ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-foreground">Hair type:</span>{" "}
                {firstAnalysis.hairType ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-foreground">Hair density:</span>{" "}
                {firstAnalysis.hairDensity ?? "—"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Generated hairstyles
              </div>
              <div className="text-xs text-muted-foreground">
                Tap a photo to open · share or download
              </div>
            </div>
            <ClientGallery photos={photos} />
          </div>
        </section>
      )}
    </div>
  );
}
