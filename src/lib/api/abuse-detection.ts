/**
 * Abuse Detection System
 * 
 * Detects scraping patterns, systematic enumeration, and suspicious behavior.
 * Works alongside rate limiting to identify and block bad actors.
 */

// ============================================================================
// Types
// ============================================================================

export interface RequestSignature {
  clientId: string;
  endpoint: string;
  params: Record<string, string>;
  timestamp: number;
  ip?: string;
  userAgent?: string;
}

export interface AbuseScore {
  score: number;          // 0-100, higher = more suspicious
  reasons: string[];      // Why the score is high
  action: "allow" | "warn" | "throttle" | "block" | "suspend";
  confidence: number;     // 0-1
}

export interface ClientBehavior {
  clientId: string;
  firstSeen: number;
  lastSeen: number;
  
  // Request patterns
  totalRequests: number;
  uniqueEndpoints: Set<string>;
  uniqueYears: Set<string>;
  uniqueMakes: Set<string>;
  uniqueModels: Set<string>;
  uniqueTrims: Set<string>;
  
  // Timing patterns
  requestTimes: number[];     // Last N request timestamps
  avgInterval: number;        // Average ms between requests
  minInterval: number;        // Minimum ms between requests
  
  // Sweep detection
  sweepPatterns: SweepPattern[];
  
  // Scores
  abuseScore: number;
  lastScoreUpdate: number;
  warnings: number;
  throttleUntil?: number;
  suspendedUntil?: number;
}

export interface SweepPattern {
  type: "year" | "make" | "model" | "trim" | "full-ymm";
  startTime: number;
  count: number;
  values: string[];
}

// ============================================================================
// Configuration
// ============================================================================

export const ABUSE_CONFIG = {
  // Request timing thresholds
  MIN_HUMAN_INTERVAL_MS: 200,      // Humans can't click faster than 200ms
  SUSPICIOUS_INTERVAL_MS: 500,     // Less than 500ms is suspicious
  BOT_INTERVAL_MS: 100,            // Less than 100ms is definitely automated
  
  // Pattern detection windows
  PATTERN_WINDOW_MS: 60_000,       // 1 minute
  SWEEP_WINDOW_MS: 300_000,        // 5 minutes for sweep detection
  
  // Thresholds for sweep detection
  YEAR_SWEEP_THRESHOLD: 10,        // >10 different years in window = sweep
  MAKE_SWEEP_THRESHOLD: 15,        // >15 different makes = sweep
  MODEL_SWEEP_THRESHOLD: 20,       // >20 different models = sweep
  FULL_YMM_SWEEP_THRESHOLD: 50,    // >50 unique YMM combos = sweep
  
  // Score thresholds for actions
  SCORE_WARN: 30,
  SCORE_THROTTLE: 50,
  SCORE_BLOCK: 70,
  SCORE_SUSPEND: 90,
  
  // Request tracking
  MAX_TRACKED_REQUESTS: 1000,      // Keep last N requests per client
  MAX_TRACKED_TIMES: 100,          // Keep last N timestamps
  
  // Throttle/suspend durations
  THROTTLE_DURATION_MS: 300_000,   // 5 minutes
  SUSPEND_DURATION_MS: 3600_000,   // 1 hour
  
  // Burst detection
  BURST_WINDOW_MS: 1000,           // 1 second
  BURST_THRESHOLD: 10,             // >10 requests/second is burst
};

// ============================================================================
// Behavior Store (in-memory, could be Redis in production)
// ============================================================================

const behaviorStore = new Map<string, ClientBehavior>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const staleThreshold = now - 3600_000; // 1 hour
  
  for (const [clientId, behavior] of behaviorStore) {
    if (behavior.lastSeen < staleThreshold) {
      behaviorStore.delete(clientId);
    }
  }
}, 600_000);

// ============================================================================
// Core Detection Functions
// ============================================================================

/**
 * Record a request and calculate abuse score
 */
export function recordRequest(sig: RequestSignature): AbuseScore {
  const now = Date.now();
  let behavior = behaviorStore.get(sig.clientId);
  
  if (!behavior) {
    behavior = createEmptyBehavior(sig.clientId, now);
    behaviorStore.set(sig.clientId, behavior);
  }
  
  // Update behavior
  updateBehavior(behavior, sig, now);
  
  // Calculate abuse score
  const score = calculateAbuseScore(behavior, sig, now);
  
  // Store score
  behavior.abuseScore = score.score;
  behavior.lastScoreUpdate = now;
  
  return score;
}

/**
 * Get current abuse status for a client (for rate limit decisions)
 */
export function getAbuseStatus(clientId: string): {
  isThrottled: boolean;
  isSuspended: boolean;
  score: number;
  throttleUntil?: number;
  suspendedUntil?: number;
} {
  const behavior = behaviorStore.get(clientId);
  const now = Date.now();
  
  if (!behavior) {
    return { isThrottled: false, isSuspended: false, score: 0 };
  }
  
  const isThrottled = behavior.throttleUntil ? behavior.throttleUntil > now : false;
  const isSuspended = behavior.suspendedUntil ? behavior.suspendedUntil > now : false;
  
  return {
    isThrottled,
    isSuspended,
    score: behavior.abuseScore,
    throttleUntil: behavior.throttleUntil,
    suspendedUntil: behavior.suspendedUntil,
  };
}

/**
 * Manually flag a client for throttling
 */
export function throttleClient(clientId: string, durationMs: number = ABUSE_CONFIG.THROTTLE_DURATION_MS): void {
  const behavior = behaviorStore.get(clientId);
  if (behavior) {
    behavior.throttleUntil = Date.now() + durationMs;
    behavior.warnings++;
  }
}

/**
 * Manually suspend a client
 */
export function suspendClient(clientId: string, durationMs: number = ABUSE_CONFIG.SUSPEND_DURATION_MS): void {
  const behavior = behaviorStore.get(clientId);
  if (behavior) {
    behavior.suspendedUntil = Date.now() + durationMs;
  }
}

/**
 * Clear throttle/suspend for a client
 */
export function clearAbuseFlags(clientId: string): void {
  const behavior = behaviorStore.get(clientId);
  if (behavior) {
    behavior.throttleUntil = undefined;
    behavior.suspendedUntil = undefined;
    behavior.warnings = 0;
    behavior.abuseScore = 0;
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

function createEmptyBehavior(clientId: string, now: number): ClientBehavior {
  return {
    clientId,
    firstSeen: now,
    lastSeen: now,
    totalRequests: 0,
    uniqueEndpoints: new Set(),
    uniqueYears: new Set(),
    uniqueMakes: new Set(),
    uniqueModels: new Set(),
    uniqueTrims: new Set(),
    requestTimes: [],
    avgInterval: 0,
    minInterval: Infinity,
    sweepPatterns: [],
    abuseScore: 0,
    lastScoreUpdate: now,
    warnings: 0,
  };
}

function updateBehavior(behavior: ClientBehavior, sig: RequestSignature, now: number): void {
  // Update timing
  const lastTime = behavior.requestTimes[behavior.requestTimes.length - 1];
  if (lastTime) {
    const interval = now - lastTime;
    behavior.minInterval = Math.min(behavior.minInterval, interval);
    
    // Running average
    const n = behavior.requestTimes.length;
    behavior.avgInterval = (behavior.avgInterval * (n - 1) + interval) / n;
  }
  
  behavior.requestTimes.push(now);
  if (behavior.requestTimes.length > ABUSE_CONFIG.MAX_TRACKED_TIMES) {
    behavior.requestTimes.shift();
  }
  
  behavior.totalRequests++;
  behavior.lastSeen = now;
  behavior.uniqueEndpoints.add(sig.endpoint);
  
  // Track YMM parameters
  if (sig.params.year) behavior.uniqueYears.add(sig.params.year);
  if (sig.params.make) behavior.uniqueMakes.add(sig.params.make.toLowerCase());
  if (sig.params.model) behavior.uniqueModels.add(sig.params.model.toLowerCase());
  if (sig.params.trim) behavior.uniqueTrims.add(sig.params.trim.toLowerCase());
  
  // Detect sweep patterns
  detectSweepPatterns(behavior, sig, now);
}

function detectSweepPatterns(behavior: ClientBehavior, sig: RequestSignature, now: number): void {
  // Clean old patterns
  behavior.sweepPatterns = behavior.sweepPatterns.filter(
    p => now - p.startTime < ABUSE_CONFIG.SWEEP_WINDOW_MS
  );
  
  // Track year sweeps
  if (sig.params.year && !sig.params.make) {
    updateSweepPattern(behavior, "year", sig.params.year, now);
  }
  
  // Track make sweeps (year fixed, iterating makes)
  if (sig.params.make && !sig.params.model) {
    updateSweepPattern(behavior, "make", sig.params.make, now);
  }
  
  // Track model sweeps
  if (sig.params.model && !sig.params.trim) {
    updateSweepPattern(behavior, "model", sig.params.model, now);
  }
  
  // Track full YMM sweeps
  if (sig.params.year && sig.params.make && sig.params.model) {
    const combo = `${sig.params.year}:${sig.params.make}:${sig.params.model}`;
    updateSweepPattern(behavior, "full-ymm", combo, now);
  }
}

function updateSweepPattern(
  behavior: ClientBehavior,
  type: SweepPattern["type"],
  value: string,
  now: number
): void {
  let pattern = behavior.sweepPatterns.find(p => p.type === type);
  
  if (!pattern) {
    pattern = { type, startTime: now, count: 0, values: [] };
    behavior.sweepPatterns.push(pattern);
  }
  
  if (!pattern.values.includes(value)) {
    pattern.values.push(value);
    pattern.count++;
  }
}

function calculateAbuseScore(behavior: ClientBehavior, sig: RequestSignature, now: number): AbuseScore {
  const reasons: string[] = [];
  let score = 0;
  
  // 1. Timing analysis
  if (behavior.minInterval < ABUSE_CONFIG.BOT_INTERVAL_MS) {
    score += 40;
    reasons.push(`Inhuman request speed (${behavior.minInterval}ms min interval)`);
  } else if (behavior.minInterval < ABUSE_CONFIG.MIN_HUMAN_INTERVAL_MS) {
    score += 25;
    reasons.push(`Very fast requests (${behavior.minInterval}ms min interval)`);
  } else if (behavior.avgInterval < ABUSE_CONFIG.SUSPICIOUS_INTERVAL_MS) {
    score += 10;
    reasons.push(`Suspicious avg interval (${Math.round(behavior.avgInterval)}ms)`);
  }
  
  // 2. Burst detection
  const recentRequests = behavior.requestTimes.filter(
    t => now - t < ABUSE_CONFIG.BURST_WINDOW_MS
  ).length;
  if (recentRequests > ABUSE_CONFIG.BURST_THRESHOLD) {
    score += 30;
    reasons.push(`Request burst (${recentRequests} in 1 second)`);
  }
  
  // 3. Sweep pattern detection
  for (const pattern of behavior.sweepPatterns) {
    const threshold = getSweepThreshold(pattern.type);
    if (pattern.count > threshold) {
      score += 25;
      reasons.push(`${pattern.type} sweep detected (${pattern.count} unique values)`);
    } else if (pattern.count > threshold * 0.7) {
      score += 10;
      reasons.push(`Possible ${pattern.type} sweep (${pattern.count} unique values)`);
    }
  }
  
  // 4. Coverage breadth (looking at too much data)
  const sessionMinutes = (now - behavior.firstSeen) / 60000;
  if (sessionMinutes > 1) {
    const ymmRate = behavior.uniqueModels.size / sessionMinutes;
    if (ymmRate > 10) {
      score += 20;
      reasons.push(`High data coverage rate (${ymmRate.toFixed(1)} models/min)`);
    }
  }
  
  // 5. Full catalog enumeration attempt
  if (behavior.uniqueYears.size > 20 && behavior.uniqueMakes.size > 30) {
    score += 30;
    reasons.push("Systematic catalog enumeration detected");
  }
  
  // 6. No filtering queries (trying to get all data)
  if (!sig.params.year && !sig.params.make && behavior.totalRequests > 10) {
    score += 15;
    reasons.push("Unfiltered queries (possible bulk download)");
  }
  
  // 7. Previous warnings increase score
  score += behavior.warnings * 10;
  if (behavior.warnings > 0) {
    reasons.push(`Previous warnings: ${behavior.warnings}`);
  }
  
  // Cap at 100
  score = Math.min(100, score);
  
  // Determine action
  let action: AbuseScore["action"] = "allow";
  if (score >= ABUSE_CONFIG.SCORE_SUSPEND) {
    action = "suspend";
  } else if (score >= ABUSE_CONFIG.SCORE_BLOCK) {
    action = "block";
  } else if (score >= ABUSE_CONFIG.SCORE_THROTTLE) {
    action = "throttle";
  } else if (score >= ABUSE_CONFIG.SCORE_WARN) {
    action = "warn";
  }
  
  // Auto-apply throttle/suspend
  if (action === "throttle" && !behavior.throttleUntil) {
    throttleClient(behavior.clientId);
  } else if (action === "suspend" && !behavior.suspendedUntil) {
    suspendClient(behavior.clientId);
  }
  
  return {
    score,
    reasons,
    action,
    confidence: Math.min(1, behavior.totalRequests / 20), // More confident with more data
  };
}

function getSweepThreshold(type: SweepPattern["type"]): number {
  switch (type) {
    case "year": return ABUSE_CONFIG.YEAR_SWEEP_THRESHOLD;
    case "make": return ABUSE_CONFIG.MAKE_SWEEP_THRESHOLD;
    case "model": return ABUSE_CONFIG.MODEL_SWEEP_THRESHOLD;
    case "trim": return ABUSE_CONFIG.MODEL_SWEEP_THRESHOLD;
    case "full-ymm": return ABUSE_CONFIG.FULL_YMM_SWEEP_THRESHOLD;
    default: return 50;
  }
}

// ============================================================================
// Logging & Monitoring
// ============================================================================

export interface AbuseEvent {
  timestamp: string;
  clientId: string;
  action: AbuseScore["action"];
  score: number;
  reasons: string[];
  ip?: string;
  userAgent?: string;
}

const abuseEvents: AbuseEvent[] = [];
const MAX_ABUSE_EVENTS = 1000;

export function logAbuseEvent(
  clientId: string,
  score: AbuseScore,
  ip?: string,
  userAgent?: string
): void {
  if (score.action === "allow") return; // Don't log normal requests
  
  const event: AbuseEvent = {
    timestamp: new Date().toISOString(),
    clientId,
    action: score.action,
    score: score.score,
    reasons: score.reasons,
    ip,
    userAgent,
  };
  
  abuseEvents.push(event);
  if (abuseEvents.length > MAX_ABUSE_EVENTS) {
    abuseEvents.shift();
  }
  
  // Log to console for production monitoring
  console.log(JSON.stringify({
    level: score.action === "suspend" ? "error" : score.action === "block" ? "warn" : "info",
    type: "abuse_detected",
    ...event,
  }));
}

export function getRecentAbuseEvents(limit: number = 100): AbuseEvent[] {
  return abuseEvents.slice(-limit);
}

export function getClientBehavior(clientId: string): ClientBehavior | undefined {
  return behaviorStore.get(clientId);
}

export function getAllClientBehaviors(): Map<string, ClientBehavior> {
  return new Map(behaviorStore);
}
