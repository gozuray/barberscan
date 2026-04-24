import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function AllAnalysesPage() {
  const user = await requireUser();
  const analyses = await db.analysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { take: 1, orderBy: { matchScore: "desc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">History</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold">All analyses</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {analyses.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/analyses/${a.id}`}
            className="card-surface group overflow-hidden transition hover:shadow-luxe"
          >
            <div className="relative aspect-[9/16] bg-muted">
              <Image
                src={a.variants[0]?.imageUrl ?? a.originalUrl}
                alt="Analysis"
                fill
                className="object-cover transition group-hover:scale-[1.02]"
                sizes="320px"
              />
            </div>
            <div className="p-4">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                {formatDate(a.createdAt)}
              </div>
              <div className="mt-1 font-display text-lg">{a.faceShape ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Status: {a.status}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
