/**
 * Database-Backed API Key Validation
 * 
 * Extends the existing env-based auth to also check database keys.
 * Used for self-service API key onboarding.
 * 
 * This is called as a fallback when env-based validation fails.
 */

import { NextRequest } from "next/server";
import { createHash } from "crypto";
import type { ApiKeyConfig, ApiKeyTier } from "./types";
import { TIER_LIMITS } from "./types";

// ============================================================================
// Database Key Lookup (Lazy Import)
// ============================================================================

let dbModule: typeof import("@/lib/fitment-db/db") | null = null;
let schemaModule: typeof import("@/lib/fitment-api/schema") | null = null;

async function getDb() {
  if (!dbModule) {
    dbModule = await import("@/lib/fitment-db/db");
  }
  return dbModule.db;
}

async function getSchema() {
  if (!schemaModule) {
    schemaModule = await import("@/lib/fitment-api/schema");
  }
  return schemaModule;
}

/**
 * Hash an API key for lookup
 */
function hashKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

/**
 * Map plan names to tier names
 */
function planToTier(plan: string): ApiKeyTier {
  const mapping: Record<string, ApiKeyTier> = {
    starter: "free",
    growth: "basic",
    pro: "premium",
    enterprise: "enterprise",
  };
  return mapping[plan] || "free";
}

// ============================================================================
// Database Key Validation
// ============================================================================

export interface DbValidateResult {
  valid: boolean;
  key?: ApiKeyConfig;
  error?: string;
  errorCode?: "INVALID_KEY" | "SUSPENDED" | "EXPIRED" | "RATE_LIMITED" | "DB_ERROR";
  dbKeyId?: string; // For usage tracking
}

/**
 * Validate an API key against the database
 * Returns null if key not found (so caller can try other sources)
 */
export async function validateDbApiKey(
  apiKey: string,
  options?: { endpoint?: string; ip?: string; userAgent?: string }
): Promise<DbValidateResult | null> {
  // Quick format check
  if (!apiKey || !apiKey.startsWith("wtd_")) {
    return null; // Not a DB key, let env-based auth handle it
  }
  
  try {
    const db = await getDb();
    const { apiKeys, apiUsageLogs } = await getSchema();
    const { eq, sql } = await import("drizzle-orm");
    
    const keyHash = hashKey(apiKey);
    
    // Find key by hash
    const [dbKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    
    if (!dbKey) {
      return null; // Not found, let env-based auth try
    }
    
    // Check if active
    if (!dbKey.active) {
      return {
        valid: false,
        error: "API key is suspended",
        errorCode: "SUSPENDED",
        dbKeyId: dbKey.id,
      };
    }
    
    // Check expiration
    if (dbKey.expiresAt && new Date(dbKey.expiresAt) < new Date()) {
      return {
        valid: false,
        error: "API key has expired",
        errorCode: "EXPIRED",
        dbKeyId: dbKey.id,
      };
    }
    
    // Check rate limit
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Reset monthly count if needed
    let currentMonthlyCount = dbKey.monthlyRequestCount;
    if (!dbKey.monthlyResetAt || new Date(dbKey.monthlyResetAt) < monthStart) {
      await db
        .update(apiKeys)
        .set({
          monthlyRequestCount: 0,
          monthlyResetAt: monthStart,
          updatedAt: now,
        })
        .where(eq(apiKeys.id, dbKey.id));
      currentMonthlyCount = 0;
    }
    
    if (currentMonthlyCount >= dbKey.monthlyLimit) {
      return {
        valid: false,
        error: "Monthly rate limit exceeded",
        errorCode: "RATE_LIMITED",
        dbKeyId: dbKey.id,
      };
    }
    
    // Update usage stats
    const isFirstCall = !dbKey.firstCallAt;
    await db
      .update(apiKeys)
      .set({
        requestCount: sql`${apiKeys.requestCount} + 1`,
        monthlyRequestCount: sql`${apiKeys.monthlyRequestCount} + 1`,
        lastRequestAt: now,
        ...(isFirstCall && options?.endpoint ? { firstCallAt: now, firstCallEndpoint: options.endpoint } : {}),
        updatedAt: now,
      })
      .where(eq(apiKeys.id, dbKey.id));
    
    // Log request (async, don't block)
    if (options?.endpoint) {
      db.insert(apiUsageLogs).values({
        apiKeyId: dbKey.id,
        endpoint: options.endpoint,
        method: "GET",
        ipAddress: options.ip,
        userAgent: options.userAgent,
      }).catch(console.error);
    }
    
    // Map to ApiKeyConfig format for compatibility
    const tier = planToTier(dbKey.plan);
    const keyConfig: ApiKeyConfig = {
      key: apiKey,
      clientId: dbKey.id,
      clientName: dbKey.company || dbKey.name,
      tier,
      state: "active",
      rateLimit: TIER_LIMITS[tier]?.rpm || 60,
      dailyLimit: dbKey.monthlyLimit / 30, // Approximate daily
    };
    
    return {
      valid: true,
      key: keyConfig,
      dbKeyId: dbKey.id,
    };
    
  } catch (err) {
    console.error("[db-auth] Database validation error:", err);
    // Return null to fall back to env-based auth
    return null;
  }
}

/**
 * Extract API key from request (header or query param)
 */
export function extractApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key") || 
         req.headers.get("X-API-Key") ||
         new URL(req.url).searchParams.get("api_key");
}
