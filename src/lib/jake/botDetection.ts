/**
 * Jake Bot/Spam Detection
 * 
 * Detects and blocks automated traffic, spam, and abuse patterns.
 * This protects Claude API costs and keeps Jake responsive for real users.
 * 
 * @created 2026-08-12
 */

// Known bot user-agent patterns
const BOT_USER_AGENTS = [
  // Headless browsers
  /HeadlessChrome/i,
  /Playwright/i,
  /Puppeteer/i,
  /PhantomJS/i,
  /Selenium/i,
  /WebDriver/i,
  
  // Web scrapers & crawlers
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /axios/i,
  /node-fetch/i,
  /Go-http-client/i,
  
  // Suspicious pattern: quotes around user-agent (real browsers don't do this)
  /^"/,
  
  // Outdated Chrome versions (suspicious for 2026)
  // Chrome 142 is very old - real users would have updated
  /Chrome\/14[0-2]\./i,
  /Chrome\/13\d\./i,
  /Chrome\/12\d\./i,
];

// Known bot messages (exact match or pattern)
const BOT_MESSAGES: Array<string | RegExp> = [
  // These exact phrases appear in the bot traffic
  "Best tires for my truck",
  "Build me a wheel package",
  "Quiet highway tires",
  "Will bigger tires fit?",
  "Show me wheel options",
  
  // Generic patterns that real users don't use
  /^test$/i,
  /^hello$/i,
  /^hi$/i,
  /^hey$/i,
];

// Rate limit state (in-memory for serverless - resets on cold start)
// For production, use Upstash Redis
const requestTimes = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 3; // Max 3 requests per 10 seconds
const MIN_REQUEST_GAP_MS = 1500; // Min 1.5 seconds between requests

interface DetectionResult {
  isBot: boolean;
  reason?: string;
  action: "allow" | "rate_limit" | "block";
  message?: string;
}

/**
 * Detect if a request is likely from a bot/script.
 */
export function detectBot(
  userAgent: string | null,
  query: string,
  sessionId: string | null,
  ipAddress: string | null
): DetectionResult {
  // Check user-agent patterns
  if (userAgent) {
    for (const pattern of BOT_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        console.log(`[Bot Detection] Blocked by UA pattern: ${pattern} | UA: ${userAgent.substring(0, 60)}...`);
        return {
          isBot: true,
          reason: "suspicious_user_agent",
          action: "block",
          message: "I'm not available for automated requests. If you're a real person, please try using a regular browser.",
        };
      }
    }
  }
  
  // Check for known bot messages
  const normalizedQuery = query.trim();
  for (const botMsg of BOT_MESSAGES) {
    if (typeof botMsg === "string") {
      if (normalizedQuery === botMsg) {
        // Don't block immediately - could be a suggested prompt click
        // But flag it for rate limit consideration
        console.log(`[Bot Detection] Known bot phrase detected: "${normalizedQuery}"`);
      }
    } else if (botMsg.test(normalizedQuery)) {
      console.log(`[Bot Detection] Bot message pattern: "${normalizedQuery}"`);
    }
  }
  
  // Rate limiting by session/IP
  const rateKey = sessionId || ipAddress || "anonymous";
  const now = Date.now();
  
  // Get recent request times
  let times = requestTimes.get(rateKey) || [];
  
  // Clean old entries
  times = times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  // Check minimum gap
  const lastTime = times[times.length - 1];
  if (lastTime && now - lastTime < MIN_REQUEST_GAP_MS) {
    console.log(`[Bot Detection] Rate limit: Too fast (${now - lastTime}ms gap) | Key: ${rateKey.substring(0, 20)}`);
    return {
      isBot: true,
      reason: "rate_limit_too_fast",
      action: "rate_limit",
      message: "Whoa, slow down! I'm still thinking about your last question. Give me a second.",
    };
  }
  
  // Check request count
  if (times.length >= RATE_LIMIT_MAX_REQUESTS) {
    console.log(`[Bot Detection] Rate limit: Too many requests (${times.length} in window) | Key: ${rateKey.substring(0, 20)}`);
    return {
      isBot: true,
      reason: "rate_limit_count",
      action: "rate_limit",
      message: "I need a moment to catch up. Try again in a few seconds!",
    };
  }
  
  // Record this request
  times.push(now);
  requestTimes.set(rateKey, times);
  
  // Clean up old entries periodically (prevent memory growth)
  if (requestTimes.size > 10000) {
    const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
    for (const [key, t] of requestTimes.entries()) {
      if (t[t.length - 1] < cutoff) {
        requestTimes.delete(key);
      }
    }
  }
  
  return {
    isBot: false,
    action: "allow",
  };
}

/**
 * Quick bot check for user agent only (faster, for early exit).
 */
export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(pattern => pattern.test(userAgent));
}
