/**
 * Wheel-Size API Safety Governor
 * 
 * Protects Wheel-Size API access with strict rate limiting, caching,
 * kill switches, and audit logging.
 * 
 * SAFETY RULES:
 * 1. Only admin/manual/background jobs may call Wheel-Size
 * 2. Hard daily cap (default: 100)
 * 3. Hard hourly cap (default: 20)
 * 4. Minimum delay between calls (default: 5s)
 * 5. Kill switch via env var
 * 6. Auto-stop on 401/403/429/5xx/quota warnings
 * 7. Cache all responses
 * 8. Never re-call for cached fresh data
 * 9. Dry-run mode available
 * 10. Allowlist-only population (no full crawl)
 * 11. Full audit logging
 */

import { Redis } from "@upstash/redis";

// =============================================================================
// Types
// =============================================================================

export interface GovernorConfig {
  dailyCap: number;
  hourlyCap: number;
  minDelayMs: number;
  enabled: boolean;
  dryRun: boolean;
}

export interface GovernorState {
  enabled: boolean;
  dryRun: boolean;
  callsToday: number;
  callsThisHour: number;
  dailyCap: number;
  hourlyCap: number;
  minDelayMs: number;
  lastCallTime: string | null;
  lastCallEndpoint: string | null;
  lastError: string | null;
  lastErrorTime: string | null;
  killSwitchActive: boolean;
  killSwitchReason: string | null;
  cacheHitsToday: number;
  cacheMissesToday: number;
}

export interface AuditLogEntry {
  timestamp: string;
  endpoint: string;
  vehicle: string;
  params: Record<string, string>;
  status: "success" | "error" | "blocked" | "cached" | "dry-run";
  statusCode?: number;
  cacheHit: boolean;
  callsUsedToday: number;
  callsUsedThisHour: number;
  blockedReason?: string;
  durationMs?: number;
}

export interface CallResult<T = unknown> {
  success: boolean;
  data?: T;
  cached: boolean;
  blocked: boolean;
  blockedReason?: string;
  dryRun: boolean;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const REDIS_PREFIX = "ws_governor:";
const CACHE_PREFIX = "ws_cache:";
const AUDIT_LOG_KEY = `${REDIS_PREFIX}audit_log`;
const STATE_KEY = `${REDIS_PREFIX}state`;

// Default limits
const DEFAULT_DAILY_CAP = 100;
const DEFAULT_HOURLY_CAP = 20;
const DEFAULT_MIN_DELAY_MS = 5000;

// Cache TTL: 24 hours for successful responses
const CACHE_TTL_SUCCESS = 60 * 60 * 24;
// Cache TTL: 1 hour for errors (so we can retry)
const CACHE_TTL_ERROR = 60 * 60;

// Fatal error codes that trigger kill switch
const FATAL_ERROR_CODES = [401, 403];
// Rate limit codes
const RATE_LIMIT_CODES = [429];
// Server error codes (track consecutive failures)
const SERVER_ERROR_CODES = [500, 502, 503, 504];

// Max consecutive 5xx before kill switch
const MAX_CONSECUTIVE_5XX = 3;

// Audit log retention (keep last N entries)
const AUDIT_LOG_MAX_ENTRIES = 1000;

// =============================================================================
// Redis Client
// =============================================================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      throw new Error("Redis not configured for Wheel-Size governor");
    }
    
    redis = new Redis({ url, token });
  }
  return redis;
}

// =============================================================================
// Configuration
// =============================================================================

export function getConfig(): GovernorConfig {
  return {
    dailyCap: parseInt(process.env.WHEEL_SIZE_DAILY_CAP || String(DEFAULT_DAILY_CAP), 10),
    hourlyCap: parseInt(process.env.WHEEL_SIZE_HOURLY_CAP || String(DEFAULT_HOURLY_CAP), 10),
    minDelayMs: parseInt(process.env.WHEEL_SIZE_MIN_DELAY_MS || String(DEFAULT_MIN_DELAY_MS), 10),
    enabled: process.env.WHEEL_SIZE_SYNC_ENABLED !== "false",
    dryRun: process.env.WHEEL_SIZE_DRY_RUN === "true",
  };
}

// =============================================================================
// State Management
// =============================================================================

async function getStateKey(key: string): Promise<string | null> {
  const r = getRedis();
  return r.get(`${STATE_KEY}:${key}`);
}

async function setStateKey(key: string, value: string | number, ttl?: number): Promise<void> {
  const r = getRedis();
  if (ttl) {
    await r.setex(`${STATE_KEY}:${key}`, ttl, String(value));
  } else {
    await r.set(`${STATE_KEY}:${key}`, String(value));
  }
}

async function incrStateKey(key: string, ttl?: number): Promise<number> {
  const r = getRedis();
  const fullKey = `${STATE_KEY}:${key}`;
  const val = await r.incr(fullKey);
  if (ttl && val === 1) {
    await r.expire(fullKey, ttl);
  }
  return val;
}

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function getHourKey(): string {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}-${now.getUTCHours()}`; // YYYY-MM-DD-HH
}

// =============================================================================
// Public State API
// =============================================================================

export async function getGovernorState(): Promise<GovernorState> {
  const config = getConfig();
  const todayKey = getTodayKey();
  const hourKey = getHourKey();
  
  const [
    callsToday,
    callsThisHour,
    lastCallTime,
    lastCallEndpoint,
    lastError,
    lastErrorTime,
    killSwitchReason,
    cacheHitsToday,
    cacheMissesToday,
    consecutive5xx,
  ] = await Promise.all([
    getStateKey(`calls:${todayKey}`),
    getStateKey(`calls:${hourKey}`),
    getStateKey("lastCallTime"),
    getStateKey("lastCallEndpoint"),
    getStateKey("lastError"),
    getStateKey("lastErrorTime"),
    getStateKey("killSwitchReason"),
    getStateKey(`cacheHits:${todayKey}`),
    getStateKey(`cacheMisses:${todayKey}`),
    getStateKey("consecutive5xx"),
  ]);
  
  const killSwitchActive = !!killSwitchReason || !config.enabled;
  
  return {
    enabled: config.enabled,
    dryRun: config.dryRun,
    callsToday: parseInt(callsToday || "0", 10),
    callsThisHour: parseInt(callsThisHour || "0", 10),
    dailyCap: config.dailyCap,
    hourlyCap: config.hourlyCap,
    minDelayMs: config.minDelayMs,
    lastCallTime,
    lastCallEndpoint,
    lastError,
    lastErrorTime,
    killSwitchActive,
    killSwitchReason: killSwitchReason || (config.enabled ? null : "WHEEL_SIZE_SYNC_ENABLED=false"),
    cacheHitsToday: parseInt(cacheHitsToday || "0", 10),
    cacheMissesToday: parseInt(cacheMissesToday || "0", 10),
  };
}

export async function activateKillSwitch(reason: string): Promise<void> {
  await setStateKey("killSwitchReason", reason);
  console.error(`[ws-governor] KILL SWITCH ACTIVATED: ${reason}`);
}

export async function deactivateKillSwitch(): Promise<void> {
  const r = getRedis();
  await r.del(`${STATE_KEY}:killSwitchReason`);
  await r.del(`${STATE_KEY}:consecutive5xx`);
  console.log("[ws-governor] Kill switch deactivated");
}

export async function resetDailyCounters(): Promise<void> {
  const todayKey = getTodayKey();
  const r = getRedis();
  await r.del(`${STATE_KEY}:calls:${todayKey}`);
  await r.del(`${STATE_KEY}:cacheHits:${todayKey}`);
  await r.del(`${STATE_KEY}:cacheMisses:${todayKey}`);
  console.log("[ws-governor] Daily counters reset");
}

// =============================================================================
// Caching
// =============================================================================

function getCacheKey(endpoint: string, params: Record<string, string>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("&");
  return `${CACHE_PREFIX}${endpoint}:${sortedParams}`;
}

async function getFromCache<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const r = getRedis();
  const key = getCacheKey(endpoint, params);
  const cached = await r.get(key);
  if (cached) {
    await incrStateKey(`cacheHits:${getTodayKey()}`, 86400);
    return cached as T;
  }
  return null;
}

async function setInCache<T>(endpoint: string, params: Record<string, string>, data: T, ttl: number): Promise<void> {
  const r = getRedis();
  const key = getCacheKey(endpoint, params);
  await r.setex(key, ttl, JSON.stringify(data));
  await incrStateKey(`cacheMisses:${getTodayKey()}`, 86400);
}

// =============================================================================
// Audit Logging
// =============================================================================

async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  const r = getRedis();
  
  // Add to list
  await r.lpush(AUDIT_LOG_KEY, JSON.stringify(entry));
  
  // Trim to max entries
  await r.ltrim(AUDIT_LOG_KEY, 0, AUDIT_LOG_MAX_ENTRIES - 1);
  
  // Also log to console for immediate visibility
  const logLevel = entry.status === "error" || entry.status === "blocked" ? "warn" : "log";
  console[logLevel](`[ws-governor] ${entry.status.toUpperCase()} ${entry.endpoint}`, {
    vehicle: entry.vehicle,
    cached: entry.cacheHit,
    calls: `${entry.callsUsedToday}/${getConfig().dailyCap} daily`,
    reason: entry.blockedReason,
  });
}

export async function getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
  const r = getRedis();
  const entries = await r.lrange(AUDIT_LOG_KEY, 0, limit - 1);
  // Upstash Redis auto-deserializes JSON, so entries may already be objects
  return entries.map(e => {
    if (typeof e === "string") {
      return JSON.parse(e) as AuditLogEntry;
    }
    return e as AuditLogEntry;
  });
}

// =============================================================================
// Pre-call Checks
// =============================================================================

interface PreCallCheckResult {
  allowed: boolean;
  reason?: string;
  delayMs?: number;
}

async function preCallCheck(): Promise<PreCallCheckResult> {
  const config = getConfig();
  const state = await getGovernorState();
  
  // 1. Check kill switch
  if (state.killSwitchActive) {
    return { allowed: false, reason: `Kill switch active: ${state.killSwitchReason}` };
  }
  
  // 2. Check API key
  if (!process.env.WHEEL_SIZE_API_KEY) {
    return { allowed: false, reason: "Missing WHEEL_SIZE_API_KEY" };
  }
  
  // 3. Check daily cap
  if (state.callsToday >= config.dailyCap) {
    return { allowed: false, reason: `Daily cap reached (${state.callsToday}/${config.dailyCap})` };
  }
  
  // 4. Check hourly cap
  if (state.callsThisHour >= config.hourlyCap) {
    return { allowed: false, reason: `Hourly cap reached (${state.callsThisHour}/${config.hourlyCap})` };
  }
  
  // 5. Check minimum delay
  if (state.lastCallTime) {
    const lastCall = new Date(state.lastCallTime).getTime();
    const now = Date.now();
    const elapsed = now - lastCall;
    
    if (elapsed < config.minDelayMs) {
      const delayNeeded = config.minDelayMs - elapsed;
      return { allowed: true, delayMs: delayNeeded };
    }
  }
  
  return { allowed: true };
}

// =============================================================================
// Post-call Processing
// =============================================================================

async function processResponse(statusCode: number, endpoint: string): Promise<void> {
  const todayKey = getTodayKey();
  const hourKey = getHourKey();
  
  // Increment call counters
  await incrStateKey(`calls:${todayKey}`, 86400);
  await incrStateKey(`calls:${hourKey}`, 3600);
  
  // Update last call info
  await setStateKey("lastCallTime", new Date().toISOString());
  await setStateKey("lastCallEndpoint", endpoint);
  
  // Check for fatal errors
  if (FATAL_ERROR_CODES.includes(statusCode)) {
    await activateKillSwitch(`Fatal error: HTTP ${statusCode} (auth/forbidden)`);
    return;
  }
  
  // Check for rate limiting
  if (RATE_LIMIT_CODES.includes(statusCode)) {
    await activateKillSwitch(`Rate limited: HTTP ${statusCode}`);
    return;
  }
  
  // Track consecutive 5xx errors
  if (SERVER_ERROR_CODES.includes(statusCode)) {
    const consecutive = await incrStateKey("consecutive5xx");
    if (consecutive >= MAX_CONSECUTIVE_5XX) {
      await activateKillSwitch(`Too many server errors: ${consecutive} consecutive 5xx`);
    }
  } else {
    // Reset consecutive counter on success
    const r = getRedis();
    await r.del(`${STATE_KEY}:consecutive5xx`);
  }
}

async function recordError(error: string): Promise<void> {
  await setStateKey("lastError", error);
  await setStateKey("lastErrorTime", new Date().toISOString());
}

// =============================================================================
// Main API Call Wrapper
// =============================================================================

export interface WheelSizeCallOptions {
  endpoint: string;
  params: Record<string, string>;
  vehicle: string; // Human-readable vehicle description for logging
  fetcher: () => Promise<Response>; // The actual fetch function
  forceFresh?: boolean; // Skip cache (still respects rate limits)
}

export async function governedCall<T = unknown>(options: WheelSizeCallOptions): Promise<CallResult<T>> {
  const { endpoint, params, vehicle, fetcher, forceFresh } = options;
  const config = getConfig();
  const startTime = Date.now();
  
  // Get current state for logging
  const stateBefore = await getGovernorState();
  
  // Create audit entry template
  const auditEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    endpoint,
    vehicle,
    params,
    status: "success",
    cacheHit: false,
    callsUsedToday: stateBefore.callsToday,
    callsUsedThisHour: stateBefore.callsThisHour,
  };
  
  // 1. Check cache first (unless forceFresh)
  if (!forceFresh) {
    const cached = await getFromCache<T>(endpoint, params);
    if (cached) {
      auditEntry.status = "cached";
      auditEntry.cacheHit = true;
      await logAuditEntry(auditEntry);
      
      return {
        success: true,
        data: cached,
        cached: true,
        blocked: false,
        dryRun: false,
      };
    }
  }
  
  // 2. Pre-call checks
  const preCheck = await preCallCheck();
  
  if (!preCheck.allowed) {
    auditEntry.status = "blocked";
    auditEntry.blockedReason = preCheck.reason;
    await logAuditEntry(auditEntry);
    
    return {
      success: false,
      blocked: true,
      blockedReason: preCheck.reason,
      cached: false,
      dryRun: false,
    };
  }
  
  // 3. Apply delay if needed
  if (preCheck.delayMs && preCheck.delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, preCheck.delayMs));
  }
  
  // 4. Dry-run mode
  if (config.dryRun) {
    auditEntry.status = "dry-run";
    auditEntry.callsUsedToday = stateBefore.callsToday; // No increment in dry-run
    await logAuditEntry(auditEntry);
    
    return {
      success: true,
      data: undefined,
      cached: false,
      blocked: false,
      dryRun: true,
    };
  }
  
  // 5. Make the actual call
  try {
    const response = await fetcher();
    const durationMs = Date.now() - startTime;
    
    auditEntry.statusCode = response.status;
    auditEntry.durationMs = durationMs;
    auditEntry.callsUsedToday = stateBefore.callsToday + 1;
    auditEntry.callsUsedThisHour = stateBefore.callsThisHour + 1;
    
    // Process response for rate limiting/kill switch
    await processResponse(response.status, endpoint);
    
    if (!response.ok) {
      const errorText = await response.text();
      auditEntry.status = "error";
      auditEntry.blockedReason = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
      await recordError(auditEntry.blockedReason);
      await logAuditEntry(auditEntry);
      
      // Cache error responses briefly to prevent hammering
      await setInCache(endpoint, params, { error: true, status: response.status }, CACHE_TTL_ERROR);
      
      return {
        success: false,
        error: auditEntry.blockedReason,
        cached: false,
        blocked: false,
        dryRun: false,
      };
    }
    
    // Parse and cache successful response
    const data = await response.json() as T;
    await setInCache(endpoint, params, data, CACHE_TTL_SUCCESS);
    
    auditEntry.status = "success";
    await logAuditEntry(auditEntry);
    
    return {
      success: true,
      data,
      cached: false,
      blocked: false,
      dryRun: false,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    auditEntry.status = "error";
    auditEntry.blockedReason = `Network error: ${errorMsg}`;
    await recordError(auditEntry.blockedReason);
    await logAuditEntry(auditEntry);
    
    return {
      success: false,
      error: errorMsg,
      cached: false,
      blocked: false,
      dryRun: false,
    };
  }
}

// =============================================================================
// Allowlist Population Helper
// =============================================================================

export interface VehicleTarget {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

export interface PopulationOptions {
  vehicles: VehicleTarget[];
  dryRun?: boolean;
  onProgress?: (current: number, total: number, vehicle: VehicleTarget, result: CallResult) => void;
}

export interface PopulationResult {
  total: number;
  successful: number;
  cached: number;
  blocked: number;
  errors: number;
  dryRun: boolean;
  stoppedEarly: boolean;
  stoppedReason?: string;
}

/**
 * Process a list of specific vehicles (allowlist-only population).
 * NO recursive crawl. Each vehicle must be explicitly provided.
 */
export async function processVehicleAllowlist(
  options: PopulationOptions,
  fetchVehicleData: (vehicle: VehicleTarget) => Promise<Response>
): Promise<PopulationResult> {
  const { vehicles, dryRun, onProgress } = options;
  
  // Temporarily enable dry-run if requested
  const originalDryRun = process.env.WHEEL_SIZE_DRY_RUN;
  if (dryRun) {
    process.env.WHEEL_SIZE_DRY_RUN = "true";
  }
  
  const result: PopulationResult = {
    total: vehicles.length,
    successful: 0,
    cached: 0,
    blocked: 0,
    errors: 0,
    dryRun: dryRun || getConfig().dryRun,
    stoppedEarly: false,
  };
  
  try {
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
      
      const callResult = await governedCall({
        endpoint: "/modifications",
        params: {
          year: String(vehicle.year),
          make: vehicle.make,
          model: vehicle.model,
          ...(vehicle.trim ? { trim: vehicle.trim } : {}),
        },
        vehicle: vehicleStr,
        fetcher: () => fetchVehicleData(vehicle),
      });
      
      if (callResult.cached) {
        result.cached++;
      } else if (callResult.blocked) {
        result.blocked++;
        // Stop on block (cap reached or kill switch)
        result.stoppedEarly = true;
        result.stoppedReason = callResult.blockedReason;
        break;
      } else if (callResult.success) {
        result.successful++;
      } else {
        result.errors++;
      }
      
      // Check if kill switch was triggered
      const state = await getGovernorState();
      if (state.killSwitchActive) {
        result.stoppedEarly = true;
        result.stoppedReason = state.killSwitchReason || "Kill switch activated";
        break;
      }
      
      onProgress?.(i + 1, vehicles.length, vehicle, callResult);
    }
  } finally {
    // Restore original dry-run setting
    if (dryRun) {
      if (originalDryRun !== undefined) {
        process.env.WHEEL_SIZE_DRY_RUN = originalDryRun;
      } else {
        delete process.env.WHEEL_SIZE_DRY_RUN;
      }
    }
  }
  
  return result;
}

// =============================================================================
// Frontend Protection Check
// =============================================================================

/**
 * Call this at the start of any API route that might call Wheel-Size.
 * Throws if called from a frontend/customer context.
 */
export function assertAdminContext(callerContext: string): void {
  // This should be called with the request context to validate
  // For now, we rely on route organization
  if (!callerContext.includes("admin") && !callerContext.includes("cron") && !callerContext.includes("background")) {
    throw new Error(`[ws-governor] BLOCKED: Wheel-Size call from non-admin context: ${callerContext}`);
  }
}
