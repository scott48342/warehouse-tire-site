/**
 * POST /api/fitment-api/checkout
 *
 * Self-serve Fitment API signup. Creates a Stripe Checkout Session
 * (mode=subscription) for a plan and returns its URL.
 *
 * Body: { plan: "starter" | "growth" | "pro", email?: string }
 * Returns: { url: string }
 *
 * Prices are passed inline via `price_data` so no Stripe dashboard product
 * setup is required. Sessions are tagged `metadata.product = "fitment_api"`
 * so the shared Stripe webhook can route them (see billing.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPool } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import {
  FITMENT_API_PRODUCT_TAG,
  PLAN_NAMES,
  PLAN_PRICES,
  isBillablePlan,
} from "@/lib/fitment-api/billing";
import { PLAN_LIMITS } from "@/lib/fitment-api/apiKeys";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const plan = typeof body?.plan === "string" ? body.plan.trim().toLowerCase() : "";
    const emailRaw = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!isBillablePlan(plan)) {
      return NextResponse.json(
        { error: "invalid_plan", message: "plan must be one of: starter, growth, pro" },
        { status: 400 }
      );
    }
    if (emailRaw && !EMAIL_RE.test(emailRaw)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const stripeConn = await getStripeClient(getPool());
    if (!stripeConn) {
      return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
    }

    const base = (process.env.NEXT_PUBLIC_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");
    const planName = PLAN_NAMES[plan];
    const monthlyCalls = PLAN_LIMITS[plan]?.monthly;

    const metadata: Record<string, string> = {
      product: FITMENT_API_PRODUCT_TAG,
      plan,
    };

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PLAN_PRICES[plan],
            recurring: { interval: "month" },
            product_data: {
              name: `Fitment API — ${planName}`,
              description: monthlyCalls
                ? `Up to ${monthlyCalls.toLocaleString("en-US")} API calls per month. Cancel anytime.`
                : undefined,
              metadata,
            },
          },
        },
      ],
      metadata,
      subscription_data: { metadata },
      customer_email: emailRaw || undefined,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${base}/fitment-api/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/fitment-api#pricing`,
    };

    const session = await stripeConn.stripe.checkout.sessions.create(params);

    if (!session.url) {
      console.error(`[fitment-api/checkout] session ${session.id} has no url`);
      return NextResponse.json({ error: "no_checkout_url" }, { status: 500 });
    }

    console.log(`[fitment-api/checkout] ${stripeConn.mode} session ${session.id} for plan=${plan}${emailRaw ? ` email=${emailRaw}` : ""}`);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[fitment-api/checkout] failed:", err);
    return NextResponse.json(
      { error: "checkout_failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
