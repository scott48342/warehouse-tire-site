/**
 * Saved Quote Service
 * 
 * Server-side operations for customer saved quotes.
 * 
 * Concurrency Safety:
 * - Database-backed idempotency via unique (user_id, idempotency_key) index
 * - Atomic 20-active-quote limit via pg_advisory_xact_lock + transaction
 * - Safe for Vercel serverless (no in-memory state)
 * 
 * @created 2026-08-24
 * @updated 2026-08-24 - Concurrency fixes
 */

import { db } from "@/lib/db";
import { savedQuotes } from "@/lib/auth-schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  SaveQuoteRequest,
  SavedQuoteResponse,
  SavedQuoteDetailResponse,
  SavedQuotesListResponse,
  SavedQuoteSnapshot,
} from "./types";
import { SAVED_QUOTE_LIMITS as LIMITS } from "./types";
import {
  validateVehicle,
  validateItems,
  verifyPricing,
  createSnapshot,
  validateSnapshotSize,
  buildItemSummary,
  ValidationError,
} from "./validation";

// ============================================================================
// JSONB Parsing Helper
// ============================================================================

/**
 * Parse saved quote snapshot from database.
 * 
 * PostgreSQL JSONB columns are automatically parsed to objects by the pg driver,
 * but some code paths may still have string values. This helper handles both cases.
 */
function parseSnapshotJson(value: unknown): SavedQuoteSnapshot {
  if (typeof value === "string") {
    return JSON.parse(value) as SavedQuoteSnapshot;
  }
  // Already parsed by pg driver (JSONB → object)
  return value as SavedQuoteSnapshot;
}

// ============================================================================
// ID Generation
// ============================================================================

export function generateSavedQuoteId(): string {
  return `sq_${nanoid(21)}`;
}

// ============================================================================
// Advisory Lock Key Generation
// ============================================================================

/**
 * Generate a consistent advisory lock key from user ID.
 * Uses a hash to convert UUID to bigint for pg_advisory_xact_lock.
 */
function userLockKey(userId: string): number {
  // Simple hash: sum of char codes with position weighting
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  // Ensure positive and in safe integer range
  return Math.abs(hash);
}

// ============================================================================
// Create Quote (Concurrency-Safe)
// ============================================================================

export type CreateQuoteResult = 
  | { ok: true; id: string; isIdempotent?: boolean }
  | { ok: false; error: string; code: string; field?: string };

/**
 * Create a saved quote with:
 * 1. Database-backed idempotency (unique constraint on user_id + idempotency_key)
 * 2. Atomic 20-active-quote limit (advisory lock + transaction)
 * 
 * Logic:
 * - If idempotency_key provided, check for existing quote first
 * - If found, return it (even if at limit)
 * - Otherwise, acquire per-user advisory lock
 * - Within lock: check count, insert if under limit
 * - Handle unique constraint conflict as idempotent success
 */
export async function createSavedQuote(
  userId: string,
  request: SaveQuoteRequest
): Promise<CreateQuoteResult> {
  try {
    // Validate inputs first (before any DB operations)
    const vehicle = validateVehicle(request.vehicle);
    const items = validateItems(request.items);
    
    // Build client prices map for consistency check
    const clientPrices: Record<string, number> = {};
    for (const item of request.items) {
      if (item.unitPrice != null && item.unitPrice > 0) {
        clientPrices[String(item.sku)] = Number(item.unitPrice);
      }
    }
    
    // Verify pricing using our commerce system (with client price consistency check)
    const { items: pricedItems, pricing } = await verifyPricing(items, vehicle, clientPrices);
    
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
    
    // Sanitize idempotency key
    const idempotencyKey = request.idempotencyKey?.trim().slice(0, 100) || null;
    
    // If idempotency key provided, check for existing quote FIRST
    // This handles the "retry after success" case even when at limit
    if (idempotencyKey) {
      const existing = await db
        .select({ id: savedQuotes.id })
        .from(savedQuotes)
        .where(
          and(
            eq(savedQuotes.userId, userId),
            eq(savedQuotes.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        return { ok: true, id: existing[0].id, isIdempotent: true };
      }
    }
    
    // Generate ID and name
    const id = generateSavedQuoteId();
    const name = request.name?.trim().slice(0, LIMITS.maxNameLength) || null;
    
    // Atomic creation with advisory lock for limit enforcement
    // Using raw SQL for the transaction with advisory lock
    const lockKey = userLockKey(userId);
    
    const result = await db.transaction(async (tx) => {
      // Acquire per-user advisory lock (released on transaction end)
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);
      
      // Check active quote count within the lock
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
        return { limitReached: true };
      }
      
      // Insert the new quote
      try {
        await tx.insert(savedQuotes).values({
          id,
          userId,
          name,
          vehicleYear: vehicle.year,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleTrim: vehicle.trim || null,
          vehicleModification: vehicle.modification || null,
          snapshotJson: snapshot, // JSONB - Drizzle handles serialization
          idempotencyKey,
        });
        
        return { success: true, id };
      } catch (insertError: any) {
        // Check for unique constraint violation (concurrent request with same key)
        if (insertError.code === '23505' && idempotencyKey) {
          // Unique violation on idempotency key - fetch the existing quote
          const existing = await tx
            .select({ id: savedQuotes.id })
            .from(savedQuotes)
            .where(
              and(
                eq(savedQuotes.userId, userId),
                eq(savedQuotes.idempotencyKey, idempotencyKey)
              )
            )
            .limit(1);
          
          if (existing.length > 0) {
            return { success: true, id: existing[0].id, isIdempotent: true };
          }
        }
        throw insertError;
      }
    });
    
    if ('limitReached' in result) {
      return {
        ok: false,
        error: `Maximum ${LIMITS.maxActiveQuotes} saved quotes allowed`,
        code: "limit_reached",
      };
    }
    
    return { 
      ok: true, 
      id: result.id, 
      isIdempotent: result.isIdempotent 
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
    
    console.error("[savedQuoteService] Create error:", error);
    return {
      ok: false,
      error: "Failed to save quote",
      code: "internal_error",
    };
  }
}

// ============================================================================
// List Quotes
// ============================================================================

export async function listSavedQuotes(
  userId: string,
  includeArchived = false
): Promise<SavedQuotesListResponse> {
  const whereClause = includeArchived
    ? eq(savedQuotes.userId, userId)
    : and(eq(savedQuotes.userId, userId), isNull(savedQuotes.archivedAt));
  
  const rows = await db
    .select()
    .from(savedQuotes)
    .where(whereClause)
    .orderBy(desc(savedQuotes.savedAt));
  
  const quotes: SavedQuoteResponse[] = rows.map(row => {
    const snapshot = parseSnapshotJson(row.snapshotJson);
    
    return {
      id: row.id,
      name: row.name,
      vehicle: snapshot.vehicle,
      itemCount: snapshot.items.length,
      itemSummary: snapshot.itemSummary || buildItemSummary(snapshot.items),
      total: snapshot.pricing.total,
      savedAt: row.savedAt.toISOString(),
      lastViewedAt: row.lastViewedAt?.toISOString() || null,
      convertedOrderId: row.convertedOrderId,
      convertedAt: row.convertedAt?.toISOString() || null,
      isArchived: row.archivedAt !== null,
    };
  });
  
  return {
    quotes,
    count: quotes.length,
    maxQuotes: LIMITS.maxActiveQuotes,
  };
}

// ============================================================================
// Get Quote
// ============================================================================

export async function getSavedQuote(
  userId: string,
  quoteId: string,
  updateViewed = false
): Promise<SavedQuoteDetailResponse | null> {
  const rows = await db
    .select()
    .from(savedQuotes)
    .where(
      and(
        eq(savedQuotes.id, quoteId),
        eq(savedQuotes.userId, userId)
      )
    )
    .limit(1);
  
  const row = rows[0];
  if (!row) return null;
  
  // Update last viewed if requested
  if (updateViewed) {
    await db
      .update(savedQuotes)
      .set({ lastViewedAt: new Date() })
      .where(eq(savedQuotes.id, quoteId));
  }
  
  const snapshot = parseSnapshotJson(row.snapshotJson);
  
  return {
    id: row.id,
    name: row.name,
    vehicle: snapshot.vehicle,
    itemCount: snapshot.items.length,
    itemSummary: snapshot.itemSummary || buildItemSummary(snapshot.items),
    total: snapshot.pricing.total,
    savedAt: row.savedAt.toISOString(),
    lastViewedAt: row.lastViewedAt?.toISOString() || null,
    convertedOrderId: row.convertedOrderId,
    convertedAt: row.convertedAt?.toISOString() || null,
    isArchived: row.archivedAt !== null,
    snapshot,
  };
}

// ============================================================================
// Update Quote
// ============================================================================

export type UpdateQuoteResult = 
  | { ok: true }
  | { ok: false; error: string; code: string };

export async function updateSavedQuote(
  userId: string,
  quoteId: string,
  updates: { name?: string | null }
): Promise<UpdateQuoteResult> {
  // Verify ownership first
  const existing = await db
    .select({ id: savedQuotes.id })
    .from(savedQuotes)
    .where(
      and(
        eq(savedQuotes.id, quoteId),
        eq(savedQuotes.userId, userId)
      )
    )
    .limit(1);
  
  if (existing.length === 0) {
    return { ok: false, error: "Quote not found", code: "not_found" };
  }
  
  const updateData: { name?: string | null } = {};
  
  if ("name" in updates) {
    updateData.name = updates.name?.trim().slice(0, LIMITS.maxNameLength) || null;
  }
  
  if (Object.keys(updateData).length > 0) {
    await db
      .update(savedQuotes)
      .set(updateData)
      .where(eq(savedQuotes.id, quoteId));
  }
  
  return { ok: true };
}

// ============================================================================
// Archive Quote (Soft Delete)
// ============================================================================

export async function archiveSavedQuote(
  userId: string,
  quoteId: string
): Promise<UpdateQuoteResult> {
  // Verify ownership first
  const existing = await db
    .select({ id: savedQuotes.id })
    .from(savedQuotes)
    .where(
      and(
        eq(savedQuotes.id, quoteId),
        eq(savedQuotes.userId, userId)
      )
    )
    .limit(1);
  
  if (existing.length === 0) {
    return { ok: false, error: "Quote not found", code: "not_found" };
  }
  
  await db
    .update(savedQuotes)
    .set({ archivedAt: new Date() })
    .where(eq(savedQuotes.id, quoteId));
  
  return { ok: true };
}

// ============================================================================
// Delete Quote (Permanent - Admin/API only)
// ============================================================================

export async function deleteSavedQuote(
  userId: string,
  quoteId: string
): Promise<UpdateQuoteResult> {
  const result = await db
    .delete(savedQuotes)
    .where(
      and(
        eq(savedQuotes.id, quoteId),
        eq(savedQuotes.userId, userId)
      )
    );
  
  // Check if any rows were deleted
  const remaining = await db
    .select({ id: savedQuotes.id })
    .from(savedQuotes)
    .where(eq(savedQuotes.id, quoteId))
    .limit(1);
  
  // If quote still exists, it wasn't owned by this user
  if (remaining.length > 0) {
    return { ok: false, error: "Quote not found", code: "not_found" };
  }
  
  return { ok: true };
}

// ============================================================================
// Mark Converted (called after order creation)
// ============================================================================

/**
 * Idempotently mark a saved quote as converted to an order.
 * 
 * Security: Requires userId to verify ownership.
 * Called from server-side order creation, not from client.
 */
export async function markQuoteConverted(
  quoteId: string,
  orderId: string,
  userId: string
): Promise<boolean> {
  // Only update if:
  // 1. Quote exists and belongs to user
  // 2. Not already converted (idempotent)
  await db
    .update(savedQuotes)
    .set({
      convertedOrderId: orderId,
      convertedAt: new Date(),
    })
    .where(
      and(
        eq(savedQuotes.id, quoteId),
        eq(savedQuotes.userId, userId),
        isNull(savedQuotes.convertedOrderId)
      )
    );
  
  return true; // Idempotent - success even if already converted
}
