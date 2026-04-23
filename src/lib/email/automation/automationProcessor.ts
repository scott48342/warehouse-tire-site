/**
 * Email Automation Processor
 * 
 * Unified processor for all automation flows.
 * Called by cron jobs to process pending emails.
 * 
 * @created 2026-04-23
 */

import { processAbandonedCartEmails, EMAIL_SAFE_MODE as CART_SAFE_MODE } from "@/lib/cart/abandonedCartEmail";
import { processExitIntentFollowups, EXIT_EMAIL_SAFE_MODE } from "./exitIntentEmail";
import { getQueueStats } from "./emailQueue";

// ============================================================================
// Types
// ============================================================================

export interface AutomationResult {
  abandonedCart: {
    processed: number;
    sent: number;
    logged: number;
    skipped: number;
    errors: number;
  };
  exitIntent: {
    processed: number;
    sent: number;
    logged: number;
    skipped: number;
    errors: number;
  };
  safeMode: {
    abandonedCart: boolean;
    exitIntent: boolean;
  };
  durationMs: number;
}

export interface AutomationStats {
  queue: {
    exitIntentPending: number;
    abandonedCartPending: {
      first: number;
      second: number;
      third: number;
    };
  };
  safeMode: {
    abandonedCart: boolean;
    exitIntent: boolean;
  };
}

// ============================================================================
// Processor
// ============================================================================

/**
 * Process all automation flows
 * Called by cron job
 */
export async function processAllAutomations(): Promise<AutomationResult> {
  const startTime = Date.now();

  console.log("[automationProcessor] Starting automation processing...");

  // Process abandoned cart emails (existing)
  let abandonedResult = { processed: 0, sent: 0, logged: 0, skipped: 0, errors: 0 };
  try {
    const result = await processAbandonedCartEmails();
    abandonedResult = {
      processed: result.processed,
      sent: result.sent,
      logged: result.logged,
      skipped: result.skipped,
      errors: result.errors,
    };
    console.log("[automationProcessor] Abandoned cart emails:", abandonedResult);
  } catch (err: any) {
    console.error("[automationProcessor] Abandoned cart error:", err.message);
    abandonedResult.errors = 1;
  }

  // Process exit intent follow-ups (new)
  let exitResult = { processed: 0, sent: 0, logged: 0, skipped: 0, errors: 0 };
  try {
    const result = await processExitIntentFollowups();
    exitResult = {
      processed: result.processed,
      sent: result.sent,
      logged: result.logged,
      skipped: result.skipped,
      errors: result.errors,
    };
    console.log("[automationProcessor] Exit intent emails:", exitResult);
  } catch (err: any) {
    console.error("[automationProcessor] Exit intent error:", err.message);
    exitResult.errors = 1;
  }

  const durationMs = Date.now() - startTime;

  return {
    abandonedCart: abandonedResult,
    exitIntent: exitResult,
    safeMode: {
      abandonedCart: CART_SAFE_MODE,
      exitIntent: EXIT_EMAIL_SAFE_MODE,
    },
    durationMs,
  };
}

/**
 * Get current automation stats
 */
export async function getAutomationStats(): Promise<AutomationStats> {
  const queue = await getQueueStats();

  return {
    queue,
    safeMode: {
      abandonedCart: CART_SAFE_MODE,
      exitIntent: EXIT_EMAIL_SAFE_MODE,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export const automationProcessor = {
  processAllAutomations,
  getAutomationStats,
};

export default automationProcessor;
