/**
 * Saved Quotes API - List & Create
 * 
 * GET  /api/account/quotes - List user's saved quotes
 * POST /api/account/quotes - Save a new quote
 * 
 * All endpoints require authentication with verified email.
 * 
 * @created 2026-08-24
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  listSavedQuotes,
  createSavedQuote,
} from "@/lib/savedQuotes/savedQuoteService";
import type { SaveQuoteRequest } from "@/lib/savedQuotes/types";

/**
 * Get authenticated session with verification check
 */
async function getVerifiedSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return { user: null, error: "unauthorized" };
  }
  
  if (!session.user.emailVerified) {
    return { user: null, error: "email_not_verified" };
  }
  
  return { user: session.user, error: null };
}

/**
 * GET /api/account/quotes
 * 
 * List user's saved quotes
 * 
 * Query params:
 * - includeArchived: boolean (default false)
 */
export async function GET(req: NextRequest) {
  const { user, error } = await getVerifiedSession();
  
  if (error === "unauthorized") {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }
  
  if (error === "email_not_verified") {
    return NextResponse.json(
      { error: "email_not_verified", message: "Email verification required" },
      { status: 403 }
    );
  }
  
  try {
    const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
    const result = await listSavedQuotes(user!.id, includeArchived);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[quotes] GET error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to list quotes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/quotes
 * 
 * Save a new quote
 * 
 * Body: SaveQuoteRequest
 * - vehicle: { year, make, model, trim?, modification? }
 * - items: Array of cart items
 * - name?: Optional quote name
 * - source?: "cart" | "package-builder" | "pdp"
 * - cartId?: For correlation
 * - idempotencyKey?: For retry protection
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getVerifiedSession();
  
  if (error === "unauthorized") {
    return NextResponse.json(
      { error: "unauthorized", message: "Authentication required" },
      { status: 401 }
    );
  }
  
  if (error === "email_not_verified") {
    return NextResponse.json(
      { error: "email_not_verified", message: "Email verification required" },
      { status: 403 }
    );
  }
  
  try {
    const body: SaveQuoteRequest = await req.json();
    
    // Basic shape validation before passing to service
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
    
    const result = await createSavedQuote(user!.id, body);
    
    if (!result.ok) {
      const status = result.code === "limit_reached" ? 400 : 
                     result.code === "validation_error" ? 400 : 500;
      
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
        id: result.id,
        isIdempotent: result.isIdempotent,
      },
      { status: result.isIdempotent ? 200 : 201 }
    );
  } catch (error) {
    console.error("[quotes] POST error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to save quote" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
