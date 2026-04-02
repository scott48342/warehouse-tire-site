/**
 * Public API Types
 */

// ============================================================================
// API Key Types
// ============================================================================

export type ApiKeyTier = "free" | "basic" | "premium" | "enterprise";
export type ApiKeyState = "active" | "suspended" | "revoked";

export interface ApiKeyConfig {
  key: string;
  clientId: string;
  clientName?: string;
  tier: ApiKeyTier;
  state: ApiKeyState;
  rateLimit: number;        // requests per minute
  dailyLimit?: number;      // requests per day (optional)
  metadata?: Record<string, string>;
  createdAt?: string;
  expiresAt?: string;
}

// ============================================================================
// Usage Logging Types
// ============================================================================

export interface UsageLogEntry {
  timestamp: string;
  clientId: string;
  endpoint: string;
  method: string;
  status: number;
  latencyMs: number;
  cacheHit: boolean;
  rateLimitRemaining: number;
  userAgent?: string;
  ip?: string;
}

export interface UsageStats {
  clientId: string;
  period: "minute" | "hour" | "day";
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  endpoints: Record<string, number>;
}

// ============================================================================
// Rate Limit Config by Tier
// ============================================================================

export const TIER_LIMITS: Record<ApiKeyTier, { rpm: number; daily?: number }> = {
  free: { rpm: 60, daily: 1000 },
  basic: { rpm: 120, daily: 10000 },
  premium: { rpm: 600, daily: 100000 },
  enterprise: { rpm: 3000 },  // No daily limit
};
