"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@prisma/client";
import { useToast } from "@/components/ui/toaster";

export function BillingActions({ currentTier }: { currentTier: PlanTier }) {
  const [loading, setLoading] = useState<string | null>(null);
  const { toast } = useToast();

  async function startCheckout(priceId: string) {
    setLoading(priceId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      toast({ variant: "destructive", title: "Checkout failed", description: (e as Error).message });
    } finally {
      setLoading(null);
    }
  }

  async function openPortal() {
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message ?? "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't open portal", description: (e as Error).message });
    } finally {
      setLoading(null);
    }
  }

  const paid = [PLANS.STARTER, PLANS.PRO, PLANS.STUDIO];

  return (
    <div className="mt-8 space-y-4">
      {currentTier !== "FREE" && (
        <Button variant="outline" onClick={openPortal} disabled={loading === "portal"}>
          {loading === "portal" ? "Opening…" : "Manage payment & invoices"}
        </Button>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {paid.map((plan) => {
          const priceId = plan.stripePriceIds.monthly;
          const isCurrent = plan.tier === currentTier;
          return (
            <div key={plan.tier} className="card-surface p-5">
              <div className="flex items-baseline justify-between">
                <div className="font-display text-lg">{plan.name}</div>
                <div className="font-display text-2xl">${plan.monthlyPrice}</div>
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {Number.isFinite(plan.quota) ? `${plan.quota} analyses / mo` : "Unlimited"}
              </div>
              <Button
                className="mt-4 w-full"
                variant={isCurrent ? "outline" : "gold"}
                disabled={!priceId || isCurrent || loading === priceId}
                onClick={() => priceId && startCheckout(priceId)}
              >
                {isCurrent ? "Current plan" : loading === priceId ? "Loading…" : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
