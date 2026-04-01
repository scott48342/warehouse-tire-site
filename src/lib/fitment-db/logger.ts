/**
 * FITMENT LOGGING
 * 
 * Logs fallback behavior and missing optional fields for monitoring.
 * Set FITMENT_LOG_LEVEL=debug for verbose output.
 * 
 * Usage:
 *   import { fitmentLog } from './logger';
 *   fitmentLog.fallback("alias_used", { from: "f-350", to: "f-350-super-duty" });
 *   fitmentLog.missing("offset_data", { vehicle: "2015 Ford F-250" });
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface FallbackEvent {
  type: 
    | "alias_used"           // Model alias was used to resolve
    | "trim_fallback"        // Fell back to displayTrim match
    | "year_inherit"         // Inherited data from adjacent year
    | "base_trim_fallback"   // Fell back to Base trim
    | "derived_wheel_size"   // Wheel size derived from tire
    | "canonical_fallback";  // Used canonical key fallback
  from: string;
  to: string;
  vehicle?: string;
  details?: Record<string, unknown>;
}

export interface MissingFieldEvent {
  field: 
    | "offset_data"
    | "wheel_sizes"
    | "tire_sizes"
    | "thread_size"
    | "submodel";
  vehicle: string;
  severity: "low" | "medium" | "high";
  details?: Record<string, unknown>;
}

// ============================================================================
// Logger Configuration
// ============================================================================

const LOG_LEVEL: LogLevel = (process.env.FITMENT_LOG_LEVEL as LogLevel) || "info";
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

// ============================================================================
// In-Memory Stats (for monitoring)
// ============================================================================

interface FitmentStats {
  fallbacks: Record<string, number>;
  missingFields: Record<string, number>;
  lastReset: string;
}

const stats: FitmentStats = {
  fallbacks: {},
  missingFields: {},
  lastReset: formatTimestamp(),
};

// ============================================================================
// Logger Functions
// ============================================================================

export const fitmentLog = {
  /**
   * Log a fallback behavior
   */
  fallback(type: FallbackEvent["type"], details: Omit<FallbackEvent, "type">): void {
    // Track stats
    stats.fallbacks[type] = (stats.fallbacks[type] || 0) + 1;

    if (!shouldLog("info")) return;

    const message = `[FITMENT:FALLBACK] ${type}: ${details.from} → ${details.to}`;
    const meta = details.vehicle ? ` (${details.vehicle})` : "";
    
    console.log(`${formatTimestamp()} ${message}${meta}`);
    
    if (shouldLog("debug") && details.details) {
      console.log(`  details: ${JSON.stringify(details.details)}`);
    }
  },

  /**
   * Log a missing optional field
   */
  missing(field: MissingFieldEvent["field"], details: Omit<MissingFieldEvent, "field">): void {
    // Track stats
    stats.missingFields[field] = (stats.missingFields[field] || 0) + 1;

    // Only log high severity or if debug mode
    if (details.severity !== "high" && !shouldLog("debug")) return;

    const level = details.severity === "high" ? "warn" : "info";
    if (!shouldLog(level)) return;

    const message = `[FITMENT:MISSING] ${field} for ${details.vehicle}`;
    
    if (details.severity === "high") {
      console.warn(`${formatTimestamp()} ${message}`);
    } else {
      console.log(`${formatTimestamp()} ${message}`);
    }
  },

  /**
   * Log a resolution success (debug only)
   */
  resolved(method: string, vehicle: string, timeMs?: number): void {
    if (!shouldLog("debug")) return;

    const time = timeMs !== undefined ? ` (${timeMs}ms)` : "";
    console.log(`${formatTimestamp()} [FITMENT:RESOLVED] ${method}: ${vehicle}${time}`);
  },

  /**
   * Log a resolution failure
   */
  notFound(vehicle: string, triedMethods: string[]): void {
    if (!shouldLog("warn")) return;

    console.warn(`${formatTimestamp()} [FITMENT:NOT_FOUND] ${vehicle}`);
    console.warn(`  tried: ${triedMethods.join(" → ")}`);
  },

  /**
   * Log a validation error
   */
  validationError(error: string, context?: Record<string, unknown>): void {
    if (!shouldLog("error")) return;

    console.error(`${formatTimestamp()} [FITMENT:VALIDATION_ERROR] ${error}`);
    if (context) {
      console.error(`  context: ${JSON.stringify(context)}`);
    }
  },

  /**
   * Get current stats
   */
  getStats(): FitmentStats {
    return { ...stats };
  },

  /**
   * Reset stats
   */
  resetStats(): void {
    stats.fallbacks = {};
    stats.missingFields = {};
    stats.lastReset = formatTimestamp();
  },

  /**
   * Print stats summary
   */
  printStats(): void {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  FITMENT STATS");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Since: ${stats.lastReset}\n`);

    console.log("  FALLBACKS:");
    for (const [type, count] of Object.entries(stats.fallbacks)) {
      console.log(`    ${type}: ${count}`);
    }
    if (Object.keys(stats.fallbacks).length === 0) {
      console.log("    (none)");
    }

    console.log("\n  MISSING FIELDS:");
    for (const [field, count] of Object.entries(stats.missingFields)) {
      console.log(`    ${field}: ${count}`);
    }
    if (Object.keys(stats.missingFields).length === 0) {
      console.log("    (none)");
    }

    console.log("═══════════════════════════════════════════════════════════════\n");
  },
};

// ============================================================================
// Export for testing
// ============================================================================

export function __resetStats(): void {
  fitmentLog.resetStats();
}
