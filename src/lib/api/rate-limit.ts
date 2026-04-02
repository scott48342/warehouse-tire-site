/**
 * Rate Limiting for Public API (Production-Hardened)
 * 
 * Sliding window rate limiting with per-key limits.
 * Supports daily limits for lower tiers.
 * Includes burst protection and adaptive throttling.
 * 
 * For production scale, this could be replaced with Redis/Upstash.
 */

import { NextResponse } from "next/server";
import type { ApiKeyConfig } from "./types";

// ============================================================================
// Configuration
// ============================================================================

const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 86_400_000;
const SECOND_WINDOW_MS = 1_000;

// Burst protection config
const BURST_WINDOW_MS = 1_000;       // 1 second window
const DEFAULT_BURST_LIMIT = 10;      // Max 10 requests per second
const BURST_LIMITS_BY_TIER: Record<string, number> = {
  free: 5,
  basic: 10,
  premium: 20,
  enterprise: 50,
};

// ============================================================================
// Rate Limit Store
// ============================================================================

interface RateLimitEntry {
  // Per-minute tracking
  minuteCount: number;
  minuteWindowStart: number;
  
  // Per-day tracking
  dayCount: number;
  dayWindowStart: number;
  
  // Burst tracking (per-second)
  burstCount: number;
  burstWindowStart: number;
  
  // Adaptive throttling
  throttleMultiplier: number;  // 1.0 = normal, >1 = throttled
  consecutiveHits: number;     // How many times hit rate limit consecutively
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    // Remove if both windows are stale
    if (now - entry.minuteWindowStart > MINUTE_WINDOW_MS * 5 &&
        now - entry.dayWindowStart > DAY_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}, MINUTE_WINDOW_MS);

// ============================================================================
// Rate Limit Check
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;        // Remaining in minute window
  resetIn: number;          // Seconds until minute reset
  dailyRemaining?: number;  // Remaining in day (if daily limit)
  dailyResetIn?: number;    // Hours until daily reset
  limitType?: "minute" | "daily" | "burst";  // Which limit was hit
  burstRemaining?: number;  // Remaining in burst window
  throttled?: boolean;      // Is client being throttled
  effectiveLimit?: number;  // Effective limit after throttle multiplier
}

/**
 * Get burst limit for a tier
 */
function getBurstLimit(tier: string): number {
  return BURST_LIMITS_BY_TIER[tier] || DEFAULT_BURST_LIMIT;
}

/**
 * Check and increment rate limit for an API key
 * Includes burst protection and adaptive throttling
 */
export function checkRateLimit(apiKey: ApiKeyConfig): RateLimitResult {
  const now = Date.now();
  const key = `rate:${apiKey.clientId}`;
  const minuteLimit = apiKey.rateLimit;
  const dailyLimit = apiKey.dailyLimit;
  const burstLimit = getBurstLimit(apiKey.tier);
  
  let entry = rateLimitStore.get(key);
  
  // Initialize entry
  if (!entry) {
    entry = {
      minuteCount: 0,
      minuteWindowStart: now,
      dayCount: 0,
      dayWindowStart: now,
      burstCount: 0,
      burstWindowStart: now,
      throttleMultiplier: 1.0,
      consecutiveHits: 0,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Reset burst window if expired
  if (now - entry.burstWindowStart >= BURST_WINDOW_MS) {
    entry.burstCount = 0;
    entry.burstWindowStart = now;
  }
  
  // Reset minute window if expired
  if (now - entry.minuteWindowStart >= MINUTE_WINDOW_MS) {
    entry.minuteCount = 0;
    entry.minuteWindowStart = now;
    // Decay throttle multiplier on new window
    entry.throttleMultiplier = Math.max(1.0, entry.throttleMultiplier * 0.8);
    entry.consecutiveHits = 0;
  }
  
  // Reset day window if expired
  if (now - entry.dayWindowStart >= DAY_WINDOW_MS) {
    entry.dayCount = 0;
    entry.dayWindowStart = now;
    entry.throttleMultiplier = 1.0;
  }
  
  // Calculate effective limit (with throttling)
  const effectiveMinuteLimit = Math.ceil(minuteLimit / entry.throttleMultiplier);
  
  // Check burst limit first (fastest check)
  if (entry.burstCount >= burstLimit) {
    const resetIn = Math.ceil((entry.burstWindowStart + BURST_WINDOW_MS - now) / 1000);
    entry.consecutiveHits++;
    // Increase throttle multiplier for repeat offenders
    if (entry.consecutiveHits > 3) {
      entry.throttleMultiplier = Math.min(10.0, entry.throttleMultiplier * 1.5);
    }
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(1, resetIn),
      dailyRemaining: dailyLimit ? dailyLimit - entry.dayCount : undefined,
      limitType: "burst",
      burstRemaining: 0,
      throttled: entry.throttleMultiplier > 1.0,
      effectiveLimit: effectiveMinuteLimit,
    };
  }
  
  // Check daily limit (if applicable)
  if (dailyLimit && entry.dayCount >= dailyLimit) {
    const dailyResetIn = Math.ceil((entry.dayWindowStart + DAY_WINDOW_MS - now) / 3600_000);
    entry.consecutiveHits++;
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((entry.minuteWindowStart + MINUTE_WINDOW_MS - now) / 1000),
      dailyRemaining: 0,
      dailyResetIn,
      limitType: "daily",
      throttled: entry.throttleMultiplier > 1.0,
      effectiveLimit: effectiveMinuteLimit,
    };
  }
  
  // Check minute limit (with throttle applied)
  if (entry.minuteCount >= effectiveMinuteLimit) {
    const resetIn = Math.ceil((entry.minuteWindowStart + MINUTE_WINDOW_MS - now) / 1000);
    entry.consecutiveHits++;
    // Increase throttle for hammering
    if (entry.consecutiveHits > 5) {
      entry.throttleMultiplier = Math.min(10.0, entry.throttleMultiplier * 1.2);
    }
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      dailyRemaining: dailyLimit ? dailyLimit - entry.dayCount : undefined,
      limitType: "minute",
      throttled: entry.throttleMultiplier > 1.0,
      effectiveLimit: effectiveMinuteLimit,
    };
  }
  
  // Request allowed - increment counters
  entry.burstCount++;
  entry.minuteCount++;
  entry.dayCount++;
  entry.consecutiveHits = 0; // Reset on success
  
  const remaining = effectiveMinuteLimit - entry.minuteCount;
  const resetIn = Math.ceil((entry.minuteWindowStart + MINUTE_WINDOW_MS - now) / 1000);
  
  return {
    allowed: true,
    remaining,
    resetIn,
    dailyRemaining: dailyLimit ? dailyLimit - entry.dayCount : undefined,
    burstRemaining: burstLimit - entry.burstCount,
    throttled: entry.throttleMultiplier > 1.0,
    effectiveLimit: effectiveMinuteLimit,
  };
}

/**
 * Manually set throttle multiplier for a client
 */
export function setThrottleMultiplier(clientId: string, multiplier: number): void {
  const key = `rate:${clientId}`;
  const entry = rateLimitStore.get(key);
  if (entry) {
    entry.throttleMultiplier = Math.max(1.0, Math.min(10.0, multiplier));
  }
}

/**
 * Reset throttle for a client
 */
export function resetThrottle(clientId: string): void {
  const key = `rate:${clientId}`;
  const entry = rateLimitStore.get(key);
  if (entry) {
    entry.throttleMultiplier = 1.0;
    entry.consecutiveHits = 0;
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limit: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  response.headers.set("X-RateLimit-Reset", String(result.resetIn));
  
  if (result.dailyRemaining !== undefined) {
    response.headers.set("X-RateLimit-Daily-Remaining", String(result.dailyRemaining));
  }
  
  return response;
}

/**
 * Get current usage for a client (for monitoring)
 */
export function getRateLimitStatus(clientId: string): {
  minuteCount: number;
  dayCount: number;
  minuteWindowAge: number;
  dayWindowAge: number;
} | null {
  const entry = rateLimitStore.get(`rate:${clientId}`);
  if (!entry) return null;

  const now = Date.now();
  return {
    minuteCount: entry.minuteCount,
    dayCount: entry.dayCount,
    minuteWindowAge: Math.round((now - entry.minuteWindowStart) / 1000),
    dayWindowAge: Math.round((now - entry.dayWindowStart) / 3600_000),
  };
}
