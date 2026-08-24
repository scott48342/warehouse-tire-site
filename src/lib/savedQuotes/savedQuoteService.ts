/**
 * Saved Quote Service
 * 
 * Server-side operations for customer saved quotes.
 * 
 * @created 2026-08-24
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
  SAVED_QUOTE_LIMITS,
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
// ID Generation
// ============================================================================

export function generateSavedQuoteId(): string {
  return `sq_${nanoid(21)}`;
}

// ============================================================================
// Idempotency
// ============================================================================

// In-memory cache for idempotency (would be Redis in production)
const idempotencyCache = new Map<string, { quoteId: string; expiresAt: number }>();

function getIdempotencyKey(userId: string, clientKey?: string): string | null {
  if (!clientKey) return null;
  return `${userId}:${clientKey}`;
}

function checkIdempotency(key: string): string | null {
  const cached = idempotencyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quoteId;
  }
  if (cached) {
    idempotencyCache.delete(key);
  }
  return null;
}

function setIdempotency(key: string, quoteId: string): void {
  idempotencyCache.set(key, {
    quoteId,
    expiresAt: Date.now() + LIMITS.idempotencyWindowMs,
  });
  
  // Clean up old entries periodically
  if (idempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of idempotencyCache) {
      if (v.expiresAt <= now) {
        idempotencyCache.delete(k);
      }
    }
  }
}

// ============================================================================
// Create Quote
// ============================================================================

export type CreateQuoteResult = 
  | { ok: true; id: string; isIdempotent?: boolean }
  | { ok: false; error: string; code: string; field?: string };

export async function createSavedQuote(
  userId: string,
  request: SaveQuoteRequest
): Promise<CreateQuoteResult> {
  try {
    // Check idempotency first
    const idempotencyKey = getIdempotencyKey(userId, request.idempotencyKey);
    if (idempotencyKey) {
      const existingId = checkIdempotency(idempotencyKey);
      if (existingId) {
        return { ok: true, id: existingId, isIdempotent: true };
      }
    }
    
    // Check quote limit
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedQuotes)
      .where(
        and(
          eq(savedQuotes.userId, userId),
          isNull(savedQuotes.archivedAt)
        )
      );
    
    const currentCount = Number(countResult[0]?.count || 0);
    if (currentCount >= LIMITS.maxActiveQuotes) {
      return {
        ok: false,
        error: `Maximum ${LIMITS.maxActiveQuotes} saved quotes allowed`,
        code: "limit_reached",
      };
    }
    
    // Validate vehicle
    const vehicle = validateVehicle(request.vehicle);
    
    // Validate items
    const items = validateItems(request.items);
    
    // Verify pricing using our commerce system
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
    
    // Generate ID and save
    const id = generateSavedQuoteId();
    const name = request.name?.trim().slice(0, LIMITS.maxNameLength) || null;
    
    await db.insert(savedQuotes).values({
      id,
      userId,
      name,
      vehicleYear: vehicle.year,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleTrim: vehicle.trim || null,
      vehicleModification: vehicle.modification || null,
      snapshotJson: JSON.stringify(snapshot),
    });
    
    // Set idempotency cache
    if (idempotencyKey) {
      setIdempotency(idempotencyKey, id);
    }
    
    return { ok: true, id };
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
    const snapshot = JSON.parse(row.snapshotJson) as SavedQuoteSnapshot;
    
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
  
  const snapshot = JSON.parse(row.snapshotJson) as SavedQuoteSnapshot;
  
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
// Delete Quote (Permanent)
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
  // Note: Drizzle doesn't return rowCount directly, so we check existence first
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
  const result = await db
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
