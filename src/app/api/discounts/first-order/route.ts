/**
 * First Order Discount API
 * 
 * POST /api/discounts/first-order - Generate discount code for email
 * GET  /api/discounts/first-order?code=XXX - Validate discount code
 * 
 * @created 2026-04-25
 */

import { NextRequest, NextResponse } from "next/server";
import { firstOrderService } from "@/lib/discounts/firstOrderService";

/**
 * POST - Generate a new first-order discount code
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, sessionId } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get IP and user agent
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    // Generate discount
    const result = await firstOrderService.generateDiscount(email, {
      sessionId,
      ipAddress,
      userAgent,
      source: "popup",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Send email with the code (fire and forget)
    if (result.code && result.expiresAt && !result.alreadyExists) {
      firstOrderService.sendDiscountEmail(email, result.code, result.expiresAt)
        .catch(err => console.error("[first-order] Email send failed:", err));
    }

    return NextResponse.json({
      success: true,
      code: result.code,
      expiresAt: result.expiresAt?.toISOString(),
      discountPercent: firstOrderService.DISCOUNT_PERCENT,
      alreadyExists: result.alreadyExists || false,
    });
  } catch (err: any) {
    console.error("[first-order] POST error:", err);
    return NextResponse.json(
      { error: "Failed to generate discount" },
      { status: 500 }
    );
  }
}

/**
 * GET - Validate a discount code
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const result = await firstOrderService.validateDiscount(code);

    return NextResponse.json({
      valid: result.valid,
      discountPercent: result.discountPercent,
      error: result.error,
      expired: result.expired,
      alreadyRedeemed: result.alreadyRedeemed,
    });
  } catch (err: any) {
    console.error("[first-order] GET error:", err);
    return NextResponse.json(
      { error: "Failed to validate discount" },
      { status: 500 }
    );
  }
}
