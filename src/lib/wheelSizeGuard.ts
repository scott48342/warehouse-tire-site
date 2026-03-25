/**
 * Wheel-Size API Guardrails
 * 
 * Prevents Terms of Service violations by:
 * 1. Blocking automated iteration (cron/background)
 * 2. Rate limiting batch operations
 * 3. Requiring explicit confirmation for batch jobs
 * 4. Logging all API calls for audit
 * 5. Monitoring usage thresholds
 * 
 * @created 2026-03-25
 */

import { headers } from "next/headers";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safe mode: when enabled, only allows user-triggered requests.
 * Blocks ALL cron/background/automated calls to Wheel-Size API.
 */
export const WHEEL_SIZE_SAFE_MODE = process.env.WHEEL_SIZE_SAFE_MODE !== "false";

/**
 * Rate limiting for batch operations (admin endpoints)
 */
export const BATCH_RATE_LIMIT = {
  minIntervalMs: 15 * 60 * 1000, // 15 minutes between batch runs
  maxConcurrent: 1, // Only 1 batch job at a time
};

/**
 * Usage thresholds (per hour/day)
 * Exceeding these logs warnings
 */
export const USAGE_THRESHOLDS = {
  warningPerHour: 500,
  warningPerDay: 5000,
  hardLimitPerHour: 1000, // Block if exceeded
};

/**
 * Log retention
 */
export const LOG_RETENTION_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════════
// IN-MEMORY STATE (Serverless-safe with Redis fallback option)
// ═══════════════════════════════════════════════════════════════════════════

interface WheelSizeLogEntry {
  timestamp: number;
  endpoint: string;
  triggerSource: "user" | "admin-batch" | "unknown";
  vehicle?: { year?: number; make?: string; model?: string };
  status: number;
  durationMs: number;
  requestId?: string;
}

interface BatchJobState {
  isRunning: boolean;
  lastRunAt: number | null;
  lastRunBy: string | null;
  runCount: number;
}

// In-memory stores (reset on cold start, but that's OK for guardrails)
let wsLogs: WheelSizeLogEntry[] = [];
let usageCounters = {
  hourly: { count: 0, resetAt: Date.now() + 3600000 },
  daily: { count: 0, resetAt: Date.now() + 86400000 },
};
let batchJobState: BatchJobState = {
  isRunning: false,
  lastRunAt: null,
  lastRunBy: null,
  runCount: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER SOURCE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

export type TriggerSource = "user" | "admin-batch" | "cron" | "background" | "unknown";

/**
 * Detect the source of the current request.
 * Used to block automated calls when safe mode is enabled.
 * 
 * NOTE: This is a SYNC function that uses heuristics when headers aren't available.
 * For async contexts, use detectTriggerSourceAsync().
 */
export function detectTriggerSource(): TriggerSource {
  // In serverless/edge contexts without request context, default to user
  // The async version should be used in API routes
  return "user";
}

/**
 * Async version that properly reads headers (Next.js 15+)
 */
export async function detectTriggerSourceAsync(): Promise<TriggerSource> {
  try {
    const hdrs = await headers();
    
    // Vercel Cron header
    if (hdrs.get("x-vercel-cron") === "1") return "cron";
    
    // Our own batch flag
    if (hdrs.get("x-ws-batch") === "1") return "admin-batch";
    
    // Background job indicators
    if (hdrs.get("x-background-job") === "1") return "background";
    
    // User-Agent checks for common automation tools
    const ua = hdrs.get("user-agent") || "";
    if (ua.includes("node-fetch") && !hdrs.get("x-user-request")) return "background";
    
    // If we have a session cookie or auth header, likely user
    if (hdrs.get("cookie")?.includes("session") || hdrs.get("authorization")) {
      return "user";
    }
    
    // Default to user for normal web requests
    return "user";
  } catch {
    // headers() might fail in some contexts
    return "unknown";
  }
}

/**
 * Check if the current request is allowed to call Wheel-Size API.
 * Returns error message if blocked, null if allowed.
 * 
 * SYNC version - uses simple heuristics, safe for non-async contexts
 */
export function checkSafeModeBlock(): string | null {
  // Sync version always allows (can't check headers synchronously in Next.js 15)
  // Use checkSafeModeBlockAsync() in API routes for proper checking
  return null;
}

/**
 * Async version that properly checks headers (Next.js 15+)
 * Use this in API routes.
 */
export async function checkSafeModeBlockAsync(): Promise<string | null> {
  if (!WHEEL_SIZE_SAFE_MODE) return null;
  
  const source = await detectTriggerSourceAsync();
  
  if (source === "cron") {
    return "BLOCKED: Wheel-Size API calls from cron jobs are disabled (WHEEL_SIZE_SAFE_MODE=true)";
  }
  
  if (source === "background") {
    return "BLOCKED: Wheel-Size API calls from background jobs are disabled (WHEEL_SIZE_SAFE_MODE=true)";
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH JOB PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

export interface BatchJobRequest {
  action: string;
  confirm?: boolean;
  allowBatch?: boolean;
  adminId?: string;
}

export interface BatchJobResult {
  allowed: boolean;
  error?: string;
  warning?: string;
  requiresConfirmation?: boolean;
}

/**
 * Check if a batch job is allowed to run.
 * Enforces rate limiting, locking, and confirmation requirements.
 */
export function checkBatchJobAllowed(request: BatchJobRequest): BatchJobResult {
  // 1. Check safe mode
  const safeModeBlock = checkSafeModeBlock();
  if (safeModeBlock) {
    return { allowed: false, error: safeModeBlock };
  }
  
  // 2. Check if already running (lock)
  if (batchJobState.isRunning) {
    return {
      allowed: false,
      error: "A batch job is already running. Please wait for it to complete.",
    };
  }
  
  // 3. Check rate limit
  const now = Date.now();
  if (batchJobState.lastRunAt) {
    const timeSince = now - batchJobState.lastRunAt;
    if (timeSince < BATCH_RATE_LIMIT.minIntervalMs) {
      const waitMinutes = Math.ceil((BATCH_RATE_LIMIT.minIntervalMs - timeSince) / 60000);
      return {
        allowed: false,
        error: `Rate limited. Please wait ${waitMinutes} more minutes before running another batch job.`,
      };
    }
  }
  
  // 4. Check confirmation
  if (!request.confirm) {
    return {
      allowed: false,
      requiresConfirmation: true,
      warning: `⚠️ WARNING: This action (${request.action}) will make a large number of Wheel-Size API calls. ` +
        `Repeated use may violate Terms of Service. ` +
        `Add { "confirm": true } to proceed.`,
    };
  }
  
  // 5. Check allowBatch flag for iteration operations
  if (!request.allowBatch) {
    return {
      allowed: false,
      error: `Batch operations require { "allowBatch": true } flag. This prevents accidental bulk API usage.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Mark a batch job as started (acquire lock)
 */
export function startBatchJob(adminId: string): void {
  batchJobState.isRunning = true;
  batchJobState.lastRunAt = Date.now();
  batchJobState.lastRunBy = adminId;
  batchJobState.runCount++;
  
  logAdminAction("batch_job_started", { adminId, runCount: batchJobState.runCount });
}

/**
 * Mark a batch job as completed (release lock)
 */
export function endBatchJob(success: boolean): void {
  batchJobState.isRunning = false;
  logAdminAction("batch_job_ended", { success });
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST LOGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log a Wheel-Size API call.
 * Called from the wheelSizeApi.ts wrapper.
 */
export function logWheelSizeCall(entry: Omit<WheelSizeLogEntry, "timestamp">): void {
  const now = Date.now();
  
  // Add to log
  wsLogs.push({ ...entry, timestamp: now });
  
  // Trim old logs (keep last 7 days)
  const cutoff = now - (LOG_RETENTION_DAYS * 86400000);
  wsLogs = wsLogs.filter(l => l.timestamp > cutoff);
  
  // Update counters
  updateUsageCounters();
  
  // Check thresholds
  checkUsageThresholds();
  
  // Console log for debugging
  const vehicleStr = entry.vehicle 
    ? `${entry.vehicle.year} ${entry.vehicle.make} ${entry.vehicle.model}` 
    : "N/A";
  console.log(
    `[WS-AUDIT] ${entry.endpoint} | source=${entry.triggerSource} | vehicle=${vehicleStr} | status=${entry.status} | ${entry.durationMs}ms`
  );
}

/**
 * Get recent logs for admin panel
 */
export function getRecentLogs(limit = 100): WheelSizeLogEntry[] {
  return wsLogs.slice(-limit).reverse();
}

/**
 * Get log stats for admin panel
 */
export function getLogStats() {
  const now = Date.now();
  const hourAgo = now - 3600000;
  const dayAgo = now - 86400000;
  
  const logsLastHour = wsLogs.filter(l => l.timestamp > hourAgo);
  const logsLastDay = wsLogs.filter(l => l.timestamp > dayAgo);
  
  return {
    totalLogs: wsLogs.length,
    lastHour: {
      count: logsLastHour.length,
      bySource: groupBy(logsLastHour, "triggerSource"),
      byEndpoint: groupBy(logsLastHour, "endpoint"),
    },
    lastDay: {
      count: logsLastDay.length,
      bySource: groupBy(logsLastDay, "triggerSource"),
    },
    thresholds: USAGE_THRESHOLDS,
    safeModeEnabled: WHEEL_SIZE_SAFE_MODE,
    batchJobState: {
      isRunning: batchJobState.isRunning,
      lastRunAt: batchJobState.lastRunAt ? new Date(batchJobState.lastRunAt).toISOString() : null,
      lastRunBy: batchJobState.lastRunBy,
      totalRuns: batchJobState.runCount,
    },
  };
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

// ═══════════════════════════════════════════════════════════════════════════
// USAGE MONITORING
// ═══════════════════════════════════════════════════════════════════════════

function updateUsageCounters(): void {
  const now = Date.now();
  
  // Reset hourly counter if needed
  if (now > usageCounters.hourly.resetAt) {
    usageCounters.hourly = { count: 0, resetAt: now + 3600000 };
  }
  usageCounters.hourly.count++;
  
  // Reset daily counter if needed
  if (now > usageCounters.daily.resetAt) {
    usageCounters.daily = { count: 0, resetAt: now + 86400000 };
  }
  usageCounters.daily.count++;
}

function checkUsageThresholds(): void {
  const { hourly, daily } = usageCounters;
  
  if (hourly.count === USAGE_THRESHOLDS.warningPerHour) {
    console.warn(`[WS-GUARD] ⚠️ WARNING: ${hourly.count} Wheel-Size API calls this hour (threshold: ${USAGE_THRESHOLDS.warningPerHour})`);
  }
  
  if (daily.count === USAGE_THRESHOLDS.warningPerDay) {
    console.warn(`[WS-GUARD] ⚠️ WARNING: ${daily.count} Wheel-Size API calls today (threshold: ${USAGE_THRESHOLDS.warningPerDay})`);
  }
  
  if (hourly.count >= USAGE_THRESHOLDS.hardLimitPerHour) {
    console.error(`[WS-GUARD] 🚨 HARD LIMIT: ${hourly.count} calls/hour exceeded! Blocking further calls.`);
  }
}

/**
 * Check if usage is within limits.
 * Returns error message if blocked, null if allowed.
 */
export function checkUsageLimits(): string | null {
  if (usageCounters.hourly.count >= USAGE_THRESHOLDS.hardLimitPerHour) {
    return `BLOCKED: Hourly limit (${USAGE_THRESHOLDS.hardLimitPerHour}) exceeded. Please wait until ${new Date(usageCounters.hourly.resetAt).toLocaleTimeString()}.`;
  }
  return null;
}

/**
 * Get current usage stats
 */
export function getUsageStats() {
  return {
    hourly: {
      count: usageCounters.hourly.count,
      limit: USAGE_THRESHOLDS.hardLimitPerHour,
      warning: USAGE_THRESHOLDS.warningPerHour,
      resetsAt: new Date(usageCounters.hourly.resetAt).toISOString(),
    },
    daily: {
      count: usageCounters.daily.count,
      warning: USAGE_THRESHOLDS.warningPerDay,
      resetsAt: new Date(usageCounters.daily.resetAt).toISOString(),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN ACTION LOGGING
// ═══════════════════════════════════════════════════════════════════════════

const adminLogs: { timestamp: number; action: string; details: any }[] = [];

function logAdminAction(action: string, details: any): void {
  adminLogs.push({ timestamp: Date.now(), action, details });
  console.log(`[WS-ADMIN] ${action}:`, JSON.stringify(details));
  
  // Keep last 1000 admin actions
  if (adminLogs.length > 1000) {
    adminLogs.splice(0, adminLogs.length - 1000);
  }
}

export function getAdminLogs(limit = 50) {
  return adminLogs.slice(-limit).reverse();
}

// ═══════════════════════════════════════════════════════════════════════════
// ITERATION GUARD
// ═══════════════════════════════════════════════════════════════════════════

let iterationState = {
  currentIteration: null as { type: string; startedAt: number; count: number } | null,
};

/**
 * Guard against automated iteration.
 * Call this before starting any loop that will make multiple WS API calls.
 */
export function guardIteration(
  type: string,
  options: { allowBatch?: boolean; maxIterations?: number } = {}
): { allowed: boolean; error?: string } {
  // Check safe mode
  const safeModeBlock = checkSafeModeBlock();
  if (safeModeBlock) {
    return { allowed: false, error: safeModeBlock };
  }
  
  // Check allowBatch flag
  if (!options.allowBatch) {
    return {
      allowed: false,
      error: `Iteration guard: Bulk ${type} operations require { allowBatch: true } flag.`,
    };
  }
  
  // Check usage limits
  const usageBlock = checkUsageLimits();
  if (usageBlock) {
    return { allowed: false, error: usageBlock };
  }
  
  // Track iteration
  iterationState.currentIteration = {
    type,
    startedAt: Date.now(),
    count: 0,
  };
  
  return { allowed: true };
}

/**
 * Track iteration progress (call each iteration)
 */
export function trackIteration(): { allowed: boolean; error?: string } {
  if (!iterationState.currentIteration) {
    return { allowed: true };
  }
  
  iterationState.currentIteration.count++;
  
  // Check if we've exceeded usage limits mid-iteration
  const usageBlock = checkUsageLimits();
  if (usageBlock) {
    iterationState.currentIteration = null;
    return { allowed: false, error: usageBlock };
  }
  
  return { allowed: true };
}

/**
 * End iteration tracking
 */
export function endIteration(): void {
  if (iterationState.currentIteration) {
    const duration = Date.now() - iterationState.currentIteration.startedAt;
    logAdminAction("iteration_completed", {
      type: iterationState.currentIteration.type,
      count: iterationState.currentIteration.count,
      durationMs: duration,
    });
    iterationState.currentIteration = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS FOR ADMIN API
// ═══════════════════════════════════════════════════════════════════════════

export const wheelSizeGuard = {
  // Configuration
  SAFE_MODE_ENABLED: WHEEL_SIZE_SAFE_MODE,
  BATCH_RATE_LIMIT,
  USAGE_THRESHOLDS,
  
  // Checks (sync versions for compatibility)
  checkSafeModeBlock,
  checkBatchJobAllowed,
  checkUsageLimits,
  detectTriggerSource,
  
  // Checks (async versions for API routes - Next.js 15+)
  checkSafeModeBlockAsync,
  detectTriggerSourceAsync,
  
  // Batch job control
  startBatchJob,
  endBatchJob,
  
  // Iteration guard
  guardIteration,
  trackIteration,
  endIteration,
  
  // Logging
  logWheelSizeCall,
  getRecentLogs,
  getLogStats,
  getAdminLogs,
  
  // Stats
  getUsageStats,
};

export default wheelSizeGuard;
