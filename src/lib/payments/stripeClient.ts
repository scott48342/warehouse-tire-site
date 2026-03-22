import Stripe from "stripe";
import type pg from "pg";
import { getStripeSettings, getStripeSecretKey } from "@/lib/payments/stripeSettings";

export async function getStripeClient(db: pg.Pool): Promise<{ stripe: Stripe; mode: "test" | "live" } | null> {
  const settings = await getStripeSettings(db);
  if (!settings.enabled) return null;

  const secret = await getStripeSecretKey(db);
  if (!secret) return null;

  // Safety: if admin says test mode, require a test key.
  if (settings.mode === "test" && !secret.startsWith("sk_test_")) {
    throw new Error("stripe_secret_key_not_test");
  }
  if (settings.mode === "live" && !secret.startsWith("sk_live_")) {
    throw new Error("stripe_secret_key_not_live");
  }

  const stripe = new Stripe(secret, {
    apiVersion: "2024-06-20",
    typescript: true,
  });

  return { stripe, mode: settings.mode };
}
