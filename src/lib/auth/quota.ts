import { db } from "@/lib/db";
import { getQuotaForTier } from "@/lib/plans";
import type { User } from "@prisma/client";

export type QuotaStatus = {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
  resetsAt: Date;
};

/**
 * Returns the current month-to-date analysis usage for a user
 * and their plan's quota. Used for:
 *  - Dashboard badge
 *  - Hard-gating /api/analyze
 *  - Billing nudges
 */
export async function getQuotaStatus(user: User): Promise<QuotaStatus> {
  const sub = await db.subscription.findUnique({ where: { userId: user.id } });
  const tier = sub?.tier ?? "FREE";
  const limit = getQuotaForTier(tier);

  // Month-to-date window. For paid plans we prefer the billing period.
  const start =
    sub?.currentPeriodStart ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end =
    sub?.currentPeriodEnd ??
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  const used = await db.usageEvent.count({
    where: {
      userId: user.id,
      kind: "ANALYSIS_CREATED",
      createdAt: { gte: start, lt: end },
    },
  });

  const remaining = Number.isFinite(limit) ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY;

  return {
    used,
    limit,
    remaining,
    tier,
    resetsAt: end,
  };
}

export async function assertQuotaAvailable(user: User): Promise<QuotaStatus> {
  const status = await getQuotaStatus(user);
  if (status.remaining <= 0) {
    const err = new Error("QUOTA_EXCEEDED");
    (err as Error & { code?: string }).code = "QUOTA_EXCEEDED";
    throw err;
  }
  return status;
}
