/**
 * Saved Quote API - Single Quote Operations
 * 
 * GET    /api/account/quotes/[id] - Get quote detail
 * PATCH  /api/account/quotes/[id] - Update quote (name)
 * DELETE /api/account/quotes/[id] - Archive or delete quote
 * 
 * All endpoints require authentication with verified email.
 * Cross-account access returns 404 (doesn't confirm existence).
 * 
 * @created 2026-08-24
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  getSavedQuote,
  updateSavedQuote,
  archiveSavedQuote,
  deleteSavedQuote,
} from "@/lib/savedQuotes/savedQuoteService";

type RouteParams = { params: Promise<{ id: string }> };

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
 * GET /api/account/quotes/[id]
 * 
 * Get quote detail including full snapshot
 * Updates lastViewedAt timestamp
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    
    // Validate ID format
    if (!id || !id.startsWith("sq_")) {
      return NextResponse.json(
        { error: "not_found", message: "Quote not found" },
        { status: 404 }
      );
    }
    
    const quote = await getSavedQuote(user!.id, id, true);
    
    if (!quote) {
      // Return 404 for both non-existent and non-owned quotes
      return NextResponse.json(
        { error: "not_found", message: "Quote not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(quote);
  } catch (error) {
    console.error("[quotes/[id]] GET error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to get quote" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account/quotes/[id]
 * 
 * Update quote metadata
 * 
 * Body:
 * - name?: string | null (set or clear name)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const body = await req.json();
    
    // Validate ID format
    if (!id || !id.startsWith("sq_")) {
      return NextResponse.json(
        { error: "not_found", message: "Quote not found" },
        { status: 404 }
      );
    }
    
    // Only allow name updates for now
    const updates: { name?: string | null } = {};
    if ("name" in body) {
      updates.name = body.name;
    }
    
    const result = await updateSavedQuote(user!.id, id, updates);
    
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 500;
      return NextResponse.json(
        { error: result.code, message: result.error },
        { status }
      );
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[quotes/[id]] PATCH error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to update quote" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account/quotes/[id]
 * 
 * Archive or permanently delete a quote
 * 
 * Query params:
 * - permanent=true: Permanently delete (default: archive)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
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
    const { id } = await params;
    const permanent = req.nextUrl.searchParams.get("permanent") === "true";
    
    // Validate ID format
    if (!id || !id.startsWith("sq_")) {
      return NextResponse.json(
        { error: "not_found", message: "Quote not found" },
        { status: 404 }
      );
    }
    
    const result = permanent
      ? await deleteSavedQuote(user!.id, id)
      : await archiveSavedQuote(user!.id, id);
    
    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 500;
      return NextResponse.json(
        { error: result.code, message: result.error },
        { status }
      );
    }
    
    return NextResponse.json({ ok: true, permanent });
  } catch (error) {
    console.error("[quotes/[id]] DELETE error:", error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to delete quote" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
