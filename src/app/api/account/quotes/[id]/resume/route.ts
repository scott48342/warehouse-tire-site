/**
 * Saved Quote Resume/Revalidation API
 * 
 * POST /api/account/quotes/[id]/resume
 * 
 * Revalidates a saved quote against current commerce state:
 * - Product availability
 * - Current pricing
 * - Fitment validation
 * - Required accessories
 * 
 * Does NOT mutate the saved quote or cart.
 * Returns comparison data for UI display.
 * 
 * Requires:
 * - Authenticated session
 * - Verified email
 * - Quote ownership (user_id matches)
 * 
 * @created 2026-08-24
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getSavedQuoteById } from "@/lib/savedQuotes/savedQuoteService";
import { revalidateSavedQuote } from "@/lib/savedQuotes/resumeService";
import type { ResumeAPIResponse } from "@/lib/savedQuotes/resumeTypes";
import type { SavedQuoteSnapshot } from "@/lib/savedQuotes/types";

export const runtime = "nodejs";
export const maxDuration = 30; // Revalidation may take time

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ResumeAPIResponse>> {
  const t0 = Date.now();
  
  try {
    const { id } = await params;
    
    // ══════════════════════════════════════════════════════════════════════════
    // Authentication Check
    // ══════════════════════════════════════════════════════════════════════════
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
    if (!session?.user) {
      return NextResponse.json({
        ok: false,
        error: { code: "unauthorized", message: "Authentication required" },
      }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // ══════════════════════════════════════════════════════════════════════════
    // Email Verification Check
    // ══════════════════════════════════════════════════════════════════════════
    if (!session.user.emailVerified) {
      return NextResponse.json({
        ok: false,
        error: { code: "email_not_verified", message: "Please verify your email address" },
      }, { status: 403 });
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // Quote ID Validation
    // ══════════════════════════════════════════════════════════════════════════
    if (!id || typeof id !== "string") {
      return NextResponse.json({
        ok: false,
        error: { code: "invalid_id", message: "Invalid quote ID" },
      }, { status: 400 });
    }
    
    // Validate ID format (must be sq_ prefixed)
    if (!id.startsWith("sq_")) {
      return NextResponse.json({
        ok: false,
        error: { code: "not_found", message: "Quote not found" },
      }, { status: 404 });
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // Fetch Quote (ownership verified inside)
    // ══════════════════════════════════════════════════════════════════════════
    const quote = await getSavedQuoteById(userId, id);
    
    if (!quote) {
      // Return 404 for both "not found" and "not owned by user"
      // Don't reveal whether the quote exists for another user
      return NextResponse.json({
        ok: false,
        error: { code: "not_found", message: "Quote not found" },
      }, { status: 404 });
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // Check if Quote is Already Converted
    // ══════════════════════════════════════════════════════════════════════════
    if (quote.convertedOrderId) {
      return NextResponse.json({
        ok: false,
        error: { 
          code: "already_converted", 
          message: "This quote has already been converted to an order" 
        },
      }, { status: 400 });
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // Parse Snapshot
    // ══════════════════════════════════════════════════════════════════════════
    const snapshot: SavedQuoteSnapshot = quote.snapshot;
    
    if (!snapshot || !snapshot.items || snapshot.items.length === 0) {
      return NextResponse.json({
        ok: false,
        error: { code: "invalid_snapshot", message: "Quote snapshot is invalid or empty" },
      }, { status: 400 });
    }
    
    // ══════════════════════════════════════════════════════════════════════════
    // Perform Revalidation
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`[resume] Starting revalidation for quote ${id}, user ${userId}`);
    
    const result = await revalidateSavedQuote(id, snapshot);
    
    const elapsed = Date.now() - t0;
    console.log(`[resume] Revalidation complete for ${id} in ${elapsed}ms. canContinue=${result.canContinue}`);
    
    return NextResponse.json({
      ok: true,
      result,
    });
    
  } catch (err) {
    console.error("[resume] Error:", err);
    return NextResponse.json({
      ok: false,
      error: { code: "internal_error", message: "Failed to revalidate quote" },
    }, { status: 500 });
  }
}
