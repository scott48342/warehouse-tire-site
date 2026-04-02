/**
 * Bot Protection for Website
 * 
 * Lightweight protection for the main storefront.
 * Not as aggressive as API protection, but catches obvious bots.
 */

import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// Configuration
// ============================================================================

const BOT_PROTECTION_CONFIG = {
  // Rate limits for unauthenticated traffic
  REQUESTS_PER_MINUTE: 60,
  REQUESTS_PER_SECOND: 10,
  
  // Suspicious patterns
  MAX_VEHICLE_LOOKUPS_PER_MINUTE: 30, // Normal user might check 5-10
  
  // Bot user agents (more lenient than API)
  BLOCK_USER_AGENTS: [
    /scrapy/i,
    /python-requests\/[0-9]/i,  // Generic python scraper
    /httpclient\/[0-9]/i,
    /libwww-perl/i,
    /java\/[0-9]/i,             // Generic Java client
    /wget/i,
    /curl\/[0-9]/i,             // Direct curl (no browser)
  ],
  
  // Good bots we allow
  ALLOWED_BOTS: [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,         // Yahoo
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /discordbot/i,
    /slackbot/i,
  ],
  
  // Paths that are okay to access without rate limiting
  UNRESTRICTED_PATHS: [
    "/",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/_next/",
    "/api/analytics",
  ],
  
  // Paths that indicate vehicle enumeration
  VEHICLE_PATHS: [
    "/api/vehicles/",
    "/tires",
    "/wheels",
  ],
};

// ============================================================================
// In-Memory Tracking
// ============================================================================

interface VisitorTrack {
  ip: string;
  firstSeen: number;
  lastSeen: number;
  minuteCount: number;
  minuteStart: number;
  secondCount: number;
  secondStart: number;
  vehicleLookups: number;
  vehicleMinuteStart: number;
  flagged: boolean;
}

const visitorStore = new Map<string, VisitorTrack>();

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  const staleThreshold = now - 300_000; // 5 minutes
  
  for (const [ip, track] of visitorStore) {
    if (track.lastSeen < staleThreshold) {
      visitorStore.delete(ip);
    }
  }
}, 300_000);

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if request should be blocked/throttled
 */
export function checkBotProtection(req: NextRequest): {
  allowed: boolean;
  reason?: string;
  isBot?: boolean;
  isGoodBot?: boolean;
} {
  const url = new URL(req.url);
  const path = url.pathname;
  const userAgent = req.headers.get("user-agent") || "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || 
             "unknown";

  // 1. Allow unrestricted paths
  if (BOT_PROTECTION_CONFIG.UNRESTRICTED_PATHS.some(p => path.startsWith(p))) {
    return { allowed: true };
  }

  // 2. Check for known good bots (allow them)
  const isGoodBot = BOT_PROTECTION_CONFIG.ALLOWED_BOTS.some(p => p.test(userAgent));
  if (isGoodBot) {
    return { allowed: true, isBot: true, isGoodBot: true };
  }

  // 3. Check for known bad bots (block them)
  const isBadBot = BOT_PROTECTION_CONFIG.BLOCK_USER_AGENTS.some(p => p.test(userAgent));
  if (isBadBot) {
    logBotBlock(ip, userAgent, path, "bad_user_agent");
    return { allowed: false, reason: "Automated access not allowed", isBot: true };
  }

  // 4. Check for missing/suspicious user agent
  if (!userAgent || userAgent.length < 20) {
    // Don't block, but flag
    logSuspicious(ip, userAgent, path, "short_user_agent");
  }

  // 5. Rate limiting by IP
  const now = Date.now();
  let track = visitorStore.get(ip);
  
  if (!track) {
    track = {
      ip,
      firstSeen: now,
      lastSeen: now,
      minuteCount: 0,
      minuteStart: now,
      secondCount: 0,
      secondStart: now,
      vehicleLookups: 0,
      vehicleMinuteStart: now,
      flagged: false,
    };
    visitorStore.set(ip, track);
  }
  
  track.lastSeen = now;
  
  // Reset second window
  if (now - track.secondStart >= 1000) {
    track.secondCount = 0;
    track.secondStart = now;
  }
  
  // Reset minute window
  if (now - track.minuteStart >= 60000) {
    track.minuteCount = 0;
    track.minuteStart = now;
    track.vehicleLookups = 0;
    track.vehicleMinuteStart = now;
  }
  
  // Increment counters
  track.secondCount++;
  track.minuteCount++;
  
  // Check vehicle paths
  const isVehiclePath = BOT_PROTECTION_CONFIG.VEHICLE_PATHS.some(p => path.startsWith(p));
  if (isVehiclePath) {
    track.vehicleLookups++;
    
    if (track.vehicleLookups > BOT_PROTECTION_CONFIG.MAX_VEHICLE_LOOKUPS_PER_MINUTE) {
      track.flagged = true;
      logSuspicious(ip, userAgent, path, "vehicle_enumeration");
      // Don't block yet, but slow them down (return warning header)
    }
  }
  
  // Check per-second limit
  if (track.secondCount > BOT_PROTECTION_CONFIG.REQUESTS_PER_SECOND) {
    track.flagged = true;
    logBotBlock(ip, userAgent, path, "burst_rate_limit");
    return { allowed: false, reason: "Too many requests" };
  }
  
  // Check per-minute limit
  if (track.minuteCount > BOT_PROTECTION_CONFIG.REQUESTS_PER_MINUTE) {
    track.flagged = true;
    logBotBlock(ip, userAgent, path, "minute_rate_limit");
    return { allowed: false, reason: "Rate limit exceeded" };
  }
  
  return { allowed: true };
}

/**
 * Create middleware response for blocked request
 */
export function botBlockedResponse(reason: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Access Denied</title></head>
<body>
<h1>Access Denied</h1>
<p>${reason}</p>
<p>If you believe this is an error, please contact support.</p>
</body>
</html>`,
    {
      status: 429,
      headers: {
        "Content-Type": "text/html",
        "Retry-After": "60",
      },
    }
  );
}

/**
 * Get tracking info for an IP
 */
export function getVisitorTrack(ip: string): VisitorTrack | undefined {
  return visitorStore.get(ip);
}

/**
 * Get all flagged visitors
 */
export function getFlaggedVisitors(): VisitorTrack[] {
  const flagged: VisitorTrack[] = [];
  for (const track of visitorStore.values()) {
    if (track.flagged) {
      flagged.push(track);
    }
  }
  return flagged;
}

// ============================================================================
// Logging
// ============================================================================

function logBotBlock(ip: string, userAgent: string, path: string, reason: string): void {
  console.log(JSON.stringify({
    level: "warn",
    type: "bot_blocked",
    timestamp: new Date().toISOString(),
    ip,
    userAgent: userAgent.slice(0, 200),
    path,
    reason,
  }));
}

function logSuspicious(ip: string, userAgent: string, path: string, reason: string): void {
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify({
      level: "info",
      type: "suspicious_visitor",
      timestamp: new Date().toISOString(),
      ip,
      userAgent: userAgent.slice(0, 200),
      path,
      reason,
    }));
  }
}

// ============================================================================
// Honeypot Support
// ============================================================================

/**
 * Check if request is hitting a honeypot path
 * Add these to robots.txt as Disallow to catch bots that ignore robots.txt
 */
export const HONEYPOT_PATHS = [
  "/admin-login",
  "/wp-admin",
  "/administrator",
  "/.env",
  "/config.php",
  "/phpinfo.php",
  "/api/internal/export-all",
];

export function isHoneypotPath(path: string): boolean {
  return HONEYPOT_PATHS.some(hp => path.toLowerCase().includes(hp.toLowerCase()));
}

export function logHoneypotHit(ip: string, userAgent: string, path: string): void {
  console.log(JSON.stringify({
    level: "error",
    type: "honeypot_hit",
    timestamp: new Date().toISOString(),
    ip,
    userAgent: userAgent.slice(0, 200),
    path,
    action: "flagged_for_block",
  }));
}
