/**
 * API Usage Logger
 * 
 * Logs all public API requests for monitoring and analytics.
 * In production, this could write to a database or log aggregator.
 * For now, structured console logging that can be captured by log services.
 */

import type { UsageLogEntry, ApiKeyConfig } from "./types";

// ============================================================================
// In-Memory Stats (for quick access, not persistent)
// ============================================================================

interface ClientStats {
  requestCount: number;
  errorCount: number;
  totalLatencyMs: number;
  cacheHits: number;
  endpoints: Map<string, number>;
  lastRequest: number;
  windowStart: number;
}

const clientStats = new Map<string, ClientStats>();
const STATS_WINDOW_MS = 60_000; // 1 minute window

// ============================================================================
// Logging
// ============================================================================

/**
 * Log a single API request
 */
export function logRequest(entry: UsageLogEntry): void {
  // Structured JSON log (compatible with log aggregators)
  const logData = {
    level: entry.status >= 400 ? "warn" : "info",
    type: "api_request",
    ...entry,
  };

  // In production, this goes to stdout where log aggregators can capture it
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(logData));
  } else {
    // Prettier format for development
    const statusIcon = entry.status < 400 ? "✓" : "✗";
    const cacheIcon = entry.cacheHit ? "⚡" : "";
    console.log(
      `[API] ${statusIcon} ${entry.method} ${entry.endpoint} ` +
      `${entry.status} ${entry.latencyMs}ms ${cacheIcon} ` +
      `[${entry.clientId}] remaining=${entry.rateLimitRemaining}`
    );
  }

  // Update in-memory stats
  updateStats(entry);
}

/**
 * Create a log entry from request/response data
 */
export function createLogEntry(
  req: Request,
  apiKey: ApiKeyConfig,
  status: number,
  latencyMs: number,
  cacheHit: boolean,
  rateLimitRemaining: number
): UsageLogEntry {
  const url = new URL(req.url);
  
  return {
    timestamp: new Date().toISOString(),
    clientId: apiKey.clientId,
    endpoint: url.pathname,
    method: req.method,
    status,
    latencyMs,
    cacheHit,
    rateLimitRemaining,
    userAgent: req.headers.get("user-agent") || undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
        req.headers.get("x-real-ip") || 
        undefined,
  };
}

// ============================================================================
// Stats Tracking
// ============================================================================

function updateStats(entry: UsageLogEntry): void {
  const now = Date.now();
  let stats = clientStats.get(entry.clientId);

  // Reset window if expired
  if (!stats || now - stats.windowStart >= STATS_WINDOW_MS) {
    stats = {
      requestCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
      cacheHits: 0,
      endpoints: new Map(),
      lastRequest: now,
      windowStart: now,
    };
    clientStats.set(entry.clientId, stats);
  }

  stats.requestCount++;
  stats.totalLatencyMs += entry.latencyMs;
  stats.lastRequest = now;
  
  if (entry.status >= 400) {
    stats.errorCount++;
  }
  
  if (entry.cacheHit) {
    stats.cacheHits++;
  }

  const endpointCount = stats.endpoints.get(entry.endpoint) || 0;
  stats.endpoints.set(entry.endpoint, endpointCount + 1);
}

/**
 * Get current stats for a client (for monitoring)
 */
export function getClientStats(clientId: string): {
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
} | null {
  const stats = clientStats.get(clientId);
  if (!stats) return null;

  const now = Date.now();
  if (now - stats.windowStart >= STATS_WINDOW_MS) {
    return null; // Stats expired
  }

  const topEndpoints = Array.from(stats.endpoints.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    requestCount: stats.requestCount,
    errorCount: stats.errorCount,
    avgLatencyMs: stats.requestCount > 0 
      ? Math.round(stats.totalLatencyMs / stats.requestCount) 
      : 0,
    cacheHitRate: stats.requestCount > 0 
      ? Math.round(stats.cacheHits / stats.requestCount * 100) 
      : 0,
    topEndpoints,
  };
}

/**
 * Get all active client stats
 */
export function getAllClientStats(): Map<string, ReturnType<typeof getClientStats>> {
  const result = new Map();
  const now = Date.now();

  for (const [clientId, stats] of clientStats) {
    if (now - stats.windowStart < STATS_WINDOW_MS) {
      result.set(clientId, getClientStats(clientId));
    }
  }

  return result;
}
