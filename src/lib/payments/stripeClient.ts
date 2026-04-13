import Stripe from "stripe";
import type pg from "pg";
import { getStripeSettings, getStripeSecretKey } from "@/lib/payments/stripeSettings";

export async function getStripeClient(db: pg.Pool): Promise<{ stripe: Stripe; mode: "test" | "live" } | null> {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 1: Environment variables (most reliable, no DB dependency)
  // ═══════════════════════════════════════════════════════════════════════════
  const envSecretKey = process.env.STRIPE_SECRET_KEY;
  if (envSecretKey && envSecretKey.startsWith("sk_")) {
    const mode: "test" | "live" = envSecretKey.startsWith("sk_live_") ? "live" : "test";
    console.log(`[stripe] Using env var STRIPE_SECRET_KEY (mode: ${mode})`);
    
    const stripe = new Stripe(envSecretKey, {
      apiVersion: "2024-06-20",
      typescript: true,
    });
    
    return { stripe, mode };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Database settings (legacy, for admin UI control)
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    const settings = await getStripeSettings(db);
    if (!settings.enabled) {
      console.log("[stripe] Disabled in DB settings");
      return null;
    }

    const secret = await getStripeSecretKey(db);
    if (!secret) {
      console.log("[stripe] No secret key in DB");
      return null;
    }

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
  } catch (dbErr) {
    console.error("[stripe] DB settings fetch failed:", dbErr);
    return null;
  }
}
