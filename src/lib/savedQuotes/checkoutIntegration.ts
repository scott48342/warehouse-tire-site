/**
 * Saved Quote ↔ Checkout Integration
 * 
 * Server-side validation and conversion tracking for saved quotes during checkout.
 * 
 * Security model:
 * - Client supplies savedQuoteId, but we NEVER trust it blindly
 * - We validate ownership against authenticated Better Auth session
 * - Only attach to payment metadata if ownership is verified
 * - Guest checkouts cannot claim account saved quotes
 * 
 * @created 2026-08-24 (B6)
 */

import { db } from "@/lib/db";
import { savedQuotes } from "@/lib/auth-schema";
import { eq, and, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// ============================================================================
// Ownership Validation (for checkout session creation)
// ============================================================================

export interface SavedQuoteValidation {
  valid: boolean;
  userId?: string;
  quoteId?: string;
  reason?: string;
}

/**
 * Validate that a saved quote ID belongs to the currently authenticated user.
 * 
 * Called during checkout session creation to determine if we should attach
 * the saved quote correlation to payment metadata.
 * 
 * @returns { valid: true, userId, quoteId } if ownership verified
 * @returns { valid: false, reason } if validation fails
 */
export async function validateSavedQuoteOwnership(
  savedQuoteId: string | undefined | null
): Promise<SavedQuoteValidation> {
  // No saved quote ID provided - this is fine, just a normal checkout
  if (!savedQuoteId || typeof savedQuoteId !== "string") {
    return { valid: false, reason: "no_quote_id" };
  }
  
  // Sanitize the ID
  const quoteId = savedQuoteId.trim();
  if (!quoteId || quoteId.length > 100) {
    return { valid: false, reason: "invalid_quote_id" };
  }
  
  try {
    // Get authenticated session from Better Auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    
    // Must be authenticated to claim a saved quote
    if (!session?.user?.id) {
      console.log(`[savedQuote.checkout] No authenticated session for quote ${quoteId}`);
      return { valid: false, reason: "not_authenticated" };
    }
    
    const userId = session.user.id;
    
    // Verify the saved quote exists and belongs to this user
    const quote = await db
      .select({
        id: savedQuotes.id,
        userId: savedQuotes.userId,
        archivedAt: savedQuotes.archivedAt,
        convertedOrderId: savedQuotes.convertedOrderId,
      })
      .from(savedQuotes)
      .where(eq(savedQuotes.id, quoteId))
      .limit(1);
    
    if (quote.length === 0) {
      console.log(`[savedQuote.checkout] Quote not found: ${quoteId}`);
      return { valid: false, reason: "quote_not_found" };
    }
    
    const row = quote[0];
    
    // Ownership check - CRITICAL SECURITY
    if (row.userId !== userId) {
      console.warn(`[savedQuote.checkout] OWNERSHIP MISMATCH: quote ${quoteId} belongs to ${row.userId}, not ${userId}`);
      return { valid: false, reason: "ownership_mismatch" };
    }
    
    // Don't allow conversion of archived quotes
    if (row.archivedAt) {
      console.log(`[savedQuote.checkout] Quote ${quoteId} is archived`);
      return { valid: false, reason: "quote_archived" };
    }
    
    // Already converted - still valid for idempotent re-checkout, but log it
    if (row.convertedOrderId) {
      console.log(`[savedQuote.checkout] Quote ${quoteId} already converted to ${row.convertedOrderId}`);
      // Still return valid - allows re-purchasing same quote config
    }
    
    return {
      valid: true,
      userId,
      quoteId,
    };
  } catch (err) {
    console.error(`[savedQuote.checkout] Validation error:`, err);
    return { valid: false, reason: "validation_error" };
  }
}

// ============================================================================
// Conversion Tracking (called after order creation in webhook)
// ============================================================================

export interface ConversionResult {
  success: boolean;
  alreadyConverted?: boolean;
  conflictingOrder?: string;
  error?: string;
}

/**
 * Mark a saved quote as converted to an order.
 * 
 * Called from Stripe/PayPal webhook after successful order creation.
 * 
 * Idempotency:
 * - If quote is already converted to THIS order → success (no-op)
 * - If quote is already converted to a DIFFERENT order → conflict, do not overwrite
 * - If quote doesn't exist → log and return (don't fail webhook)
 * 
 * Failure safety:
 * - This is secondary bookkeeping - never fails the webhook
 * - Order processing continues even if conversion tracking fails
 * 
 * @param savedQuoteId - The saved quote ID from payment metadata
 * @param orderId - The WTD order ID just created
 * @param userId - Optional user ID for additional verification
 */
export async function markSavedQuoteConverted(
  savedQuoteId: string,
  orderId: string,
  userId?: string
): Promise<ConversionResult> {
  if (!savedQuoteId || !orderId) {
    return { success: false, error: "missing_params" };
  }
  
  try {
    // First, check current state for idempotency and conflict detection
    const existing = await db
      .select({
        id: savedQuotes.id,
        userId: savedQuotes.userId,
        convertedOrderId: savedQuotes.convertedOrderId,
        convertedAt: savedQuotes.convertedAt,
      })
      .from(savedQuotes)
      .where(eq(savedQuotes.id, savedQuoteId))
      .limit(1);
    
    if (existing.length === 0) {
      console.warn(`[savedQuote.conversion] Quote not found: ${savedQuoteId}`);
      return { success: false, error: "quote_not_found" };
    }
    
    const quote = existing[0];
    
    // Optional userId verification (defense in depth)
    if (userId && quote.userId !== userId) {
      console.error(`[savedQuote.conversion] OWNERSHIP MISMATCH at conversion: quote ${savedQuoteId} belongs to ${quote.userId}, not ${userId}`);
      return { success: false, error: "ownership_mismatch" };
    }
    
    // Already converted to THIS order - idempotent success
    if (quote.convertedOrderId === orderId) {
      console.log(`[savedQuote.conversion] Quote ${savedQuoteId} already converted to ${orderId} (idempotent)`);
      return { success: true, alreadyConverted: true };
    }
    
    // Already converted to a DIFFERENT order - CONFLICT
    if (quote.convertedOrderId && quote.convertedOrderId !== orderId) {
      console.error(`[savedQuote.conversion] CONFLICT: Quote ${savedQuoteId} already converted to ${quote.convertedOrderId}, refusing to overwrite with ${orderId}`);
      return { 
        success: false, 
        conflictingOrder: quote.convertedOrderId,
        error: "already_converted_to_different_order" 
      };
    }
    
    // Not yet converted - update it
    await db
      .update(savedQuotes)
      .set({
        convertedOrderId: orderId,
        convertedAt: new Date(),
      })
      .where(
        and(
          eq(savedQuotes.id, savedQuoteId),
          isNull(savedQuotes.convertedOrderId) // Double-check for race condition
        )
      );
    
    console.log(`[savedQuote.conversion] ✓ Quote ${savedQuoteId} converted to order ${orderId}`);
    return { success: true };
    
  } catch (err) {
    // CRITICAL: Never fail the webhook due to conversion tracking errors
    console.error(`[savedQuote.conversion] Error (non-fatal):`, err);
    return { success: false, error: String(err) };
  }
}
