/**
 * Public API Library
 * 
 * Exports for public API routes only.
 * Internal storefront code should NOT import from here.
 */

// Types
export * from "./types";

// Auth
export { 
  validateApiKey, 
  unauthorizedResponse, 
  rateLimitedResponse,
  type ValidateKeyResult,
} from "./auth";

// Rate Limiting
export { 
  checkRateLimit, 
  addRateLimitHeaders,
  getRateLimitStatus,
  setThrottleMultiplier,
  resetThrottle,
  type RateLimitResult,
} from "./rate-limit";

// Caching
export {
  getFromCache,
  setInCache,
  makeCacheKey,
  invalidateCache,
  getCacheStats,
} from "./cache";

// Logging
export {
  logRequest,
  createLogEntry,
  getClientStats,
  getAllClientStats,
} from "./usage-logger";

// Middleware
export { 
  withPublicApi, 
  successResponse, 
  errorResponse,
  type PublicApiContext,
  type PublicApiHandler,
  type WithPublicApiOptions,
} from "./middleware";

// Abuse Detection
export {
  recordRequest,
  getAbuseStatus,
  throttleClient,
  suspendClient,
  clearAbuseFlags,
  logAbuseEvent,
  getRecentAbuseEvents,
  getClientBehavior,
  getAllClientBehaviors,
  ABUSE_CONFIG,
  type AbuseScore,
  type AbuseEvent,
  type ClientBehavior,
  type RequestSignature,
} from "./abuse-detection";

// Request Validation
export {
  validateRequest,
  validationErrorResponse,
  isKnownBot,
  isSuspiciousUserAgent,
  trackIpReputation,
  isIpSuspicious,
  ENDPOINT_REQUIREMENTS,
  BOT_USER_AGENTS,
  type ValidationResult,
  type EndpointRequirements,
} from "./request-validation";

// Key Management
export {
  generateApiKey,
  isValidKeyFormat,
  generateClientId,
  createKeyConfig,
  serializeKeyConfig,
  parseKeyConfig,
  rotateKey,
  recordKeyUsage,
  getKeyUsageStats,
  getAllUsageStats,
  generateEnvEntry,
  suspendKey,
  revokeKey,
  reactivateKey,
  parseAllKeysFromEnv,
  buildEnvFromConfigs,
  findConfigByClientId,
  findConfigByKey,
  type KeyRotationResult,
} from "./key-management";

// Service
export * from "./public-fitment-service";
