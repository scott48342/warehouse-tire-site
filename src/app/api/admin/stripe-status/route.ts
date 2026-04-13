/**
 * GET /api/admin/stripe-status
 * 
 * Diagnostic endpoint to check Stripe configuration status.
 */

import { NextResponse } from "next/server";
import { getPool } from "@/lib/quotes";
import { getStripeSettings, setStripeSettings } from "@/lib/payments/stripeSettings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getPool();
    const settings = await getStripeSettings(db);
    
    return NextResponse.json({
      ok: true,
      stripe: {
        enabled: settings.enabled,
        mode: settings.mode,
        publishableKeyPresent: !!settings.publishableKey,
        secretKeyPresent: settings.secretKeyPresent,
        // Don't expose actual keys!
        publishableKeyPrefix: settings.publishableKey?.slice(0, 12) + "...",
      },
      diagnosis: {
        canCheckout: settings.enabled && settings.secretKeyPresent,
        issues: [
          !settings.enabled && "Stripe is disabled in settings",
          !settings.secretKeyPresent && "Stripe secret key is missing",
          !settings.publishableKey && "Stripe publishable key is missing",
        ].filter(Boolean),
      },
    });
  } catch (err: any) {
    console.error("[stripe-status] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/stripe-status
 * 
 * Enable/disable Stripe or set mode.
 * Secret key must be set via environment variable or direct DB access for security.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = getPool();
    
    const patch: any = {};
    
    if (typeof body.enabled === "boolean") {
      patch.enabled = body.enabled;
    }
    if (body.mode === "test" || body.mode === "live") {
      patch.mode = body.mode;
    }
    if (typeof body.publishableKey === "string") {
      patch.publishableKey = body.publishableKey;
    }
    // Allow setting secret key for emergency fixes (normally would be env var)
    if (typeof body.secretKey === "string" && body.secretKey.startsWith("sk_")) {
      patch.secretKey = body.secretKey;
    }
    
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "No valid settings provided" }, { status: 400 });
    }
    
    await setStripeSettings(db, patch);
    
    // Return updated settings
    const updated = await getStripeSettings(db);
    
    return NextResponse.json({
      ok: true,
      message: "Stripe settings updated",
      stripe: {
        enabled: updated.enabled,
        mode: updated.mode,
        publishableKeyPresent: !!updated.publishableKey,
        secretKeyPresent: updated.secretKeyPresent,
      },
    });
  } catch (err: any) {
    console.error("[stripe-status] POST Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
