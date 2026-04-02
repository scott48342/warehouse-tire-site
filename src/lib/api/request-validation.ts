/**
 * Request Validation
 * 
 * Validates API requests to block bulk/unrealistic queries.
 * Ensures callers are making legitimate, specific lookups.
 */

import { NextResponse } from "next/server";

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  suggestion?: string;
}

export interface EndpointRequirements {
  requiredParams?: string[];           // Must have these params
  oneOfParams?: string[][];            // Must have at least one from each group
  forbiddenPatterns?: RegExp[];        // Block these patterns
  maxResultsHint?: number;             // Warn if query could return too many
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Define requirements per endpoint
 */
export const ENDPOINT_REQUIREMENTS: Record<string, EndpointRequirements> = {
  // Specs endpoint requires full YMM at minimum
  "/api/fitment/specs": {
    requiredParams: ["year", "make", "model"],
  },
  
  // Search requires at least some filtering
  "/api/fitment/search": {
    oneOfParams: [["year"], ["make"], ["bolt_pattern"]],
  },
  
  // Models requires year and make
  "/api/fitment/models": {
    requiredParams: ["year", "make"],
  },
  
  // Trims requires year, make, model
  "/api/fitment/trims": {
    requiredParams: ["year", "make", "model"],
  },
  
  // Makes only requires year (prevents full catalog dump)
  "/api/fitment/makes": {
    requiredParams: ["year"],
  },
  
  // Years has no requirement (small dataset)
  "/api/fitment/years": {},
};

/**
 * Known bot user-agents to block or flag
 */
export const BOT_USER_AGENTS = [
  /curl/i,
  /wget/i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /httpclient/i,
  /java\//i,
  /go-http-client/i,
  /libwww/i,
  /perl/i,
  /php\//i,
  /axios\/\d/i,      // Axios without browser context
  /node-fetch/i,
  /undici/i,
];

/**
 * Suspicious patterns in parameters
 */
export const SUSPICIOUS_PARAM_PATTERNS = [
  /^all$/i,
  /^\*$/,
  /^%$/,
  /^_$/,
  /^\.+$/,
  /^any$/i,
  /^null$/i,
  /^undefined$/i,
  /^select/i,        // SQL injection attempt
  /union\s+select/i,
  /<script/i,        // XSS attempt
  /javascript:/i,
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate request parameters for an endpoint
 */
export function validateRequest(
  endpoint: string,
  params: Record<string, string>,
  userAgent?: string
): ValidationResult {
  // 1. Check for suspicious patterns in params
  for (const [key, value] of Object.entries(params)) {
    for (const pattern of SUSPICIOUS_PARAM_PATTERNS) {
      if (pattern.test(value)) {
        return {
          valid: false,
          error: `Invalid parameter value for '${key}'`,
          errorCode: "INVALID_PARAM_VALUE",
        };
      }
    }
    
    // Check for excessively long values
    if (value.length > 200) {
      return {
        valid: false,
        error: `Parameter '${key}' exceeds maximum length`,
        errorCode: "PARAM_TOO_LONG",
      };
    }
  }
  
  // 2. Check endpoint-specific requirements
  const requirements = getEndpointRequirements(endpoint);
  
  // Required params
  if (requirements.requiredParams) {
    for (const param of requirements.requiredParams) {
      if (!params[param] || params[param].trim() === "") {
        return {
          valid: false,
          error: `Missing required parameter: ${param}`,
          errorCode: "MISSING_REQUIRED_PARAM",
          suggestion: `Include '${param}' parameter to narrow your query`,
        };
      }
    }
  }
  
  // One-of params (must have at least one from each group)
  if (requirements.oneOfParams) {
    for (const group of requirements.oneOfParams) {
      const hasOne = group.some(p => params[p] && params[p].trim() !== "");
      if (!hasOne) {
        return {
          valid: false,
          error: `Missing required filter. Include one of: ${group.join(", ")}`,
          errorCode: "MISSING_FILTER",
          suggestion: "Broad queries are not allowed. Please add a filter.",
        };
      }
    }
  }
  
  // 3. Validate year range
  if (params.year) {
    const year = parseInt(params.year, 10);
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
      return {
        valid: false,
        error: "Invalid year. Must be between 1900 and next year.",
        errorCode: "INVALID_YEAR",
      };
    }
  }
  
  // 4. Validate make/model format
  if (params.make && !/^[a-z0-9\-_\s]+$/i.test(params.make)) {
    return {
      valid: false,
      error: "Invalid make format",
      errorCode: "INVALID_MAKE",
    };
  }
  
  if (params.model && !/^[a-z0-9\-_\s\.\/]+$/i.test(params.model)) {
    return {
      valid: false,
      error: "Invalid model format",
      errorCode: "INVALID_MODEL",
    };
  }
  
  return { valid: true };
}

/**
 * Check if user agent looks like a bot
 */
export function isKnownBot(userAgent?: string): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(pattern => pattern.test(userAgent));
}

/**
 * Check if user agent is suspicious but not necessarily blocked
 */
export function isSuspiciousUserAgent(userAgent?: string): boolean {
  if (!userAgent) return true; // No UA is suspicious
  if (userAgent.length < 10) return true; // Too short
  if (!/Mozilla|Chrome|Safari|Firefox|Edge/i.test(userAgent)) return true; // No browser
  return isKnownBot(userAgent);
}

/**
 * Get requirements for an endpoint (supports wildcards)
 */
function getEndpointRequirements(endpoint: string): EndpointRequirements {
  // Direct match
  if (ENDPOINT_REQUIREMENTS[endpoint]) {
    return ENDPOINT_REQUIREMENTS[endpoint];
  }
  
  // Pattern match (strip trailing segments)
  const parts = endpoint.split("/");
  while (parts.length > 2) {
    parts.pop();
    const pattern = parts.join("/");
    if (ENDPOINT_REQUIREMENTS[pattern]) {
      return ENDPOINT_REQUIREMENTS[pattern];
    }
  }
  
  // Default: no specific requirements
  return {};
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create validation error response
 */
export function validationErrorResponse(result: ValidationResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: result.errorCode || "VALIDATION_ERROR",
        message: result.error || "Invalid request",
        ...(result.suggestion && { suggestion: result.suggestion }),
      },
    },
    { status: 400 }
  );
}

// ============================================================================
// IP-based Detection
// ============================================================================

interface IpReputation {
  ip: string;
  requestCount: number;
  firstSeen: number;
  lastSeen: number;
  uniqueApiKeys: Set<string>;
  suspicionScore: number;
}

const ipReputationStore = new Map<string, IpReputation>();

/**
 * Track IP reputation across API keys
 */
export function trackIpReputation(ip: string, apiKeyId: string): IpReputation {
  const now = Date.now();
  let reputation = ipReputationStore.get(ip);
  
  if (!reputation) {
    reputation = {
      ip,
      requestCount: 0,
      firstSeen: now,
      lastSeen: now,
      uniqueApiKeys: new Set(),
      suspicionScore: 0,
    };
    ipReputationStore.set(ip, reputation);
  }
  
  reputation.requestCount++;
  reputation.lastSeen = now;
  reputation.uniqueApiKeys.add(apiKeyId);
  
  // Multiple API keys from same IP is suspicious
  if (reputation.uniqueApiKeys.size > 3) {
    reputation.suspicionScore = Math.min(100, reputation.suspicionScore + 10);
  }
  
  return reputation;
}

/**
 * Check if IP is suspicious
 */
export function isIpSuspicious(ip: string): boolean {
  const reputation = ipReputationStore.get(ip);
  if (!reputation) return false;
  return reputation.suspicionScore > 50 || reputation.uniqueApiKeys.size > 5;
}

// Cleanup old IPs periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = now - 86400_000; // 24 hours
  
  for (const [ip, rep] of ipReputationStore) {
    if (rep.lastSeen < staleThreshold) {
      ipReputationStore.delete(ip);
    }
  }
}, 3600_000); // Every hour
