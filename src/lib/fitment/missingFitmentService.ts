/**
 * Missing Fitment Request Service
 * 
 * Tracks and manages vehicles missing from the WTD fitment database.
 * Used by Jake to log missing vehicles for future DB enrichment.
 * 
 * Features:
 * - Upsert logic (increment count on repeat requests)
 * - Conversation replay links
 * - Status management (new → reviewed → added_to_db → ignored)
 * - Cart/checkout outcome tracking
 * 
 * @created 2026-05-20
 */

import { getDbPool } from "@/lib/db/pool";

// ============================================================================
// TYPES
// ============================================================================

export type MissingFitmentStatus = "new" | "reviewed" | "added_to_db" | "ignored";
export type MissingFitmentSource = "jake" | "jake_garage" | "local" | "national" | "api" | "widget";

export interface MissingFitmentRequest {
  id?: number;
  createdAt?: Date;
  updatedAt?: Date;
  
  // Vehicle info
  year: number;
  make: string;
  model: string;
  trim?: string;
  rawCustomerText?: string;
  normalizedVehicle?: string;  // "2009 Cadillac DTS"
  
  // Source context
  source: MissingFitmentSource;
  sessionId?: string;
  requestId?: string;
  conversationUrl?: string;
  hostname?: string;
  
  // Fallback info
  fallbackUsed: boolean;
  fallbackConfidence?: string;  // "high" | "medium" | "low" | "unknown"
  fallbackTireSize?: string;
  fallbackBoltPattern?: string;
  
  // Outcome tracking
  cartCreated: boolean;
  checkoutStarted: boolean;
  orderCompleted?: boolean;
  orderValue?: number;
  
  // Management
  status: MissingFitmentStatus;
  requestCount: number;
  lastRequestedAt?: Date;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface MissingFitmentSummary {
  id: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  normalizedVehicle: string;
  source: string;
  sessionId?: string;
  fallbackUsed: boolean;
  fallbackConfidence?: string;
  cartCreated: boolean;
  checkoutStarted: boolean;
  status: MissingFitmentStatus;
  requestCount: number;
  lastRequestedAt: Date;
  createdAt: Date;
  notes?: string;
}

export interface UpsertMissingFitmentInput {
  year: number;
  make: string;
  model: string;
  trim?: string;
  rawCustomerText?: string;
  source: MissingFitmentSource;
  sessionId?: string;
  requestId?: string;
  hostname?: string;
  fallbackUsed: boolean;
  fallbackConfidence?: string;
  fallbackTireSize?: string;
  fallbackBoltPattern?: string;
}

// ============================================================================
// UPSERT FUNCTION (Main Entry Point)
// ============================================================================

/**
 * Log a missing fitment request.
 * If same year/make/model/trim exists, increments count instead of duplicating.
 */
export async function logMissingFitment(input: UpsertMissingFitmentInput): Promise<{
  success: boolean;
  isNew: boolean;
  requestCount: number;
  id?: number;
}> {
  const pool = getDbPool();
  if (!pool) {
    console.warn("[missing-fitment] No database connection");
    return { success: false, isNew: false, requestCount: 0 };
  }
  
  const normalizedVehicle = `${input.year} ${input.make} ${input.model}${input.trim ? ` ${input.trim}` : ""}`;
  const vehicleKey = `${input.year}|${input.make.toLowerCase()}|${input.model.toLowerCase()}|${(input.trim || "").toLowerCase()}`;
  
  // Build conversation replay URL
  const conversationUrl = input.sessionId 
    ? `/admin/jake-analytics?conversation=${input.sessionId}`
    : undefined;
  
  try {
    // Check if exists
    const existing = await pool.query(
      `SELECT id, request_count FROM missing_fitment_requests 
       WHERE vehicle_key = $1`,
      [vehicleKey]
    );
    
    if (existing.rows.length > 0) {
      // Update existing - increment count
      const row = existing.rows[0];
      const newCount = (parseInt(row.request_count) || 1) + 1;
      
      await pool.query(
        `UPDATE missing_fitment_requests SET
          request_count = $2,
          last_requested_at = NOW(),
          updated_at = NOW(),
          session_id = COALESCE($3, session_id),
          conversation_url = COALESCE($4, conversation_url),
          fallback_used = $5 OR fallback_used,
          fallback_confidence = COALESCE($6, fallback_confidence),
          fallback_tire_size = COALESCE($7, fallback_tire_size),
          fallback_bolt_pattern = COALESCE($8, fallback_bolt_pattern)
        WHERE id = $1`,
        [
          row.id,
          newCount,
          input.sessionId,
          conversationUrl,
          input.fallbackUsed,
          input.fallbackConfidence,
          input.fallbackTireSize,
          input.fallbackBoltPattern,
        ]
      );
      
      // Check if we should create an alert (3+ requests)
      if (newCount === 3 || newCount === 5 || newCount === 10) {
        await createAlert({
          type: "repeat_request",
          vehicleKey,
          normalizedVehicle,
          requestCount: newCount,
          message: `${normalizedVehicle} has been requested ${newCount} times`,
        });
      }
      
      return { success: true, isNew: false, requestCount: newCount, id: row.id };
    }
    
    // Insert new
    const result = await pool.query(
      `INSERT INTO missing_fitment_requests (
        vehicle_key, year, make, model, trim,
        raw_customer_text, normalized_vehicle,
        source, session_id, request_id, conversation_url, hostname,
        fallback_used, fallback_confidence, fallback_tire_size, fallback_bolt_pattern,
        cart_created, checkout_started, status, request_count,
        created_at, updated_at, last_requested_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        false, false, 'new', 1,
        NOW(), NOW(), NOW()
      ) RETURNING id`,
      [
        vehicleKey,
        input.year,
        input.make,
        input.model,
        input.trim || null,
        input.rawCustomerText || null,
        normalizedVehicle,
        input.source,
        input.sessionId || null,
        input.requestId || null,
        conversationUrl,
        input.hostname || null,
        input.fallbackUsed,
        input.fallbackConfidence || null,
        input.fallbackTireSize || null,
        input.fallbackBoltPattern || null,
      ]
    );
    
    // Create alert for new missing vehicle
    await createAlert({
      type: "new_vehicle",
      vehicleKey,
      normalizedVehicle,
      requestCount: 1,
      message: `New missing vehicle: ${normalizedVehicle}`,
    });
    
    return { success: true, isNew: true, requestCount: 1, id: result.rows[0]?.id };
  } catch (error) {
    console.error("[missing-fitment] Failed to log:", error);
    return { success: false, isNew: false, requestCount: 0 };
  }
}

// ============================================================================
// OUTCOME TRACKING
// ============================================================================

/**
 * Update cart/checkout outcome for a missing fitment request
 */
export async function updateMissingFitmentOutcome(
  sessionId: string,
  outcome: {
    cartCreated?: boolean;
    checkoutStarted?: boolean;
    orderCompleted?: boolean;
    orderValue?: number;
  }
): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  
  try {
    const updates: string[] = [];
    const values: any[] = [sessionId];
    let paramIndex = 2;
    
    if (outcome.cartCreated !== undefined) {
      updates.push(`cart_created = $${paramIndex++}`);
      values.push(outcome.cartCreated);
    }
    if (outcome.checkoutStarted !== undefined) {
      updates.push(`checkout_started = $${paramIndex++}`);
      values.push(outcome.checkoutStarted);
    }
    if (outcome.orderCompleted !== undefined) {
      updates.push(`order_completed = $${paramIndex++}`);
      values.push(outcome.orderCompleted);
    }
    if (outcome.orderValue !== undefined) {
      updates.push(`order_value = $${paramIndex++}`);
      values.push(outcome.orderValue);
    }
    
    if (updates.length === 0) return;
    
    updates.push("updated_at = NOW()");
    
    await pool.query(
      `UPDATE missing_fitment_requests SET ${updates.join(", ")} WHERE session_id = $1`,
      values
    );
    
    // Create alert for cart/checkout on missing fitment
    if (outcome.cartCreated || outcome.checkoutStarted) {
      const record = await pool.query(
        `SELECT normalized_vehicle, vehicle_key FROM missing_fitment_requests WHERE session_id = $1`,
        [sessionId]
      );
      if (record.rows[0]) {
        await createAlert({
          type: outcome.checkoutStarted ? "checkout_started" : "cart_created",
          vehicleKey: record.rows[0].vehicle_key,
          normalizedVehicle: record.rows[0].normalized_vehicle,
          message: `${outcome.checkoutStarted ? "Checkout started" : "Cart created"} for missing vehicle: ${record.rows[0].normalized_vehicle}`,
        });
      }
    }
  } catch (error) {
    console.error("[missing-fitment] Failed to update outcome:", error);
  }
}

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Get missing fitment requests for admin dashboard
 */
export async function getMissingFitmentRequests(options: {
  status?: MissingFitmentStatus | "all";
  limit?: number;
  offset?: number;
  sortBy?: "request_count" | "last_requested_at" | "created_at";
  sortDir?: "asc" | "desc";
  search?: string;
}): Promise<{
  requests: MissingFitmentSummary[];
  total: number;
}> {
  const pool = getDbPool();
  if (!pool) return { requests: [], total: 0 };
  
  const {
    status = "all",
    limit = 50,
    offset = 0,
    sortBy = "request_count",
    sortDir = "desc",
    search,
  } = options;
  
  try {
    let whereClause = "1=1";
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status !== "all") {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (search) {
      whereClause += ` AND (
        normalized_vehicle ILIKE $${paramIndex} OR
        make ILIKE $${paramIndex} OR
        model ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM missing_fitment_requests WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || "0");
    
    // Get paginated results
    const validSortCols = ["request_count", "last_requested_at", "created_at"];
    const safeSort = validSortCols.includes(sortBy) ? sortBy : "request_count";
    const safeDir = sortDir === "asc" ? "ASC" : "DESC";
    
    params.push(limit, offset);
    
    const result = await pool.query(
      `SELECT 
        id, year, make, model, trim, normalized_vehicle,
        source, session_id, fallback_used, fallback_confidence,
        cart_created, checkout_started, status, request_count,
        last_requested_at, created_at, notes
      FROM missing_fitment_requests
      WHERE ${whereClause}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );
    
    return {
      requests: result.rows.map(row => ({
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim,
        normalizedVehicle: row.normalized_vehicle,
        source: row.source,
        sessionId: row.session_id,
        fallbackUsed: row.fallback_used,
        fallbackConfidence: row.fallback_confidence,
        cartCreated: row.cart_created,
        checkoutStarted: row.checkout_started,
        status: row.status,
        requestCount: parseInt(row.request_count),
        lastRequestedAt: row.last_requested_at,
        createdAt: row.created_at,
        notes: row.notes,
      })),
      total,
    };
  } catch (error) {
    console.error("[missing-fitment] Failed to get requests:", error);
    return { requests: [], total: 0 };
  }
}

/**
 * Get stats for missing fitment dashboard
 */
export async function getMissingFitmentStats(): Promise<{
  total: number;
  new: number;
  reviewed: number;
  addedToDb: number;
  ignored: number;
  withCart: number;
  withCheckout: number;
  topMakes: { make: string; count: number }[];
  recentAlerts: any[];
}> {
  const pool = getDbPool();
  if (!pool) {
    return {
      total: 0, new: 0, reviewed: 0, addedToDb: 0, ignored: 0,
      withCart: 0, withCheckout: 0, topMakes: [], recentAlerts: [],
    };
  }
  
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'reviewed') as reviewed_count,
        COUNT(*) FILTER (WHERE status = 'added_to_db') as added_count,
        COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
        COUNT(*) FILTER (WHERE cart_created = true) as cart_count,
        COUNT(*) FILTER (WHERE checkout_started = true) as checkout_count
      FROM missing_fitment_requests
    `);
    
    const topMakes = await pool.query(`
      SELECT make, SUM(request_count) as count
      FROM missing_fitment_requests
      WHERE status != 'ignored'
      GROUP BY make
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const alerts = await pool.query(`
      SELECT * FROM missing_fitment_alerts
      WHERE dismissed = false
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    const row = stats.rows[0] || {};
    
    return {
      total: parseInt(row.total) || 0,
      new: parseInt(row.new_count) || 0,
      reviewed: parseInt(row.reviewed_count) || 0,
      addedToDb: parseInt(row.added_count) || 0,
      ignored: parseInt(row.ignored_count) || 0,
      withCart: parseInt(row.cart_count) || 0,
      withCheckout: parseInt(row.checkout_count) || 0,
      topMakes: topMakes.rows.map(r => ({
        make: r.make,
        count: parseInt(r.count),
      })),
      recentAlerts: alerts.rows,
    };
  } catch (error) {
    console.error("[missing-fitment] Failed to get stats:", error);
    return {
      total: 0, new: 0, reviewed: 0, addedToDb: 0, ignored: 0,
      withCart: 0, withCheckout: 0, topMakes: [], recentAlerts: [],
    };
  }
}

/**
 * Update status of a missing fitment request
 */
export async function updateMissingFitmentStatus(
  id: number,
  status: MissingFitmentStatus,
  notes?: string,
  reviewedBy?: string
): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;
  
  try {
    await pool.query(
      `UPDATE missing_fitment_requests SET
        status = $2,
        notes = COALESCE($3, notes),
        reviewed_by = $4,
        reviewed_at = CASE WHEN $2 != 'new' THEN NOW() ELSE reviewed_at END,
        updated_at = NOW()
      WHERE id = $1`,
      [id, status, notes, reviewedBy]
    );
    return true;
  } catch (error) {
    console.error("[missing-fitment] Failed to update status:", error);
    return false;
  }
}

/**
 * Bulk update status
 */
export async function bulkUpdateStatus(
  ids: number[],
  status: MissingFitmentStatus,
  reviewedBy?: string
): Promise<number> {
  const pool = getDbPool();
  if (!pool || ids.length === 0) return 0;
  
  try {
    const result = await pool.query(
      `UPDATE missing_fitment_requests SET
        status = $2,
        reviewed_by = $3,
        reviewed_at = CASE WHEN $2 != 'new' THEN NOW() ELSE reviewed_at END,
        updated_at = NOW()
      WHERE id = ANY($1)`,
      [ids, status, reviewedBy]
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error("[missing-fitment] Failed to bulk update:", error);
    return 0;
  }
}

// ============================================================================
// ALERTS
// ============================================================================

interface AlertInput {
  type: "new_vehicle" | "repeat_request" | "cart_created" | "checkout_started";
  vehicleKey: string;
  normalizedVehicle: string;
  requestCount?: number;
  message: string;
}

async function createAlert(input: AlertInput): Promise<void> {
  const pool = getDbPool();
  if (!pool) return;
  
  try {
    await pool.query(
      `INSERT INTO missing_fitment_alerts (
        type, vehicle_key, normalized_vehicle, request_count, message,
        dismissed, created_at
      ) VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [
        input.type,
        input.vehicleKey,
        input.normalizedVehicle,
        input.requestCount || 1,
        input.message,
      ]
    );
  } catch (error) {
    console.error("[missing-fitment] Failed to create alert:", error);
  }
}

/**
 * Get undismissed alerts
 */
export async function getAlerts(limit: number = 20): Promise<any[]> {
  const pool = getDbPool();
  if (!pool) return [];
  
  try {
    const result = await pool.query(
      `SELECT * FROM missing_fitment_alerts
       WHERE dismissed = false
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error("[missing-fitment] Failed to get alerts:", error);
    return [];
  }
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(id: number): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;
  
  try {
    await pool.query(
      `UPDATE missing_fitment_alerts SET dismissed = true, dismissed_at = NOW() WHERE id = $1`,
      [id]
    );
    return true;
  } catch (error) {
    console.error("[missing-fitment] Failed to dismiss alert:", error);
    return false;
  }
}

/**
 * Dismiss all alerts
 */
export async function dismissAllAlerts(): Promise<boolean> {
  const pool = getDbPool();
  if (!pool) return false;
  
  try {
    await pool.query(
      `UPDATE missing_fitment_alerts SET dismissed = true, dismissed_at = NOW() WHERE dismissed = false`
    );
    return true;
  } catch (error) {
    console.error("[missing-fitment] Failed to dismiss all alerts:", error);
    return false;
  }
}
