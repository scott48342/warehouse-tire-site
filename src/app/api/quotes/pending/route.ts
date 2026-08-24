/**
 * Pending Quote API (Guest Flow)
 * 
 * POST /api/quotes/pending - Create a pending quote for guest users
 * 
 * Returns a one-time token that can be claimed after authentication.
 * No authentication required (this is the guest save flow).
 * 
 * @created 2026-08-24
 */

import { NextRequest, NextResponse } from "next/server";
import { createPendingQuote } from "@/lib/savedQuotes/pendingQuoteService";
import type { SaveQuoteRequest } from "@/lib/savedQuotes/types";

/**
 * POST /api/quotes/pending
 * 
 * Create a pending quote for a guest user.
 * 
 * Body: SaveQuoteRequest
 * Query: returnTo (optional, validated for open redirect)
 * 
 * Returns: { ok: true, token: string, expiresAt: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body: SaveQuoteRequest = await req.json();
    
    // Basic shape validation
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "invalid_request", message: "Request body required" },
        { status: 400 }
      );
    }
    
    if (!body.vehicle || !body.items) {
      return NextResponse.json(
        { error: "invalid_request", message: "Vehicle and items required" },
        { status: 400 }
      );
    }
    
    // Get return URL from query params
    const returnTo = req.nextUrl.searchParams.get("returnTo") || undefined;
    
    const result = await createPendingQuote(body, returnTo);
    
    if (!result.ok) {
      const status = result.code === "validation_error" ? 400 : 500;
      return NextResponse.json(
        { 
          error: result.code, 
          message: result.error,
          field: result.field,
        },
        { status }
      );
    }
    
    return NextResponse.json(
      { 
        ok: true, 
        token: result.token,
        expiresAt: result.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[pending-quote] POST error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to create pending quote" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
