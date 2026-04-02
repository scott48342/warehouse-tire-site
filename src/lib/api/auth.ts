/**
 * Public API Authentication (Production-Hardened)
 * 
 * API key validation with state management.
 * Keys stored in environment variable with full metadata.
 * 
 * Format: key:clientId:clientName:tier:state
 * Example: abc123:client1:Acme Corp:premium:active
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiKeyConfig, ApiKeyTier, ApiKeyState } from "./types";
import { TIER_LIMITS } from "./types";

// ============================================================================
// Key Cache (parsed from env on first access)
// ============================================================================

let keyCache: Map<string, ApiKeyConfig> | null = null;
let keyCacheTime = 0;
const KEY_CACHE_TTL = 60_000; // Refresh every minute

function getKeyCache(): Map<string, ApiKeyConfig> {
  const now = Date.now();
  
  // Refresh cache if expired
  if (!keyCache || now - keyCacheTime > KEY_CACHE_TTL) {
    keyCache = parseApiKeys(process.env.PUBLIC_API_KEYS || "");
    keyCacheTime = now;
  }
  
  return keyCache;
}

/**
 * Parse API keys from environment variable
 * 
 * Production format: key:clientId:clientName:tier:state
 * Minimal format: key:clientId:tier
 * 
 * Examples:
 *   abc123:client1:Acme Corp:premium:active
 *   xyz789:client2::basic:active
 */
function parseApiKeys(envValue: string): Map<string, ApiKeyConfig> {
  const keys = new Map<string, ApiKeyConfig>();
  
  // In development with no keys, provide a test key
  if (!envValue.trim()) {
    if (process.env.NODE_ENV === "development") {
      keys.set("dev_test_key_12345", {
        key: "dev_test_key_12345",
        clientId: "dev",
        clientName: "Development",
        tier: "premium",
        state: "active",
        rateLimit: 600,
      });
      console.log("[API Auth] Development mode: using default test key");
    }
    return keys;
  }

  const entries = envValue.split(",").map(e => e.trim()).filter(Boolean);
  
  for (const entry of entries) {
    const parts = entry.split(":");
    
    if (parts.length < 3) {
      console.warn(`[API Auth] Invalid key format (need at least key:clientId:tier): ${entry.slice(0, 20)}...`);
      continue;
    }

    const [key, clientId, ...rest] = parts;
    
    // Support both formats:
    // key:clientId:tier (minimal)
    // key:clientId:clientName:tier:state (full)
    let clientName = "";
    let tier: ApiKeyTier = "free";
    let state: ApiKeyState = "active";

    if (rest.length === 1) {
      // Minimal format: key:clientId:tier
      tier = (rest[0] as ApiKeyTier) || "free";
    } else if (rest.length >= 2) {
      // Full format: key:clientId:clientName:tier:state
      clientName = rest[0] || "";
      tier = (rest[1] as ApiKeyTier) || "free";
      state = (rest[2] as ApiKeyState) || "active";
    }

    // Validate tier
    if (!TIER_LIMITS[tier]) {
      console.warn(`[API Auth] Invalid tier "${tier}" for client ${clientId}, defaulting to free`);
      tier = "free";
    }

    keys.set(key, {
      key,
      clientId,
      clientName: clientName || clientId,
      tier,
      state,
      rateLimit: TIER_LIMITS[tier].rpm,
      dailyLimit: TIER_LIMITS[tier].daily,
    });
  }

  console.log(`[API Auth] Loaded ${keys.size} API key(s)`);
  return keys;
}

// ============================================================================
// API Key Validation
// ============================================================================

export interface ValidateKeyResult {
  valid: boolean;
  key?: ApiKeyConfig;
  error?: string;
  errorCode?: "MISSING_KEY" | "INVALID_KEY" | "SUSPENDED" | "REVOKED" | "EXPIRED";
}

/**
 * Validate API key from request headers or query params.
 * Checks env-based keys first, then falls back to database keys.
 */
export function validateApiKey(req: NextRequest): ValidateKeyResult {
  // Extract key from header or query param
  const apiKey = req.headers.get("x-api-key") || 
                 req.headers.get("X-API-Key") ||
                 new URL(req.url).searchParams.get("api_key");
  
  if (!apiKey) {
    return { valid: false, error: "API key required", errorCode: "MISSING_KEY" };
  }

  // Check env-based keys first
  const cache = getKeyCache();
  const keyConfig = cache.get(apiKey);

  if (keyConfig) {
    // Check state
    if (keyConfig.state === "suspended") {
      return { 
        valid: false, 
        key: keyConfig,
        error: "API key is suspended. Contact support.", 
        errorCode: "SUSPENDED" 
      };
    }

    if (keyConfig.state === "revoked") {
      return { 
        valid: false, 
        key: keyConfig,
        error: "API key has been revoked.", 
        errorCode: "REVOKED" 
      };
    }

    // Check expiration
    if (keyConfig.expiresAt) {
      const expiry = new Date(keyConfig.expiresAt);
      if (expiry < new Date()) {
        return { 
          valid: false, 
          key: keyConfig,
          error: "API key has expired.", 
          errorCode: "EXPIRED" 
        };
      }
    }

    return { valid: true, key: keyConfig };
  }
  
  // If key starts with "wtd_", it's a database-issued key
  // Return pending for async validation (handled in middleware)
  if (apiKey.startsWith("wtd_")) {
    // Mark for async DB validation
    return { 
      valid: false, 
      error: "Pending database validation",
      errorCode: "PENDING_DB_VALIDATION" as any,
      key: { key: apiKey } as any,
    };
  }

  return { valid: false, error: "Invalid API key", errorCode: "INVALID_KEY" };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create unauthorized response with appropriate error details
 */
export function unauthorizedResponse(result: ValidateKeyResult): NextResponse {
  const status = result.errorCode === "MISSING_KEY" ? 401 : 
                 result.errorCode === "SUSPENDED" ? 403 :
                 result.errorCode === "REVOKED" ? 403 : 401;

  return NextResponse.json(
    { 
      success: false,
      error: {
        code: result.errorCode || "UNAUTHORIZED",
        message: result.error || "Unauthorized",
        ...(result.errorCode === "MISSING_KEY" && {
          hint: "Include X-API-Key header or api_key query parameter",
        }),
      },
    },
    { status }
  );
}

/**
 * Create rate limited response
 */
export function rateLimitedResponse(retryAfter: number = 60): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down.",
        retryAfter,
      },
    },
    { 
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

// ============================================================================
// Legacy exports for compatibility
// ============================================================================

export type { ApiKeyConfig as ApiKeyInfo } from "./types";
