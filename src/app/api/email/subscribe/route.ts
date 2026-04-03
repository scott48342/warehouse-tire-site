/**
 * Email Subscribe API
 * 
 * POST /api/email/subscribe
 * Capture email for marketing (abandoned cart, newsletter, etc.)
 * 
 * GET /api/email/subscribe?email=...
 * Check subscription status
 * 
 * DELETE /api/email/subscribe
 * Unsubscribe from marketing
 * 
 * @created 2026-04-03
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { subscribe, unsubscribe, isSubscribed, getByEmail, type EmailSource } from "@/lib/email/subscriberService";
import { getCartId } from "@/lib/cart/useCartTracking";

export const runtime = "nodejs";

const VALID_SOURCES: EmailSource[] = ["exit_intent", "cart_save", "checkout", "newsletter", "quote"];

/**
 * POST /api/email/subscribe
 * 
 * Body:
 * - email: string (required)
 * - source: EmailSource (required)
 * - vehicle?: { year, make, model, trim }
 * - cartId?: string
 * - marketingConsent?: boolean (default true)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, source, vehicle, cartId, marketingConsent = true } = body;

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate source
    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Source must be one of: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get request metadata
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0] || 
                      headersList.get("x-real-ip") || 
                      "unknown";
    const userAgent = headersList.get("user-agent") || undefined;

    // Subscribe
    const subscriber = await subscribe({
      email,
      source,
      vehicle,
      cartId,
      marketingConsent,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      subscriber: {
        id: subscriber.id,
        email: subscriber.email,
        source: subscriber.source,
        vehicle: subscriber.vehicleYear ? {
          year: subscriber.vehicleYear,
          make: subscriber.vehicleMake,
          model: subscriber.vehicleModel,
          trim: subscriber.vehicleTrim,
        } : null,
        createdAt: subscriber.createdAt,
      },
    });
  } catch (err: any) {
    console.error("[email/subscribe] POST Error:", err);
    return NextResponse.json(
      { error: err?.message || "Subscription failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/email/subscribe?email=...
 * Check if email is subscribed
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    const subscribed = await isSubscribed(email);
    const records = await getByEmail(email);

    return NextResponse.json({
      email,
      subscribed,
      sources: records.map(r => r.source),
      records: records.map(r => ({
        source: r.source,
        vehicle: r.vehicleYear ? {
          year: r.vehicleYear,
          make: r.vehicleMake,
          model: r.vehicleModel,
        } : null,
        createdAt: r.createdAt,
        unsubscribed: r.unsubscribed,
      })),
    });
  } catch (err: any) {
    console.error("[email/subscribe] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Lookup failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email/subscribe
 * Unsubscribe from marketing
 * 
 * Body:
 * - email: string (required)
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const count = await unsubscribe(email);

    return NextResponse.json({
      success: true,
      email,
      unsubscribedRecords: count,
    });
  } catch (err: any) {
    console.error("[email/subscribe] DELETE Error:", err);
    return NextResponse.json(
      { error: err?.message || "Unsubscribe failed" },
      { status: 500 }
    );
  }
}
