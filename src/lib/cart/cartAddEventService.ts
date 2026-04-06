/**
 * Cart Add Event Service
 * 
 * Tracks add-to-cart events for product popularity analytics.
 * Separate from abandoned cart tracking - this is purely for
 * business insight into what products customers are interested in.
 * 
 * Key features:
 * - Lightweight, append-only tracking
 * - Test data detection and exclusion
 * - Purchase tracking (links cart events to orders)
 * - Aggregated reporting queries
 * 
 * @created 2026-04-05
 */

import { db } from "@/lib/fitment-db/db";
import { cartAddEvents, type CartAddEvent, type NewCartAddEvent } from "@/lib/fitment-db/schema";
import { eq, and, desc, sql, count, or, gte, isNull } from "drizzle-orm";
import { detectTestData, type TestDetectionContext } from "@/lib/testData";

// ============================================================================
// Types
// ============================================================================

export type ProductType = "tire" | "wheel";

export interface CartAddEventData {
  productType: ProductType;
  sku: string;
  rearSku?: string;
  productName: string;
  brand: string;
  priceAtTime: number;
  quantity: number;
  size?: string;
  specs?: Record<string, unknown>;
  cartId: string;
  sessionId?: string;
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  source?: string; // pdp, package, search, etc.
  referrer?: string;
  ipAddress?: string;
  userAgent?: string;
  // Test context for detection
  testContext?: Partial<TestDetectionContext>;
  // Explicit test marking
  isTest?: boolean;
  testReason?: string;
}

export interface ProductPopularityRow {
  sku: string;
  productName: string;
  brand: string;
  latestPrice: number;
  addToCartCount: number;
  uniqueCarts: number;
  purchasedCount: number;
  conversionRate: number;
  lastAddedAt: Date;
}

export interface PopularityReport {
  productType: ProductType;
  period: string;
  products: ProductPopularityRow[];
  total: number;
}

// ============================================================================
// Core Tracking
// ============================================================================

/**
 * Track an add-to-cart event
 * 
 * Designed to be lightweight and non-blocking for the cart experience.
 * Returns immediately after inserting; errors are logged but don't throw.
 */
export async function trackAddToCart(data: CartAddEventData): Promise<CartAddEvent | null> {
  try {
    // Detect test data
    let isTest = data.isTest || false;
    let testReason = data.testReason || null;

    if (!isTest && data.testContext) {
      const testDetection = detectTestData(data.testContext);
      if (testDetection.isTest) {
        isTest = true;
        testReason = testDetection.reason;
      }
    }

    const [event] = await db
      .insert(cartAddEvents)
      .values({
        productType: data.productType,
        sku: data.sku,
        rearSku: data.rearSku,
        productName: data.productName,
        brand: data.brand,
        priceAtTime: String(data.priceAtTime),
        quantity: data.quantity,
        size: data.size,
        specs: data.specs,
        cartId: data.cartId,
        sessionId: data.sessionId,
        vehicleYear: data.vehicle?.year,
        vehicleMake: data.vehicle?.make,
        vehicleModel: data.vehicle?.model,
        vehicleTrim: data.vehicle?.trim,
        source: data.source,
        referrer: data.referrer,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        isTest,
        testReason,
      })
      .returning();

    return event;
  } catch (err) {
    // Log but don't throw - tracking should never break user experience
    console.error("[CartAddEvent] Failed to track event:", err);
    return null;
  }
}

/**
 * Track multiple add-to-cart events (batch insert)
 */
export async function trackAddToCartBatch(events: CartAddEventData[]): Promise<number> {
  if (events.length === 0) return 0;

  try {
    const values = events.map((data) => {
      let isTest = data.isTest || false;
      let testReason = data.testReason || null;

      if (!isTest && data.testContext) {
        const testDetection = detectTestData(data.testContext);
        if (testDetection.isTest) {
          isTest = true;
          testReason = testDetection.reason;
        }
      }

      return {
        productType: data.productType,
        sku: data.sku,
        rearSku: data.rearSku,
        productName: data.productName,
        brand: data.brand,
        priceAtTime: String(data.priceAtTime),
        quantity: data.quantity,
        size: data.size,
        specs: data.specs,
        cartId: data.cartId,
        sessionId: data.sessionId,
        vehicleYear: data.vehicle?.year,
        vehicleMake: data.vehicle?.make,
        vehicleModel: data.vehicle?.model,
        vehicleTrim: data.vehicle?.trim,
        source: data.source,
        referrer: data.referrer,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        isTest,
        testReason,
      };
    });

    const result = await db.insert(cartAddEvents).values(values);
    return (result as any).rowCount || values.length;
  } catch (err) {
    console.error("[CartAddEvent] Failed to batch track:", err);
    return 0;
  }
}

// ============================================================================
// Purchase Tracking
// ============================================================================

/**
 * Mark cart events as purchased when an order is completed
 * 
 * Call this from order completion to link add-to-cart events to purchases.
 */
export async function markCartEventsPurchased(
  cartId: string,
  orderId: string
): Promise<number> {
  try {
    const result = await db
      .update(cartAddEvents)
      .set({
        purchased: true,
        orderId,
        purchasedAt: new Date(),
      })
      .where(
        and(
          eq(cartAddEvents.cartId, cartId),
          eq(cartAddEvents.purchased, false)
        )
      );

    const count = (result as any).rowCount || 0;
    if (count > 0) {
      console.log(`[CartAddEvent] Marked ${count} events as purchased for cart ${cartId}`);
    }
    return count;
  } catch (err) {
    console.error("[CartAddEvent] Failed to mark purchased:", err);
    return 0;
  }
}

// ============================================================================
// Reporting Queries
// ============================================================================

/**
 * Get top products by add-to-cart count
 * 
 * Excludes test data by default.
 */
export async function getTopProducts(options: {
  productType: ProductType;
  limit?: number;
  offset?: number;
  /** Days to look back (default: 30) */
  days?: number;
  /** Include test data (default: false) */
  includeTest?: boolean;
  /** Filter by brand */
  brand?: string;
}): Promise<PopularityReport> {
  const {
    productType,
    limit = 50,
    offset = 0,
    days = 30,
    includeTest = false,
    brand,
  } = options;

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Build conditions
  const conditions: any[] = [
    eq(cartAddEvents.productType, productType),
    gte(cartAddEvents.createdAt, cutoffDate),
  ];

  if (!includeTest) {
    conditions.push(eq(cartAddEvents.isTest, false));
  }

  if (brand) {
    conditions.push(eq(cartAddEvents.brand, brand));
  }

  // Aggregation query
  const results = await db
    .select({
      sku: cartAddEvents.sku,
      productName: sql<string>`MAX(${cartAddEvents.productName})`,
      brand: sql<string>`MAX(${cartAddEvents.brand})`,
      latestPrice: sql<number>`(
        SELECT ${cartAddEvents.priceAtTime} 
        FROM ${cartAddEvents} AS inner_t 
        WHERE inner_t.sku = ${cartAddEvents.sku} 
        ORDER BY inner_t.created_at DESC 
        LIMIT 1
      )::numeric`,
      addToCartCount: sql<number>`SUM(${cartAddEvents.quantity})::int`,
      uniqueCarts: sql<number>`COUNT(DISTINCT ${cartAddEvents.cartId})::int`,
      purchasedCount: sql<number>`SUM(CASE WHEN ${cartAddEvents.purchased} THEN ${cartAddEvents.quantity} ELSE 0 END)::int`,
      lastAddedAt: sql<Date>`MAX(${cartAddEvents.createdAt})`,
    })
    .from(cartAddEvents)
    .where(and(...conditions))
    .groupBy(cartAddEvents.sku)
    .orderBy(desc(sql`SUM(${cartAddEvents.quantity})`))
    .limit(limit)
    .offset(offset);

  // Get total count for pagination
  const [countResult] = await db
    .select({
      total: sql<number>`COUNT(DISTINCT ${cartAddEvents.sku})::int`,
    })
    .from(cartAddEvents)
    .where(and(...conditions));

  const products: ProductPopularityRow[] = results.map((row) => ({
    sku: row.sku,
    productName: row.productName,
    brand: row.brand,
    latestPrice: Number(row.latestPrice) || 0,
    addToCartCount: Number(row.addToCartCount) || 0,
    uniqueCarts: Number(row.uniqueCarts) || 0,
    purchasedCount: Number(row.purchasedCount) || 0,
    conversionRate:
      row.addToCartCount > 0
        ? Math.round((Number(row.purchasedCount) / Number(row.addToCartCount)) * 100)
        : 0,
    lastAddedAt: row.lastAddedAt,
  }));

  return {
    productType,
    period: `${days} days`,
    products,
    total: Number(countResult?.total) || 0,
  };
}

/**
 * Get summary stats for dashboard
 */
export async function getCartEventStats(options?: {
  days?: number;
  includeTest?: boolean;
}): Promise<{
  totalEvents: number;
  tireEvents: number;
  wheelEvents: number;
  purchasedEvents: number;
  uniqueProducts: number;
  uniqueCarts: number;
  topBrands: { brand: string; count: number }[];
}> {
  const days = options?.days || 30;
  const includeTest = options?.includeTest || false;

  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const conditions: any[] = [gte(cartAddEvents.createdAt, cutoffDate)];
  if (!includeTest) {
    conditions.push(eq(cartAddEvents.isTest, false));
  }

  // Main stats
  const [stats] = await db
    .select({
      totalEvents: sql<number>`COUNT(*)::int`,
      tireEvents: sql<number>`SUM(CASE WHEN ${cartAddEvents.productType} = 'tire' THEN 1 ELSE 0 END)::int`,
      wheelEvents: sql<number>`SUM(CASE WHEN ${cartAddEvents.productType} = 'wheel' THEN 1 ELSE 0 END)::int`,
      purchasedEvents: sql<number>`SUM(CASE WHEN ${cartAddEvents.purchased} THEN 1 ELSE 0 END)::int`,
      uniqueProducts: sql<number>`COUNT(DISTINCT ${cartAddEvents.sku})::int`,
      uniqueCarts: sql<number>`COUNT(DISTINCT ${cartAddEvents.cartId})::int`,
    })
    .from(cartAddEvents)
    .where(and(...conditions));

  // Top brands
  const brandResults = await db
    .select({
      brand: cartAddEvents.brand,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(cartAddEvents)
    .where(and(...conditions))
    .groupBy(cartAddEvents.brand)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  return {
    totalEvents: Number(stats?.totalEvents) || 0,
    tireEvents: Number(stats?.tireEvents) || 0,
    wheelEvents: Number(stats?.wheelEvents) || 0,
    purchasedEvents: Number(stats?.purchasedEvents) || 0,
    uniqueProducts: Number(stats?.uniqueProducts) || 0,
    uniqueCarts: Number(stats?.uniqueCarts) || 0,
    topBrands: brandResults.map((r) => ({
      brand: r.brand,
      count: Number(r.count),
    })),
  };
}

/**
 * Get list of unique brands for filtering
 */
export async function getBrands(productType: ProductType): Promise<string[]> {
  const results = await db
    .selectDistinct({ brand: cartAddEvents.brand })
    .from(cartAddEvents)
    .where(
      and(
        eq(cartAddEvents.productType, productType),
        eq(cartAddEvents.isTest, false)
      )
    )
    .orderBy(cartAddEvents.brand);

  return results.map((r) => r.brand);
}

// ============================================================================
// Export
// ============================================================================

export const cartAddEventService = {
  trackAddToCart,
  trackAddToCartBatch,
  markCartEventsPurchased,
  getTopProducts,
  getCartEventStats,
  getBrands,
};

export default cartAddEventService;
