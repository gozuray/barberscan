import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Plus, Sparkles, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getQuotaStatus } from "@/lib/auth/quota";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const [quota, recent, totals] = await Promise.all([
    getQuotaStatus(user),
    db.analysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { variants: { take: 1, orderBy: { matchScore: "desc" } } },
    }),
    db.analysis.count({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-10">
      {/* Hero tile */}
      <section className="card-surface flex flex-col items-start gap-6 bg-brand-ink p-8 text-brand-cream md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <Badge variant="gold" className="mb-3 uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> Ready to impress
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl">
            Let's find your client's best look
          </h1>
          <p className="mt-2 max-w-xl text-sm text-brand-cream/80">
            Upload a photo and generate 8 realistic hairstyle previews in under a minute.
          </p>
        </div>
        <Button asChild size="xl" variant="gold">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" /> New analysis
          </Link>
        </Button>
      </section>

      {/* Stats */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Analyses this period" value={String(quota.used)} hint={`${Number.isFinite(quota.limit) ? quota.limit : "∞"} on ${quota.tier}`} />
        <StatCard label="Lifetime analyses" value={String(totals)} hint="All time" />
        <StatCard label="Plan" value={quota.tier} hint={`Resets ${formatDate(quota.resetsAt)}`} />
      </section>

      {/* Recent analyses */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Recent analyses</h2>
          <Link href="/dashboard/analyses" className="text-sm text-muted-foreground hover:text-foreground">
            View all <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((a) => (
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
                    sizes="(min-width: 1024px) 320px, 50vw"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                    <span>{formatDate(a.createdAt)}</span>
                    <span>{a.status}</span>
                  </div>
                  <div className="mt-1 font-display text-lg">
                    {a.faceShape ?? "Analyzing…"}
                    {a.hairType && <span className="text-muted-foreground"> · {a.hairType}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-surface p-6">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl">{value}</span>
        <TrendingUp className="h-4 w-4 text-brand-gold" />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-surface flex flex-col items-center gap-4 p-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-beige">
        <Sparkles className="h-6 w-6 text-brand-ink" />
      </div>
      <h3 className="font-display text-xl">No analyses yet</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Start by uploading a client photo — you'll get 8 hairstyle previews, a face-shape read, and best-match recommendations.
      </p>
      <Button asChild variant="gold">
        <Link href="/dashboard/new">
          <Plus className="h-4 w-4" /> New analysis
        </Link>
      </Button>
    </div>
  );
}
