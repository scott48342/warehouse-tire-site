/**
 * STUB: Wheel-Size API Guard module
 * 
 * This module has been deprecated. Batch jobs and API guards are no longer
 * needed since external Wheel-Size API calls have been removed.
 * 
 * Exports are kept for backwards compatibility but are no-ops.
 */

export interface UsageStats {
  totalCallsToday: number;
  totalCallsThisMonth: number;
  batchJobInProgress: boolean;
  lastBatchJobStart: Date | null;
  estimatedCost: number;
}

export function checkBatchJobAllowed(_options?: {
  action?: string;
  confirm?: boolean;
  allowBatch?: boolean;
  adminId?: string;
}): {
  allowed: boolean;
  reason?: string;
  error?: string;
  warning?: string;
  requiresConfirmation?: boolean;
} {
  // Batch jobs are not needed - we use static data now
  return {
    allowed: false,
    reason: "External API batch jobs are disabled. Use static data import instead.",
    error: "External API batch jobs are disabled. Use static data import instead.",
  };
}

export function startBatchJob(_jobName: string): void {
  // No-op - batch jobs are disabled
  console.warn("[wheelSizeGuard] Batch jobs are disabled");
}

export function endBatchJob(_success?: boolean): void {
  // No-op - batch jobs are disabled
}

export function getUsageStats(): UsageStats {
  return {
    totalCallsToday: 0,
    totalCallsThisMonth: 0,
    batchJobInProgress: false,
    lastBatchJobStart: null,
    estimatedCost: 0,
  };
}

export function recordApiCall(): void {
  // No-op - API calls are disabled
}

export function isRateLimited(): boolean {
  // Never rate limited since we don't make calls
  return false;
}
