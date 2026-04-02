/**
 * API Key Management
 * 
 * Utilities for managing API keys including:
 * - Key generation
 * - Rotation
 * - Revocation
 * - Usage statistics
 * 
 * Note: In production, keys should be stored in a database.
 * This module provides utilities that work with env-based keys
 * and can be extended for database storage.
 */

import crypto from "crypto";
import type { ApiKeyConfig, ApiKeyTier, ApiKeyState } from "./types";
import { TIER_LIMITS } from "./types";

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new API key with prefix
 */
export function generateApiKey(prefix: string = "wt"): string {
  // Format: prefix_randomhex_checksum
  // Example: wt_a1b2c3d4e5f6g7h8_x9y0
  const random = crypto.randomBytes(16).toString("hex");
  const checksum = crypto
    .createHash("sha256")
    .update(random)
    .digest("hex")
    .slice(0, 4);
  
  return `${prefix}_${random}_${checksum}`;
}

/**
 * Validate API key format (not existence)
 */
export function isValidKeyFormat(key: string): boolean {
  // Format: prefix_32hexchars_4hexchars
  const pattern = /^[a-z]{2,4}_[a-f0-9]{32}_[a-f0-9]{4}$/i;
  return pattern.test(key);
}

/**
 * Generate client ID from key (for display)
 */
export function generateClientId(key: string, clientName?: string): string {
  if (clientName) {
    // Sanitize and slugify
    const slug = clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20);
    return slug || key.slice(0, 8);
  }
  
  // Use first 8 chars of key
  return key.slice(0, 8);
}

// ============================================================================
// Key Configuration Building
// ============================================================================

/**
 * Create a full ApiKeyConfig from parameters
 */
export function createKeyConfig(params: {
  key: string;
  clientId: string;
  clientName?: string;
  tier: ApiKeyTier;
  state?: ApiKeyState;
  expiresAt?: Date;
  metadata?: Record<string, string>;
}): ApiKeyConfig {
  const limits = TIER_LIMITS[params.tier];
  
  return {
    key: params.key,
    clientId: params.clientId,
    clientName: params.clientName || params.clientId,
    tier: params.tier,
    state: params.state || "active",
    rateLimit: limits.rpm,
    dailyLimit: limits.daily,
    createdAt: new Date().toISOString(),
    expiresAt: params.expiresAt?.toISOString(),
    metadata: params.metadata,
  };
}

/**
 * Serialize key config for env variable storage
 * Format: key:clientId:clientName:tier:state
 */
export function serializeKeyConfig(config: ApiKeyConfig): string {
  return [
    config.key,
    config.clientId,
    config.clientName || "",
    config.tier,
    config.state,
  ].join(":");
}

/**
 * Parse serialized key config
 */
export function parseKeyConfig(serialized: string): ApiKeyConfig | null {
  const parts = serialized.split(":");
  if (parts.length < 3) return null;
  
  const [key, clientId, clientName, tier, state] = parts;
  const validTier = (TIER_LIMITS[tier as ApiKeyTier] ? tier : "free") as ApiKeyTier;
  const validState = (["active", "suspended", "revoked"].includes(state) ? state : "active") as ApiKeyState;
  
  return createKeyConfig({
    key,
    clientId,
    clientName: clientName || undefined,
    tier: validTier,
    state: validState,
  });
}

// ============================================================================
// Key Rotation
// ============================================================================

export interface KeyRotationResult {
  oldKey: string;
  newKey: string;
  newConfig: ApiKeyConfig;
  envEntry: string;
  message: string;
}

/**
 * Generate a rotation: new key with same config
 */
export function rotateKey(currentConfig: ApiKeyConfig): KeyRotationResult {
  const newKey = generateApiKey();
  
  const newConfig: ApiKeyConfig = {
    ...currentConfig,
    key: newKey,
    createdAt: new Date().toISOString(),
    // Inherit other properties
  };
  
  return {
    oldKey: currentConfig.key,
    newKey,
    newConfig,
    envEntry: serializeKeyConfig(newConfig),
    message: `Key rotated for ${currentConfig.clientId}. Old key will be invalidated when env is updated.`,
  };
}

// ============================================================================
// Usage Statistics (In-Memory)
// ============================================================================

interface KeyUsageStats {
  clientId: string;
  totalRequests: number;
  totalErrors: number;
  lastUsed: number;
  
  // Rolling window stats
  hourlyRequests: number[];   // Last 24 hours
  dailyRequests: number[];    // Last 30 days
  
  // Endpoint breakdown
  endpointCounts: Record<string, number>;
  
  // Cache stats
  cacheHits: number;
  cacheMisses: number;
}

const usageStore = new Map<string, KeyUsageStats>();

/**
 * Record usage for a key
 */
export function recordKeyUsage(
  clientId: string,
  endpoint: string,
  success: boolean,
  cacheHit: boolean
): void {
  let stats = usageStore.get(clientId);
  
  if (!stats) {
    stats = {
      clientId,
      totalRequests: 0,
      totalErrors: 0,
      lastUsed: Date.now(),
      hourlyRequests: new Array(24).fill(0),
      dailyRequests: new Array(30).fill(0),
      endpointCounts: {},
      cacheHits: 0,
      cacheMisses: 0,
    };
    usageStore.set(clientId, stats);
  }
  
  stats.totalRequests++;
  if (!success) stats.totalErrors++;
  stats.lastUsed = Date.now();
  
  // Update hourly (current hour)
  const hour = new Date().getHours();
  stats.hourlyRequests[hour]++;
  
  // Update daily (current day of month - 1)
  const day = new Date().getDate() - 1;
  stats.dailyRequests[day]++;
  
  // Update endpoint counts
  stats.endpointCounts[endpoint] = (stats.endpointCounts[endpoint] || 0) + 1;
  
  // Cache stats
  if (cacheHit) stats.cacheHits++;
  else stats.cacheMisses++;
}

/**
 * Get usage stats for a key
 */
export function getKeyUsageStats(clientId: string): KeyUsageStats | undefined {
  return usageStore.get(clientId);
}

/**
 * Get all usage stats
 */
export function getAllUsageStats(): Map<string, KeyUsageStats> {
  return new Map(usageStore);
}

/**
 * Reset hourly counts (call at midnight)
 */
export function resetHourlyCounts(): void {
  for (const stats of usageStore.values()) {
    stats.hourlyRequests = new Array(24).fill(0);
  }
}

/**
 * Reset daily counts (call at month start)
 */
export function resetDailyCounts(): void {
  for (const stats of usageStore.values()) {
    stats.dailyRequests = new Array(30).fill(0);
  }
}

// ============================================================================
// Admin Operations
// ============================================================================

/**
 * Generate env variable entry for a new client
 */
export function generateEnvEntry(params: {
  clientName: string;
  tier: ApiKeyTier;
  expiresAt?: Date;
}): {
  key: string;
  clientId: string;
  envEntry: string;
  config: ApiKeyConfig;
} {
  const key = generateApiKey();
  const clientId = generateClientId(key, params.clientName);
  
  const config = createKeyConfig({
    key,
    clientId,
    clientName: params.clientName,
    tier: params.tier,
    expiresAt: params.expiresAt,
  });
  
  return {
    key,
    clientId,
    envEntry: serializeKeyConfig(config),
    config,
  };
}

/**
 * Suspend a key (mark as suspended)
 * Note: This returns the new env entry; actual update requires env modification
 */
export function suspendKey(config: ApiKeyConfig): {
  newEnvEntry: string;
  message: string;
} {
  const suspended: ApiKeyConfig = {
    ...config,
    state: "suspended",
  };
  
  return {
    newEnvEntry: serializeKeyConfig(suspended),
    message: `Key for ${config.clientId} suspended. Update PUBLIC_API_KEYS env to apply.`,
  };
}

/**
 * Revoke a key permanently
 */
export function revokeKey(config: ApiKeyConfig): {
  newEnvEntry: string;
  message: string;
} {
  const revoked: ApiKeyConfig = {
    ...config,
    state: "revoked",
  };
  
  return {
    newEnvEntry: serializeKeyConfig(revoked),
    message: `Key for ${config.clientId} revoked. Update PUBLIC_API_KEYS env to apply.`,
  };
}

/**
 * Reactivate a suspended key
 */
export function reactivateKey(config: ApiKeyConfig): {
  newEnvEntry: string;
  message: string;
} {
  const active: ApiKeyConfig = {
    ...config,
    state: "active",
  };
  
  return {
    newEnvEntry: serializeKeyConfig(active),
    message: `Key for ${config.clientId} reactivated. Update PUBLIC_API_KEYS env to apply.`,
  };
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Parse all keys from env and return as array
 */
export function parseAllKeysFromEnv(envValue: string): ApiKeyConfig[] {
  const configs: ApiKeyConfig[] = [];
  const entries = envValue.split(",").map(e => e.trim()).filter(Boolean);
  
  for (const entry of entries) {
    const config = parseKeyConfig(entry);
    if (config) configs.push(config);
  }
  
  return configs;
}

/**
 * Rebuild env variable from configs
 */
export function buildEnvFromConfigs(configs: ApiKeyConfig[]): string {
  return configs.map(serializeKeyConfig).join(",");
}

/**
 * Find config by client ID
 */
export function findConfigByClientId(
  configs: ApiKeyConfig[],
  clientId: string
): ApiKeyConfig | undefined {
  return configs.find(c => c.clientId === clientId);
}

/**
 * Find config by key
 */
export function findConfigByKey(
  configs: ApiKeyConfig[],
  key: string
): ApiKeyConfig | undefined {
  return configs.find(c => c.key === key);
}
