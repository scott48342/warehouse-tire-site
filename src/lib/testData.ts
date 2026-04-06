/**
 * Test Data Detection & Exclusion Service
 * 
 * Prevents internal testing from polluting production data:
 * - Abandoned carts
 * - Email subscribers
 * - Orders
 * - Analytics
 * 
 * Detection methods:
 * - Internal email patterns
 * - Test mode cookie/header
 * - Known internal IPs
 * - Stripe test mode
 * - Admin-marked records
 * 
 * @created 2026-04-03
 */

// ============================================================================
// Configuration
// ============================================================================

/** Internal email patterns that indicate test data */
const INTERNAL_EMAIL_PATTERNS = [
  /@warehousetiredirect\.com$/i,
  /@wtd\.com$/i,
  /^test[@+]/i,
  /^dev[@+]/i,
  /^admin[@+]/i,
  /^internal[@+]/i,
  /\+test@/i,
  /\+dev@/i,
  /@example\.com$/i,
  /@test\.com$/i,
  /@localhost$/i,
  /^scott@/i, // Owner's personal email pattern
];

/** Known internal IP addresses/ranges */
const INTERNAL_IPS = [
  "127.0.0.1",
  "::1",
  // Add office/home IPs here as needed
];

/** Test mode cookie name */
export const TEST_MODE_COOKIE = "wt_test_mode";

/** Test mode header name */
export const TEST_MODE_HEADER = "x-wt-test-mode";

/** Test mode query param */
export const TEST_MODE_PARAM = "_test";

// ============================================================================
// Types
// ============================================================================

export type TestReason = 
  | "internal_email"
  | "test_mode"
  | "admin_marked"
  | "stripe_test"
  | "internal_ip"
  | "test_cookie"
  | "test_header";

export interface TestDetectionResult {
  isTest: boolean;
  reason: TestReason | null;
  details?: string;
}

export interface TestDetectionContext {
  email?: string | null;
  ipAddress?: string | null;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  stripeMode?: "live" | "test";
  userAgent?: string | null;
}

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if an email matches internal/test patterns
 */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return INTERNAL_EMAIL_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Check if an IP is internal
 */
export function isInternalIP(ip: string | null | undefined): boolean {
  if (!ip) return false;
  return INTERNAL_IPS.includes(ip);
}

/**
 * Check if test mode is enabled via cookie
 */
export function hasTestModeCookie(cookies: Record<string, string> | undefined): boolean {
  if (!cookies) return false;
  return cookies[TEST_MODE_COOKIE] === "true" || cookies[TEST_MODE_COOKIE] === "1";
}

/**
 * Check if test mode is enabled via header
 */
export function hasTestModeHeader(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  const value = headers[TEST_MODE_HEADER] || headers[TEST_MODE_HEADER.toLowerCase()];
  return value === "true" || value === "1";
}

/**
 * Check if Stripe is in test mode
 */
export function isStripeTestMode(mode: "live" | "test" | undefined): boolean {
  return mode === "test";
}

/**
 * Comprehensive test data detection
 */
export function detectTestData(context: TestDetectionContext): TestDetectionResult {
  // Check email first (most common)
  if (context.email && isInternalEmail(context.email)) {
    return {
      isTest: true,
      reason: "internal_email",
      details: `Email matches internal pattern: ${context.email}`,
    };
  }

  // Check test mode header
  if (hasTestModeHeader(context.headers)) {
    return {
      isTest: true,
      reason: "test_header",
      details: "Test mode header present",
    };
  }

  // Check test mode cookie
  if (hasTestModeCookie(context.cookies)) {
    return {
      isTest: true,
      reason: "test_cookie",
      details: "Test mode cookie present",
    };
  }

  // Check Stripe test mode
  if (isStripeTestMode(context.stripeMode)) {
    return {
      isTest: true,
      reason: "stripe_test",
      details: "Stripe test mode payment",
    };
  }

  // Check internal IP (lower priority - can have false positives)
  if (context.ipAddress && isInternalIP(context.ipAddress)) {
    return {
      isTest: true,
      reason: "internal_ip",
      details: `Internal IP: ${context.ipAddress}`,
    };
  }

  return { isTest: false, reason: null };
}

/**
 * Quick check if email is test data (convenience function)
 */
export function isTestEmail(email: string | null | undefined): TestDetectionResult {
  return detectTestData({ email });
}

// ============================================================================
// Cookie/Header Helpers for Client
// ============================================================================

/**
 * Get test mode detection context from Next.js headers
 */
export function getTestContextFromHeaders(headersList: Headers): Partial<TestDetectionContext> {
  const headers: Record<string, string> = {};
  const cookies: Record<string, string> = {};

  // Get test mode header
  const testHeader = headersList.get(TEST_MODE_HEADER);
  if (testHeader) headers[TEST_MODE_HEADER] = testHeader;

  // Parse cookies
  const cookieHeader = headersList.get("cookie");
  if (cookieHeader) {
    cookieHeader.split(";").forEach(cookie => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) cookies[key] = value;
    });
  }

  // Get IP
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0] ||
                    headersList.get("x-real-ip") ||
                    null;

  return { headers, cookies, ipAddress };
}

/**
 * Set test mode cookie (client-side)
 */
export function setTestModeCookie(enabled: boolean = true): void {
  if (typeof document === "undefined") return;
  
  if (enabled) {
    document.cookie = `${TEST_MODE_COOKIE}=true; path=/; max-age=${60 * 60 * 24 * 30}`; // 30 days
  } else {
    document.cookie = `${TEST_MODE_COOKIE}=; path=/; max-age=0`;
  }
}

/**
 * Check test mode from URL query param (?test=1 or ?_test=1)
 */
export function hasTestModeParam(url: URL | string): boolean {
  try {
    const urlObj = typeof url === "string" ? new URL(url) : url;
    // Check both ?test=1 and ?_test=1
    const testParam = urlObj.searchParams.get("test");
    const underscoreTestParam = urlObj.searchParams.get(TEST_MODE_PARAM);
    return testParam === "1" || testParam === "true" ||
           underscoreTestParam === "1" || underscoreTestParam === "true";
  } catch {
    return false;
  }
}

// ============================================================================
// Admin Internal Email List
// ============================================================================

/** Add emails that should always be considered internal */
const KNOWN_INTERNAL_EMAILS = new Set([
  "scott@warehousetiredirect.com",
  // Add more as needed
].map(e => e.toLowerCase()));

/**
 * Add an email to the known internal list (runtime only)
 */
export function addInternalEmail(email: string): void {
  KNOWN_INTERNAL_EMAILS.add(email.toLowerCase());
}

/**
 * Check if email is in known internal list
 */
export function isKnownInternalEmail(email: string): boolean {
  return KNOWN_INTERNAL_EMAILS.has(email.toLowerCase());
}

// ============================================================================
// Export
// ============================================================================

export const testDataService = {
  detectTestData,
  isInternalEmail,
  isInternalIP,
  isTestEmail,
  hasTestModeCookie,
  hasTestModeHeader,
  hasTestModeParam,
  isStripeTestMode,
  getTestContextFromHeaders,
  setTestModeCookie,
  addInternalEmail,
  isKnownInternalEmail,
  TEST_MODE_COOKIE,
  TEST_MODE_HEADER,
  TEST_MODE_PARAM,
  INTERNAL_EMAIL_PATTERNS,
};

export default testDataService;
