import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Users } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function ClientsPage() {
  const user = await requireUser();
  const clients = await db.client.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { analyses: true } },
      analyses: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: { variants: { take: 1, orderBy: { matchScore: "desc" } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Clients</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold">Your client book</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every new analysis is saved here as "Cliente N". Rename or delete any client from their page.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="card-surface flex flex-col items-center gap-4 p-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-beige">
            <Users className="h-6 w-6 text-brand-ink" />
          </div>
          <h3 className="font-display text-xl">No clients yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Start a new analysis — a "Cliente 1" entry will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const firstAnalysis = c.analyses[0];
            const thumb =
              firstAnalysis?.variants[0]?.imageUrl ?? firstAnalysis?.originalUrl ?? null;
            const displayName =
              c.name ?? (c.clientNumber != null ? `Cliente ${c.clientNumber}` : "Unnamed client");
            return (
              <Link
                key={c.id}
                href={`/dashboard/clients/${c.id}`}
                className="card-surface group flex items-center gap-4 p-4 transition hover:shadow-luxe"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {thumb ? (
                    <Image src={thumb} alt={displayName} fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c._count.analyses} {c._count.analyses === 1 ? "analysis" : "analyses"} · added{" "}
                    {formatDate(c.createdAt)}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
