/**
 * Fitment Gap Tracker
 * 
 * Tracks requests for vehicles missing from the WTD fitment database.
 * This data helps:
 * 1. Prioritize which vehicles to add to the database
 * 2. Understand lost revenue opportunities
 * 3. Monitor fallback system effectiveness
 * 
 * @created 2026-05-20
 */

import { getDbPool } from "@/lib/db/pool";

// ============================================================================
// TYPES
// ============================================================================

export interface FitmentGapEvent {
  year: number;
  make: string;
  model: string;
  trim?: string;
  sessionId?: string;
  conversationId?: string;
  source: string;         // "jake" | "api" | "widget" | "direct"
  action?: string;        // "lookup" | "search_tires" | "search_wheels" | "cart_created"
  fallbackResult: {
    success: boolean;
    confidence: string;   // "high" | "medium" | "low" | "unknown"
    source: string;       // "curated_oem" | "platform_inference" | "era_common" | "customer_verify"
    hasBoltPattern: boolean;
    hasTireSizes: boolean;
  };
}

export interface FitmentGapSummary {
  vehicleKey: string;     // "Cadillac|DTS"
  year: number;
  make: string;
  model: string;
  requestCount: number;
  uniqueSessions: number;
  lastRequested: Date;
  firstRequested: Date;
  fallbackSuccessRate: number;
  searchAttempts: number;
  cartCreated: number;
  estimatedLostRevenue?: number;
}

// ============================================================================
// TRACKING FUNCTIONS
// ============================================================================

/**
 * Track a fitment gap event
 */
export async function trackFitmentGap(event: FitmentGapEvent): Promise<void> {
  const pool = getDbPool();
  if (!pool) {
    console.warn("[fitment-gap-tracker] No database connection available");
    return;
  }
  
  try {
    // Insert into fitment_gaps table
    await pool.query(
      `INSERT INTO fitment_gaps (
        year, make, model, trim, session_id, conversation_id,
        source, action, fallback_success, fallback_confidence,
        fallback_source, has_bolt_pattern, has_tire_sizes,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )`,
      [
        event.year,
        event.make,
        event.model,
        event.trim || null,
        event.sessionId || null,
        event.conversationId || null,
        event.source,
        event.action || "lookup",
        event.fallbackResult.success,
        event.fallbackResult.confidence,
        event.fallbackResult.source,
        event.fallbackResult.hasBoltPattern,
        event.fallbackResult.hasTireSizes,
      ]
    );
    
    // Also update the summary table for quick aggregation
    await updateGapSummary(pool, event);
  } catch (error) {
    // Don't throw - analytics should never break the user flow
    console.error("[fitment-gap-tracker] Failed to track:", error);
  }
}

/**
 * Update the fitment gap summary table (upsert)
 */
async function updateGapSummary(pool: any, event: FitmentGapEvent): Promise<void> {
  const vehicleKey = `${event.make}|${event.model}`;
  
  try {
    await pool.query(
      `INSERT INTO fitment_gap_summary (
        vehicle_key, year, make, model,
        request_count, unique_sessions, first_requested, last_requested,
        fallback_success_count, search_attempts, cart_created
      ) VALUES (
        $1, $2, $3, $4, 1, 1, NOW(), NOW(),
        $5, $6, $7
      )
      ON CONFLICT (vehicle_key, year) DO UPDATE SET
        request_count = fitment_gap_summary.request_count + 1,
        last_requested = NOW(),
        fallback_success_count = fitment_gap_summary.fallback_success_count + EXCLUDED.fallback_success_count,
        search_attempts = fitment_gap_summary.search_attempts + EXCLUDED.search_attempts,
        cart_created = fitment_gap_summary.cart_created + EXCLUDED.cart_created`,
      [
        vehicleKey,
        event.year,
        event.make,
        event.model,
        event.fallbackResult.success ? 1 : 0,
        event.action === "search_tires" || event.action === "search_wheels" ? 1 : 0,
        event.action === "cart_created" ? 1 : 0,
      ]
    );
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to update summary:", error);
  }
}

/**
 * Track a search attempt using fallback data
 */
export async function trackFallbackSearch(
  vehicleKey: string,
  sessionId: string,
  searchType: "tires" | "wheels",
  resultsFound: number
): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  
  try {
    await pool.query(
      `INSERT INTO fitment_gap_searches (
        vehicle_key, session_id, search_type, results_found, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [vehicleKey, sessionId, searchType, resultsFound]
    );
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to track search:", error);
  }
}

/**
 * Track cart creation from fallback flow
 */
export async function trackFallbackCart(
  vehicleKey: string,
  sessionId: string,
  cartValue: number,
  itemCount: number
): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  
  try {
    await pool.query(
      `INSERT INTO fitment_gap_carts (
        vehicle_key, session_id, cart_value, item_count, created_at
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [vehicleKey, sessionId, cartValue, itemCount]
    );
    
    // Update the summary with revenue tracking
    await pool.query(
      `UPDATE fitment_gap_summary 
       SET estimated_revenue = COALESCE(estimated_revenue, 0) + $2
       WHERE vehicle_key = $1`,
      [vehicleKey, cartValue]
    );
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to track cart:", error);
  }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get the top missing vehicles by request count
 */
export async function getTopMissingVehicles(
  limit: number = 20,
  days: number = 30
): Promise<FitmentGapSummary[]> {
  const pool = getDbPool();
  if (!pool) return [];
  
  try {
    const result = await pool.query(
      `SELECT 
        vehicle_key,
        year,
        make,
        model,
        request_count,
        unique_sessions,
        first_requested,
        last_requested,
        CASE WHEN request_count > 0 
          THEN ROUND(fallback_success_count::numeric / request_count * 100, 1)
          ELSE 0 
        END as fallback_success_rate,
        search_attempts,
        cart_created,
        estimated_revenue as estimated_lost_revenue
      FROM fitment_gap_summary
      WHERE last_requested > NOW() - INTERVAL '1 day' * $2
      ORDER BY request_count DESC
      LIMIT $1`,
      [limit, days]
    );
    
    return result.rows.map((row: any) => ({
      vehicleKey: row.vehicle_key,
      year: row.year,
      make: row.make,
      model: row.model,
      requestCount: parseInt(row.request_count),
      uniqueSessions: parseInt(row.unique_sessions),
      firstRequested: row.first_requested,
      lastRequested: row.last_requested,
      fallbackSuccessRate: parseFloat(row.fallback_success_rate),
      searchAttempts: parseInt(row.search_attempts),
      cartCreated: parseInt(row.cart_created),
      estimatedLostRevenue: parseFloat(row.estimated_lost_revenue) || 0,
    }));
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to get top missing:", error);
    return [];
  }
}

/**
 * Get gap stats for a specific time period
 */
export async function getGapStats(days: number = 30): Promise<{
  totalRequests: number;
  uniqueVehicles: number;
  fallbackSuccessRate: number;
  searchConversionRate: number;
  cartConversionRate: number;
  topMakes: { make: string; count: number }[];
}> {
  const pool = getDbPool();
  if (!pool) {
    return {
      totalRequests: 0,
      uniqueVehicles: 0,
      fallbackSuccessRate: 0,
      searchConversionRate: 0,
      cartConversionRate: 0,
      topMakes: [],
    };
  }
  
  try {
    const stats = await pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT (make || '|' || model || '|' || year)) as unique_vehicles,
        ROUND(AVG(CASE WHEN fallback_success THEN 1 ELSE 0 END) * 100, 1) as success_rate,
        ROUND(AVG(CASE WHEN action IN ('search_tires', 'search_wheels') THEN 1 ELSE 0 END) * 100, 1) as search_rate,
        ROUND(AVG(CASE WHEN action = 'cart_created' THEN 1 ELSE 0 END) * 100, 1) as cart_rate
      FROM fitment_gaps
      WHERE created_at > NOW() - INTERVAL '1 day' * $1`,
      [days]
    );
    
    const topMakes = await pool.query(
      `SELECT make, COUNT(*) as count
       FROM fitment_gaps
       WHERE created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY make
       ORDER BY count DESC
       LIMIT 10`,
      [days]
    );
    
    const row = stats.rows[0] || {};
    
    return {
      totalRequests: parseInt(row.total_requests) || 0,
      uniqueVehicles: parseInt(row.unique_vehicles) || 0,
      fallbackSuccessRate: parseFloat(row.success_rate) || 0,
      searchConversionRate: parseFloat(row.search_rate) || 0,
      cartConversionRate: parseFloat(row.cart_rate) || 0,
      topMakes: topMakes.rows.map((r: any) => ({
        make: r.make,
        count: parseInt(r.count),
      })),
    };
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to get stats:", error);
    return {
      totalRequests: 0,
      uniqueVehicles: 0,
      fallbackSuccessRate: 0,
      searchConversionRate: 0,
      cartConversionRate: 0,
      topMakes: [],
    };
  }
}

/**
 * Get detailed history for a specific vehicle
 */
export async function getVehicleGapHistory(
  make: string,
  model: string,
  year?: number
): Promise<{
  events: any[];
  summary: FitmentGapSummary | null;
}> {
  const pool = getDbPool();
  if (!pool) return { events: [], summary: null };
  
  try {
    let events;
    if (year) {
      events = await pool.query(
        `SELECT * FROM fitment_gaps 
         WHERE make = $1 AND model = $2 AND year = $3
         ORDER BY created_at DESC
         LIMIT 100`,
        [make, model, year]
      );
    } else {
      events = await pool.query(
        `SELECT * FROM fitment_gaps 
         WHERE make = $1 AND model = $2
         ORDER BY created_at DESC
         LIMIT 100`,
        [make, model]
      );
    }
    
    const vehicleKey = `${make}|${model}`;
    let summary;
    if (year) {
      summary = await pool.query(
        `SELECT * FROM fitment_gap_summary WHERE vehicle_key = $1 AND year = $2`,
        [vehicleKey, year]
      );
    } else {
      summary = await pool.query(
        `SELECT * FROM fitment_gap_summary WHERE vehicle_key = $1 ORDER BY request_count DESC LIMIT 1`,
        [vehicleKey]
      );
    }
    
    const summaryRow = summary.rows[0];
    
    return {
      events: events.rows,
      summary: summaryRow ? {
        vehicleKey: summaryRow.vehicle_key,
        year: summaryRow.year,
        make: summaryRow.make,
        model: summaryRow.model,
        requestCount: parseInt(summaryRow.request_count),
        uniqueSessions: parseInt(summaryRow.unique_sessions),
        firstRequested: summaryRow.first_requested,
        lastRequested: summaryRow.last_requested,
        fallbackSuccessRate: summaryRow.request_count > 0 
          ? Math.round(summaryRow.fallback_success_count / summaryRow.request_count * 100)
          : 0,
        searchAttempts: parseInt(summaryRow.search_attempts),
        cartCreated: parseInt(summaryRow.cart_created),
        estimatedLostRevenue: parseFloat(summaryRow.estimated_revenue) || 0,
      } : null,
    };
  } catch (error) {
    console.error("[fitment-gap-tracker] Failed to get vehicle history:", error);
    return { events: [], summary: null };
  }
}
