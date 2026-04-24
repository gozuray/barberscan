import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

// Lazy to tolerate missing keys at build time on preview environments.
let instance: Stripe | null = null;

export function stripe(): Stripe {
  if (instance) return instance;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  instance = new Stripe(secret, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
    appInfo: {
      name: "BarberScan",
      version: "1.0.0",
    },
  });
  return instance;
}
