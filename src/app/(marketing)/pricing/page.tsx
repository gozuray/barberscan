"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Interval = "monthly" | "yearly";

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("monthly");
  const paidPlans = [PLANS.STARTER, PLANS.PRO, PLANS.STUDIO];

  return (
    <div className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="outline" className="uppercase tracking-[0.18em]">Pricing</Badge>
        <h1 className="mt-4 font-display text-4xl font-semibold md:text-5xl">
          Simple pricing for serious barbers
        </h1>
        <p className="mt-3 text-muted-foreground">
          7-day free trial. Cancel anytime. Upgrade as your shop grows.
        </p>

        <div className="mt-8 inline-flex rounded-full border border-border bg-white p-1">
          {(["monthly", "yearly"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setInterval(k)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition",
                interval === k ? "bg-brand-ink text-brand-cream" : "text-muted-foreground",
              )}
            >
              {k === "monthly" ? "Monthly" : "Yearly (save 20%)"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 grid max-w-6xl gap-6 md:grid-cols-3">
        {paidPlans.map((plan) => {
          const price = interval === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
          const suffix = interval === "monthly" ? "/mo" : "/yr";
          return (
            <div
              key={plan.tier}
              className={cn(
                "card-surface flex flex-col p-8",
                plan.highlighted && "ring-2 ring-brand-gold shadow-luxe",
              )}
            >
              {plan.highlighted && (
                <Badge variant="gold" className="mb-3 w-fit uppercase tracking-widest">Most popular</Badge>
              )}
              <h3 className="font-display text-2xl font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl">${price}</span>
                <span className="text-sm text-muted-foreground">{suffix}</span>
              </div>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <X className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={cn(!f.included && "text-muted-foreground line-through")}>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button asChild className="mt-8" size="lg" variant={plan.highlighted ? "gold" : "default"}>
                <Link href="/sign-up">Start 7-day trial</Link>
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Questions about enterprise or white-label? <Link className="underline" href="mailto:sales@barberscan.app">Talk to sales</Link>.
      </p>
    </div>
  );
}
