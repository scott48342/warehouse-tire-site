/**
 * Public API Middleware (Production-Hardened)
 * 
 * Combines auth + rate limiting + abuse detection + caching + logging.
 * Usage: wrap your route handler with withPublicApi()
 * 
 * Security layers:
 * 1. API key validation (with state checking)
 * 2. Abuse detection (pattern analysis)
 * 3. Request validation (param checking)
 * 4. Rate limiting (with burst protection)
 * 5. Response caching
 * 6. Usage logging
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, rateLimitedResponse } from "./auth";
import { validateDbApiKey, extractApiKey } from "./db-auth";
import { checkRateLimit, addRateLimitHeaders } from "./rate-limit";
import { logRequest, createLogEntry } from "./usage-logger";
import { getFromCache, setInCache, makeCacheKey } from "./cache";
import type { ApiKeyConfig } from "./types";
import { 
  recordRequest, 
  getAbuseStatus, 
  logAbuseEvent,
  type RequestSignature 
} from "./abuse-detection";
import { 
  validateRequest, 
  validationErrorResponse,
  isSuspiciousUserAgent,
  trackIpReputation,
  isIpSuspicious,
} from "./request-validation";

// ============================================================================
// Types
// ============================================================================

export interface PublicApiContext {
  apiKey: ApiKeyConfig;
  cacheKey: string;
  startTime: number;
}

export type PublicApiHandler = (
  req: NextRequest,
  ctx: PublicApiContext
) => Promise<NextResponse>;

export interface WithPublicApiOptions {
  /** Enable response caching (default: true for GET) */
  cache?: boolean;
  /** Custom cache key generator */
  cacheKeyFn?: (req: NextRequest) => string;
  /** Skip abuse detection (for high-trust endpoints) */
  skipAbuseDetection?: boolean;
  /** Skip request validation (for flexible endpoints) */
  skipValidation?: boolean;
  /** Custom validation requirements */
  requiredParams?: string[];
}

// ============================================================================
// Middleware Wrapper
// ============================================================================

/**
 * Wrap a route handler with full public API middleware stack:
 * 1. API key validation (with state checking)
 * 2. Abuse detection (pattern analysis, auto-throttle)
 * 3. Request validation (param checking)
 * 4. Rate limiting (with burst protection)
 * 5. Response caching (GET only)
 * 6. Usage logging
 * 
 * Usage:
 * ```ts
 * export const GET = withPublicApi(async (req, ctx) => {
 *   // ctx.apiKey available here
 *   return NextResponse.json({ data: "..." });
 * });
 * ```
 */
export function withPublicApi(
  handler: PublicApiHandler,
  options: WithPublicApiOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = performance.now();
    const url = new URL(req.url);
    const enableCache = options.cache !== false && req.method === "GET";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 1. Validate API key (env-based first, then database)
    let authResult = validateApiKey(req);
    
    // If env validation returns "PENDING_DB_VALIDATION", try database
    if ((authResult.errorCode as any) === "PENDING_DB_VALIDATION") {
      const plainKey = extractApiKey(req);
      if (plainKey) {
        const dbResult = await validateDbApiKey(plainKey, {
          endpoint: url.pathname,
          ip,
          userAgent,
        });
        
        if (dbResult) {
          // Database found the key
          if (dbResult.valid && dbResult.key) {
            authResult = { valid: true, key: dbResult.key };
          } else {
            authResult = { 
              valid: false, 
              error: dbResult.error || "Invalid API key",
              errorCode: dbResult.errorCode as any || "INVALID_KEY",
            };
          }
        } else {
          // Not found in database either
          authResult = { valid: false, error: "Invalid API key", errorCode: "INVALID_KEY" };
        }
      }
    }
    
    if (!authResult.valid || !authResult.key) {
      // Log failed auth attempts
      if (process.env.NODE_ENV === "production") {
        console.log(JSON.stringify({
          level: "warn",
          type: "api_auth_failure",
          timestamp: new Date().toISOString(),
          endpoint: url.pathname,
          error: authResult.errorCode,
          ip,
          userAgent,
        }));
      }
      return unauthorizedResponse(authResult);
    }

    const apiKey = authResult.key;

    // 2. Check abuse status (is client already flagged?)
    const abuseStatus = getAbuseStatus(apiKey.clientId);
    if (abuseStatus.isSuspended) {
      const suspendedUntil = abuseStatus.suspendedUntil 
        ? new Date(abuseStatus.suspendedUntil).toISOString()
        : "unknown";
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SUSPENDED",
            message: "API access suspended due to abuse detection",
            suspendedUntil,
          },
        },
        { status: 403 }
      );
    }

    // 3. Track IP reputation (detect key sharing/abuse)
    if (ip !== "unknown") {
      trackIpReputation(ip, apiKey.clientId);
      if (isIpSuspicious(ip)) {
        console.log(JSON.stringify({
          level: "warn",
          type: "suspicious_ip",
          timestamp: new Date().toISOString(),
          clientId: apiKey.clientId,
          ip,
        }));
      }
    }

    // 4. Request validation (if not skipped)
    if (!options.skipValidation) {
      const params = Object.fromEntries(url.searchParams.entries());
      delete params.api_key;
      
      const validation = validateRequest(url.pathname, params, userAgent);
      if (!validation.valid) {
        logRequest(createLogEntry(req, apiKey, 400, performance.now() - startTime, false, 0));
        return validationErrorResponse(validation);
      }
    }

    // 5. Abuse detection (pattern analysis)
    if (!options.skipAbuseDetection) {
      const params = Object.fromEntries(url.searchParams.entries());
      delete params.api_key;
      
      const signature: RequestSignature = {
        clientId: apiKey.clientId,
        endpoint: url.pathname,
        params,
        timestamp: Date.now(),
        ip,
        userAgent,
      };
      
      const abuseScore = recordRequest(signature);
      
      // Log suspicious activity
      if (abuseScore.action !== "allow") {
        logAbuseEvent(apiKey.clientId, abuseScore, ip, userAgent);
      }
      
      // Block if abuse detected
      if (abuseScore.action === "block" || abuseScore.action === "suspend") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ABUSE_DETECTED",
              message: "Suspicious activity detected. Request blocked.",
              score: abuseScore.score,
            },
          },
          { status: 429 }
        );
      }
    }

    // 6. Check rate limit (with burst protection)
    const rateLimitResult = checkRateLimit(apiKey);
    if (!rateLimitResult.allowed) {
      logRequest(createLogEntry(req, apiKey, 429, performance.now() - startTime, false, 0));
      
      // Enhanced response for throttled clients
      const response = rateLimitedResponse(rateLimitResult.resetIn);
      if (rateLimitResult.throttled) {
        response.headers.set("X-Throttled", "true");
        response.headers.set("X-Effective-Limit", String(rateLimitResult.effectiveLimit));
      }
      if (rateLimitResult.limitType === "burst") {
        response.headers.set("X-Burst-Limited", "true");
      }
      return response;
    }

    // 7. Check cache (GET only)
    const params = Object.fromEntries(url.searchParams.entries());
    delete params.api_key; // Don't include API key in cache key
    const cacheKey = options.cacheKeyFn 
      ? options.cacheKeyFn(req) 
      : makeCacheKey(url.pathname, params);

    if (enableCache) {
      const cached = getFromCache<{ body: unknown; headers: Record<string, string> }>(cacheKey);
      if (cached.hit) {
        const response = NextResponse.json(cached.data.body);
        
        // Restore headers
        for (const [key, value] of Object.entries(cached.data.headers)) {
          response.headers.set(key, value);
        }
        response.headers.set("X-Cache", "HIT");
        
        addRateLimitHeaders(response, rateLimitResult, apiKey.rateLimit);
        logRequest(createLogEntry(req, apiKey, 200, performance.now() - startTime, true, rateLimitResult.remaining));
        
        return response;
      }
    }

    // 8. Call handler
    let response: NextResponse;
    let status = 200;
    
    try {
      response = await handler(req, { apiKey, cacheKey, startTime });
      status = response.status;
      
      // 9. Cache successful GET responses
      if (enableCache && status === 200) {
        try {
          const body = await response.clone().json();
          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            if (!key.startsWith("x-ratelimit")) {
              headers[key] = value;
            }
          });
          setInCache(cacheKey, { body, headers });
        } catch {
          // Body not JSON, skip caching
        }
      }

      // Add cache miss header
      response.headers.set("X-Cache", "MISS");
      
    } catch (error) {
      console.error("[PublicAPI] Handler error:", error);
      status = 500;
      response = NextResponse.json(
        { 
          success: false, 
          error: { code: "INTERNAL_ERROR", message: "Internal server error" } 
        },
        { status: 500 }
      );
    }

    // 10. Add rate limit headers
    addRateLimitHeaders(response, rateLimitResult, apiKey.rateLimit);
    
    // Add throttle indicator if applicable
    if (rateLimitResult.throttled) {
      response.headers.set("X-Throttled", "true");
    }
    
    // 11. Add standard cache headers
    if (req.method === "GET" && status === 200) {
      response.headers.set("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=60");
    }

    // 12. Log request
    const latencyMs = Math.round(performance.now() - startTime);
    logRequest(createLogEntry(req, apiKey, status, latencyMs, false, rateLimitResult.remaining));

    return response;
  };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Standard success response wrapper
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

/**
 * Standard error response wrapper
 */
export function errorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { message, code: code || "BAD_REQUEST" },
    },
    { status }
  );
}
