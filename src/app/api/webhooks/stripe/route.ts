import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { db } from "@/lib/db";
import { planFromPriceId } from "@/lib/plans";
import type { SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing": return "TRIALING";
    case "active": return "ACTIVE";
    case "past_due": return "PAST_DUE";
    case "canceled": return "CANCELED";
    case "incomplete": return "INCOMPLETE";
    case "incomplete_expired": return "INCOMPLETE_EXPIRED";
    case "unpaid": return "UNPAID";
    case "paused": return "PAUSED";
    default: return "INCOMPLETE";
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed", err);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (userId && customerId) {
          await db.subscription.update({
            where: { userId },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subId ?? undefined,
            },
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;
        const tier = planFromPriceId(priceId);
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const userId = (sub.metadata as Record<string, string>)?.userId;

        const where = userId
          ? { userId }
          : { stripeCustomerId: customerId };

        await db.subscription.update({
          where,
          data: {
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            tier: event.type === "customer.subscription.deleted" ? "FREE" : tier,
            status: mapStatus(sub.status),
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
        }).catch((e) => {
          // If the subscription row doesn't exist yet (pre-sync), upsert.
          if ((e as { code?: string }).code !== "P2025") throw e;
        });
        break;
      }
      default:
        // ignore non-relevant events
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] processing error", { type: event.type, err });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
