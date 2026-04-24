import { PlanTier } from "@prisma/client";

export type PlanFeature = {
  label: string;
  included: boolean;
};

export type Plan = {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthlyPrice: number; // USD
  yearlyPrice: number;
  quota: number;         // analyses per month, Infinity for unlimited
  maxTeamMembers: number;
  stripePriceIds: {
    monthly: string | undefined;
    yearly: string | undefined;
  };
  features: PlanFeature[];
  highlighted?: boolean;
};

export const PLANS: Record<PlanTier, Plan> = {
  FREE: {
    tier: "FREE",
    name: "Trial",
    tagline: "Try BarberScan risk-free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    quota: 5,
    maxTeamMembers: 1,
    stripePriceIds: { monthly: undefined, yearly: undefined },
    features: [
      { label: "5 analyses included", included: true },
      { label: "Full hairstyle library", included: true },
      { label: "Watermarked results", included: true },
      { label: "Email support", included: false },
    ],
  },
  STARTER: {
    tier: "STARTER",
    name: "Starter",
    tagline: "For independent barbers",
    monthlyPrice: 29,
    yearlyPrice: 279,
    quota: 50,
    maxTeamMembers: 1,
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
      yearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    },
    features: [
      { label: "50 analyses / month", included: true },
      { label: "All 8 core hairstyles", included: true },
      { label: "Client presentation mode", included: true },
      { label: "Analysis history", included: true },
      { label: "Team seats", included: false },
    ],
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    tagline: "For busy barbershops",
    monthlyPrice: 79,
    yearlyPrice: 759,
    quota: 300,
    maxTeamMembers: 3,
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
    features: [
      { label: "300 analyses / month", included: true },
      { label: "Up to 3 team seats", included: true },
      { label: "Export PDF reports", included: true },
      { label: "Priority generation queue", included: true },
      { label: "Custom branding", included: false },
    ],
    highlighted: true,
  },
  STUDIO: {
    tier: "STUDIO",
    name: "Studio",
    tagline: "For premium studios & chains",
    monthlyPrice: 199,
    yearlyPrice: 1899,
    quota: Number.POSITIVE_INFINITY,
    maxTeamMembers: 25,
    stripePriceIds: {
      monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_STUDIO_YEARLY,
    },
    features: [
      { label: "Unlimited analyses", included: true },
      { label: "Up to 25 team seats", included: true },
      { label: "White-label branding", included: true },
      { label: "API access", included: true },
      { label: "Dedicated onboarding", included: true },
    ],
  },
};

export function getPlan(tier: PlanTier): Plan {
  return PLANS[tier];
}

export function getQuotaForTier(tier: PlanTier): number {
  return PLANS[tier].quota;
}

export function planFromPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "FREE";
  for (const plan of Object.values(PLANS)) {
    if (
      plan.stripePriceIds.monthly === priceId ||
      plan.stripePriceIds.yearly === priceId
    ) {
      return plan.tier;
    }
  }
  return "FREE";
}
