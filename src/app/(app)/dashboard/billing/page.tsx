import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getQuotaStatus } from "@/lib/auth/quota";
import { PLANS } from "@/lib/plans";
import { BillingActions } from "@/components/billing/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/utils";

export default async function BillingPage() {
  const user = await requireUser();
  const sub = await db.subscription.findUnique({ where: { userId: user.id } });
  const quota = await getQuotaStatus(user);
  const plan = PLANS[quota.tier];
  const pct = Number.isFinite(quota.limit)
    ? Math.min(100, Math.round((quota.used / Math.max(1, quota.limit)) * 100))
    : 0;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Billing</Badge>
        <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">Your subscription</h1>
      </div>

      <div className="card-surface p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</div>
            <div className="mt-1 font-display text-3xl">{plan.name}</div>
            <div className="text-sm text-muted-foreground">{plan.tagline}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Status</div>
            <div className="mt-1 font-medium">{sub?.status ?? "TRIALING"}</div>
            {sub?.currentPeriodEnd && (
              <div className="text-xs text-muted-foreground">
                Renews {formatDate(sub.currentPeriodEnd)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>Usage this period</span>
            <span>
              {quota.used}
              {Number.isFinite(quota.limit) ? ` / ${quota.limit}` : " / ∞"}
            </span>
          </div>
          <Progress value={pct} className="mt-2" />
        </div>

        <BillingActions currentTier={quota.tier} />
      </div>
    </div>
  );
}
