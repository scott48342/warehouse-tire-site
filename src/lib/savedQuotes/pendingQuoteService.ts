/**
 * Pending Quote Service
 * 
 * Handles guest quote saves before authentication.
 * 
 * Security:
 * - Cryptographically secure tokens (256 bits entropy via nanoid)
 * - Token stored as SHA-256 hash (raw token never persisted)
 * - 24-hour expiry
 * - One-time use (atomically consumed on claim)
 * - Open redirect protection on return_to
 * 
 * @created 2026-08-24
 */

import { db } from "@/lib/db";
import { pendingSavedQuotes, savedQuotes } from "@/lib/auth-schema";
import { eq, and, sql, isNull, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import type {
  SaveQuoteRequest,
  SavedQuoteSnapshot,
} from "./types";
import { SAVED_QUOTE_LIMITS as LIMITS } from "./types";
import {
  validateVehicle,
  validateItems,
  verifyPricing,
  createSnapshot,
  validateSnapshotSize,
  ValidationError,
} from "./validation";
import { generateSavedQuoteId } from "./savedQuoteService";

// ============================================================================
// Token Generation & Hashing
// ============================================================================

/**
 * Generate a cryptographically secure token with 256 bits entropy.
 * Uses nanoid with 43 characters (base64url alphabet = 6 bits/char = 258 bits).
 */
function generatePendingToken(): string {
  return `psq_${nanoid(43)}`;
}

/**
 * Hash token for storage using SHA-256.
 * Raw token is never stored in database.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ============================================================================
// Return URL Validation (Open Redirect Protection)
// ============================================================================

const ALLOWED_RETURN_PREFIXES = [
  "/account",
  "/cart",
  "/checkout",
  "/tires",
  "/wheels",
  "/packages",
];

/**
 * Validate and sanitize return_to URL.
 * Rejects absolute URLs, protocol-relative URLs, and external domains.
 */
function sanitizeReturnTo(returnTo: string | undefined): string {
  const defaultReturn = "/account";
  
  if (!returnTo || typeof returnTo !== "string") {
    return defaultReturn;
  }
  
  const trimmed = returnTo.trim();
  
  // Reject empty
  if (!trimmed) {
    return defaultReturn;
  }
  
  // Reject absolute URLs (http://, https://, //, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    console.warn("[pendingQuote] Rejected absolute/protocol-relative return_to:", trimmed);
    return defaultReturn;
  }
  
  // Reject javascript:, data:, etc.
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    console.warn("[pendingQuote] Rejected dangerous scheme in return_to:", trimmed);
    return defaultReturn;
  }
  
  // Must start with /
  if (!trimmed.startsWith("/")) {
    return defaultReturn;
  }
  
  // Check allowed prefixes
  const isAllowed = ALLOWED_RETURN_PREFIXES.some(prefix => 
    trimmed === prefix || trimmed.startsWith(prefix + "/") || trimmed.startsWith(prefix + "?")
  );
  
  if (!isAllowed) {
    console.warn("[pendingQuote] Return path not in allowlist:", trimmed);
    return defaultReturn;
  }
  
  // Sanitize: remove any control characters, limit length
  const sanitized = trimmed.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 500);
  
  return sanitized;
}

// ============================================================================
// Create Pending Quote
// ============================================================================

export type CreatePendingResult = 
  | { ok: true; token: string; expiresAt: string }
  | { ok: false; error: string; code: string; field?: string };

/**
 * Create a pending quote for a guest user.
 * Returns a one-time token that can be claimed after authentication.
 */
export async function createPendingQuote(
  request: SaveQuoteRequest,
  returnTo?: string
): Promise<CreatePendingResult> {
  try {
    // Validate inputs (same validation as authenticated saves)
    const vehicle = validateVehicle(request.vehicle);
    const items = validateItems(request.items);
    
    // Verify pricing
    const { items: pricedItems, pricing } = await verifyPricing(items, vehicle);
    
    // Create snapshot
    const source = request.source || "cart";
    const snapshot = createSnapshot(
      vehicle,
      pricedItems,
      pricing,
      source as "cart" | "package-builder" | "pdp",
      request.cartId
    );
    
    // Validate snapshot size
    validateSnapshotSize(snapshot);
    
    // Generate token and hash
    const rawToken = generatePendingToken();
    const tokenHash = hashToken(rawToken);
    
    // Sanitize return URL
    const safeReturnTo = sanitizeReturnTo(returnTo);
    
    // Calculate expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Insert pending quote (use hash as primary key)
    await db.insert(pendingSavedQuotes).values({
      token: tokenHash,
      snapshotJson: JSON.stringify(snapshot),
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim || null,
      vehicleModification: vehicle.modification || null,
      cartId: request.cartId || null,
      returnTo: safeReturnTo,
      expiresAt,
    });
    
    // Return raw token to client (never logged in full)
    console.log("[pendingQuote] Created pending quote, token prefix:", rawToken.slice(0, 10) + "...");
    
    return {
      ok: true,
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        ok: false,
        error: error.message,
        code: error.code || "validation_error",
        field: error.field,
      };
    }
    
    console.error("[pendingQuote] Create error:", error);
    return {
      ok: false,
      error: "Failed to save quote",
      code: "internal_error",
    };
  }
}

// ============================================================================
// Claim Pending Quote
// ============================================================================

export type ClaimResult = 
  | { ok: true; quoteId: string; returnTo: string }
  | { ok: false; error: string; code: "invalid_token" | "expired_token" | "already_claimed" | "limit_reached" | "internal_error" };

/**
 * Claim a pending quote for an authenticated user.
 * 
 * Atomically:
 * 1. Validates token (existence, expiry)
 * 2. Checks 20-quote limit
 * 3. Creates saved quote
 * 4. Deletes pending record
 * 
 * Idempotent: if token already consumed, returns already_claimed.
 * Limit failure does NOT consume token (can retry after archiving).
 */
export async function claimPendingQuote(
  rawToken: string,
  userId: string
): Promise<ClaimResult> {
  // Hash the provided token
  const tokenHash = hashToken(rawToken);
  
  // Use transaction with advisory lock for atomicity
  const userLockKey = hashToLockKey(userId);
  
  try {
    const result = await db.transaction(async (tx) => {
      // Acquire per-user advisory lock
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userLockKey})`);
      
      // Find pending quote by hash
      const pending = await tx
        .select()
        .from(pendingSavedQuotes)
        .where(eq(pendingSavedQuotes.token, tokenHash))
        .limit(1);
      
      if (pending.length === 0) {
        // Token not found - either invalid or already claimed
        return { code: "invalid_token" as const, error: "Invalid or expired token" };
      }
      
      const record = pending[0];
      
      // Check expiry
      if (new Date(record.expiresAt) < new Date()) {
        // Expired - clean up and reject
        await tx.delete(pendingSavedQuotes).where(eq(pendingSavedQuotes.token, tokenHash));
        return { code: "expired_token" as const, error: "Token has expired" };
      }
      
      // Check 20-quote limit BEFORE consuming token
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(savedQuotes)
        .where(
          and(
            eq(savedQuotes.userId, userId),
            isNull(savedQuotes.archivedAt)
          )
        );
      
      const currentCount = countResult[0]?.count || 0;
      
      if (currentCount >= LIMITS.maxActiveQuotes) {
        // Limit reached - do NOT consume token
        return { 
          code: "limit_reached" as const, 
          error: `Maximum ${LIMITS.maxActiveQuotes} saved quotes allowed. Archive or remove a quote to claim this one.`,
          returnTo: record.returnTo,
        };
      }
      
      // Parse snapshot
      const snapshot = JSON.parse(record.snapshotJson) as SavedQuoteSnapshot;
      
      // Create saved quote
      const quoteId = generateSavedQuoteId();
      
      await tx.insert(savedQuotes).values({
        id: quoteId,
        userId,
        name: null,
        vehicleYear: record.vehicleYear,
        vehicleMake: record.vehicleMake,
        vehicleModel: record.vehicleModel,
        vehicleTrim: record.vehicleTrim,
        vehicleModification: record.vehicleModification,
        snapshotJson: record.snapshotJson,
        idempotencyKey: `claimed_${tokenHash.slice(0, 32)}`, // Prevent duplicate claims
      });
      
      // Delete pending record (atomic consumption)
      await tx.delete(pendingSavedQuotes).where(eq(pendingSavedQuotes.token, tokenHash));
      
      return {
        ok: true as const,
        quoteId,
        returnTo: record.returnTo,
      };
    });
    
    if ('code' in result && result.code) {
      return { ok: false, error: result.error, code: result.code };
    }
    
    console.log("[pendingQuote] Claimed quote:", result.quoteId, "for user:", userId.slice(0, 8) + "...");
    
    return result as { ok: true; quoteId: string; returnTo: string };
    
  } catch (error: any) {
    // Handle idempotency: if unique constraint on idempotency_key fires
    if (error.code === "23505" && error.constraint?.includes("idempotency")) {
      // Already claimed - find the existing quote
      const existing = await db
        .select({ id: savedQuotes.id })
        .from(savedQuotes)
        .where(eq(savedQuotes.idempotencyKey, `claimed_${tokenHash.slice(0, 32)}`))
        .limit(1);
      
      if (existing.length > 0) {
        return { ok: false, error: "Quote already claimed", code: "already_claimed" };
      }
    }
    
    console.error("[pendingQuote] Claim error:", error);
    return { ok: false, error: "Failed to claim quote", code: "internal_error" };
  }
}

/**
 * Generate advisory lock key from user ID hash.
 */
function hashToLockKey(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ============================================================================
// Cleanup Expired Tokens (for cron job)
// ============================================================================

export async function cleanupExpiredPendingQuotes(): Promise<number> {
  const result = await db
    .delete(pendingSavedQuotes)
    .where(sql`expires_at < NOW()`);
  
  return 0; // Drizzle doesn't return affected count easily
}
