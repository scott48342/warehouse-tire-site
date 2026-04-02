/**
 * API Key Management
 * 
 * Generate, validate, and track API keys for the Fitment API.
 */

import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/fitment-db/db";
import { apiKeys, apiUsageLogs, type ApiKey } from "./schema";
import { eq, and, sql } from "drizzle-orm";

// ============================================================================
// Configuration
// ============================================================================

const API_KEY_PREFIX = "wtd_"; // Warehouse Tire Direct
const API_KEY_LENGTH = 32; // Total length after prefix

// Plan limits
export const PLAN_LIMITS: Record<string, { monthly: number; daily?: number }> = {
  starter: { monthly: 10000 },
  growth: { monthly: 50000 },
  pro: { monthly: 200000 },
  enterprise: { monthly: 1000000 },
};

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new API key
 * Returns the plain key (show to user once) and the hash (store in DB)
 */
export function generateApiKey(): { plainKey: string; keyHash: string; keyPrefix: string } {
  // Generate random bytes
  const randomPart = randomBytes(API_KEY_LENGTH).toString("base64url").slice(0, API_KEY_LENGTH);
  const plainKey = `${API_KEY_PREFIX}${randomPart}`;
  
  // Hash for storage
  const keyHash = hashApiKey(plainKey);
  
  // Prefix for identification (first 8 chars after prefix)
  const keyPrefix = `${API_KEY_PREFIX}${randomPart.slice(0, 8)}`;
  
  return { plainKey, keyHash, keyPrefix };
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(plainKey: string): string {
  return createHash("sha256").update(plainKey).digest("hex");
}

// ============================================================================
// Key Validation
// ============================================================================

/**
 * Validate an API key and return the key record if valid
 * Also tracks usage
 */
export async function validateApiKey(
  plainKey: string,
  endpoint: string,
  metadata?: { ip?: string; userAgent?: string; queryParams?: string }
): Promise<{ valid: boolean; key?: ApiKey; error?: string }> {
  if (!plainKey || !plainKey.startsWith(API_KEY_PREFIX)) {
    return { valid: false, error: "invalid_key_format" };
  }
  
  const keyHash = hashApiKey(plainKey);
  
  try {
    // Find key by hash
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    
    if (!key) {
      return { valid: false, error: "key_not_found" };
    }
    
    if (!key.active) {
      return { valid: false, error: "key_inactive", key };
    }
    
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return { valid: false, error: "key_expired", key };
    }
    
    // Check rate limits
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Reset monthly count if needed
    if (!key.monthlyResetAt || new Date(key.monthlyResetAt) < monthStart) {
      await db
        .update(apiKeys)
        .set({
          monthlyRequestCount: 0,
          monthlyResetAt: monthStart,
          updatedAt: now,
        })
        .where(eq(apiKeys.id, key.id));
      key.monthlyRequestCount = 0;
    }
    
    // Check monthly limit
    if (key.monthlyRequestCount >= key.monthlyLimit) {
      return { valid: false, error: "rate_limit_exceeded", key };
    }
    
    // Track usage
    const isFirstCall = !key.firstCallAt;
    
    await db
      .update(apiKeys)
      .set({
        requestCount: sql`${apiKeys.requestCount} + 1`,
        monthlyRequestCount: sql`${apiKeys.monthlyRequestCount} + 1`,
        lastRequestAt: now,
        ...(isFirstCall ? { firstCallAt: now, firstCallEndpoint: endpoint } : {}),
        updatedAt: now,
      })
      .where(eq(apiKeys.id, key.id));
    
    // Log request (async, don't await)
    logApiRequest(key.id, endpoint, metadata).catch(console.error);
    
    return { valid: true, key };
  } catch (err) {
    console.error("[apiKeys] Validation error:", err);
    return { valid: false, error: "validation_error" };
  }
}

/**
 * Log API request for analytics
 */
async function logApiRequest(
  apiKeyId: string,
  endpoint: string,
  metadata?: { ip?: string; userAgent?: string; queryParams?: string; statusCode?: number; responseTimeMs?: number }
): Promise<void> {
  try {
    await db.insert(apiUsageLogs).values({
      apiKeyId,
      endpoint,
      method: "GET",
      statusCode: metadata?.statusCode,
      responseTimeMs: metadata?.responseTimeMs,
      queryParams: metadata?.queryParams,
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent,
    });
  } catch (err) {
    // Don't fail on logging errors
    console.error("[apiKeys] Failed to log request:", err);
  }
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Create a new API key for an approved request
 */
export async function createApiKey(params: {
  name: string;
  email: string;
  company?: string;
  plan?: string;
}): Promise<{ key: ApiKey; plainKey: string }> {
  const { plainKey, keyHash, keyPrefix } = generateApiKey();
  const plan = params.plan || "starter";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  
  const [key] = await db
    .insert(apiKeys)
    .values({
      keyHash,
      keyPrefix,
      name: params.name,
      email: params.email,
      company: params.company,
      plan,
      monthlyLimit: limits.monthly,
      dailyLimit: limits.daily,
      monthlyResetAt: new Date(),
    })
    .returning();
  
  return { key, plainKey };
}

/**
 * Get API key by email
 */
export async function getApiKeyByEmail(email: string): Promise<ApiKey | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.email, email), eq(apiKeys.active, true)))
    .limit(1);
  
  return key || null;
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(id: string): Promise<ApiKey | null> {
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);
  
  return key || null;
}

/**
 * Suspend an API key
 */
export async function suspendApiKey(id: string, reason: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      active: false,
      suspendedAt: new Date(),
      suspendReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, id));
}

/**
 * Reactivate an API key
 */
export async function reactivateApiKey(id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      active: true,
      suspendedAt: null,
      suspendReason: null,
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, id));
}

// ============================================================================
// Usage Stats
// ============================================================================

/**
 * Get usage stats for an API key
 */
export async function getApiKeyStats(keyId: string): Promise<{
  totalRequests: number;
  monthlyRequests: number;
  monthlyLimit: number;
  firstCallAt: Date | null;
  lastRequestAt: Date | null;
}> {
  const key = await getApiKeyById(keyId);
  if (!key) {
    throw new Error("API key not found");
  }
  
  return {
    totalRequests: key.requestCount,
    monthlyRequests: key.monthlyRequestCount,
    monthlyLimit: key.monthlyLimit,
    firstCallAt: key.firstCallAt,
    lastRequestAt: key.lastRequestAt,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const apiKeyService = {
  generateApiKey,
  hashApiKey,
  validateApiKey,
  createApiKey,
  getApiKeyByEmail,
  getApiKeyById,
  suspendApiKey,
  reactivateApiKey,
  getApiKeyStats,
  PLAN_LIMITS,
};

export default apiKeyService;
