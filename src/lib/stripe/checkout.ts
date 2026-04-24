import { stripe } from "./client";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";

type CreateCheckoutInput = {
  userId: string;
  email: string;
  priceId: string;
  trialDays?: number;
};

export async function createCheckoutSession({
  userId,
  email,
  priceId,
  trialDays = 7,
}: CreateCheckoutInput) {
  const existing = await db.subscription.findUnique({ where: { userId } });

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
    await db.subscription.upsert({
      where: { userId },
      create: { userId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { userId },
    },
    success_url: absoluteUrl("/dashboard?checkout=success"),
    cancel_url: absoluteUrl("/pricing?checkout=cancelled"),
    metadata: { userId },
  });

  return session;
}

export async function createBillingPortalSession(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) {
    throw new Error("No Stripe customer for this user");
  }
  const portal = await stripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: absoluteUrl("/dashboard/billing"),
  });
  return portal;
}
