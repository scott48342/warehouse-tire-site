/**
 * Core Analytics Tracking
 * 
 * @updated 2026-04-05 - Added test data detection and exclusion
 */

import { analyticsDb, schema } from "./db";
import { isBot, getDeviceType } from "./bot-detect";
import { eq, sql } from "drizzle-orm";
import { hasTestModeParam, hasTestModeCookie, hasTestModeHeader, isInternalEmail } from "@/lib/testData";

interface TrackPageViewParams {
  sessionId: string;
  path: string;
  fullUrl: string;
  referrer?: string | null;
  userAgent?: string | null;
  country?: string | null;
  isNewSession: boolean;
  // Test detection context
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  // Site/hostname tracking (added 2026-04-18)
  hostname?: string | null;
}

/**
 * Ensure analytics tables exist
 */
export async function ensureAnalyticsTables() {
  try {
    await analyticsDb.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(64) NOT NULL UNIQUE,
        first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
        landing_page VARCHAR(500) NOT NULL,
        referrer VARCHAR(500),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(255),
        utm_term VARCHAR(255),
        utm_content VARCHAR(255),
        device_type VARCHAR(20),
        user_agent TEXT,
        is_bot BOOLEAN DEFAULT false,
        country VARCHAR(2),
        page_view_count INTEGER DEFAULT 1,
        is_test BOOLEAN DEFAULT false,
        test_reason VARCHAR(100)
      )
    `);

    // Add is_test column if missing (migration for existing tables)
    await analyticsDb.execute(sql`
      ALTER TABLE analytics_sessions 
      ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false
    `);
    await analyticsDb.execute(sql`
      ALTER TABLE analytics_sessions 
      ADD COLUMN IF NOT EXISTS test_reason VARCHAR(100)
    `);
    
    // Backfill NULL values to false (safe, no locking)
    await analyticsDb.execute(sql`
      UPDATE analytics_sessions SET is_test = false WHERE is_test IS NULL
    `);
    
    // Add NOT NULL constraint if missing (idempotent)
    await analyticsDb.execute(sql`
      ALTER TABLE analytics_sessions 
      ALTER COLUMN is_test SET NOT NULL
    `).catch(() => { /* Already NOT NULL */ });

    // Add hostname column if missing (migration 2026-04-18)
    await analyticsDb.execute(sql`
      ALTER TABLE analytics_sessions 
      ADD COLUMN IF NOT EXISTS hostname VARCHAR(100)
    `);
    await analyticsDb.execute(sql`
      ALTER TABLE analytics_pageviews 
      ADD COLUMN IF NOT EXISTS hostname VARCHAR(100)
    `);
    // Create indexes for hostname filtering
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_sessions_hostname_idx 
      ON analytics_sessions(hostname)
    `);
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_pageviews_hostname_idx 
      ON analytics_pageviews(hostname)
    `);

    await analyticsDb.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_pageviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(64) NOT NULL,
        path VARCHAR(500) NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes if they don't exist
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_sessions_first_seen_idx 
      ON analytics_sessions(first_seen_at)
    `);
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_pageviews_session_idx 
      ON analytics_pageviews(session_id)
    `);
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_pageviews_path_idx 
      ON analytics_pageviews(path)
    `);
    await analyticsDb.execute(sql`
      CREATE INDEX IF NOT EXISTS analytics_pageviews_timestamp_idx 
      ON analytics_pageviews(timestamp)
    `);
  } catch (e) {
    // Tables exist
  }
}

/**
 * Extract UTM parameters from URL
 */
function extractUtmParams(url: string): Record<string, string | undefined> {
  try {
    const urlObj = new URL(url);
    return {
      utmSource: urlObj.searchParams.get("utm_source") || undefined,
      utmMedium: urlObj.searchParams.get("utm_medium") || undefined,
      utmCampaign: urlObj.searchParams.get("utm_campaign") || undefined,
      utmTerm: urlObj.searchParams.get("utm_term") || undefined,
      utmContent: urlObj.searchParams.get("utm_content") || undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Detect if this is a test session
 */
function detectTestSession(params: {
  fullUrl: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): { isTest: boolean; reason: string | null } {
  const { fullUrl, cookies, headers } = params;

  // Check URL param: ?test=1 or ?_test=1
  try {
    if (hasTestModeParam(fullUrl)) {
      return { isTest: true, reason: "url_param" };
    }
  } catch {
    // Invalid URL
  }

  // Check cookie
  if (hasTestModeCookie(cookies)) {
    return { isTest: true, reason: "test_cookie" };
  }

  // Check header
  if (hasTestModeHeader(headers)) {
    return { isTest: true, reason: "test_header" };
  }

  return { isTest: false, reason: null };
}

/**
 * Track a page view
 */
export async function trackPageView(params: TrackPageViewParams) {
  const { sessionId, path, fullUrl, referrer, userAgent, country, isNewSession, cookies, headers, hostname } = params;
  
  const botFlag = isBot(userAgent);
  const deviceType = getDeviceType(userAgent);
  const utmParams = extractUtmParams(fullUrl);
  
  // Detect test mode
  const testDetection = detectTestSession({ fullUrl, cookies, headers });

  try {
    await ensureAnalyticsTables();

    if (isNewSession) {
      // Create new session
      await analyticsDb
        .insert(schema.analyticsSessions)
        .values({
          sessionId,
          landingPage: path,
          referrer: referrer || null,
          userAgent: userAgent || null,
          deviceType,
          isBot: botFlag,
          country: country || null,
          isTest: testDetection.isTest,
          testReason: testDetection.reason,
          hostname: hostname || null,
          ...utmParams,
        })
        .onConflictDoNothing();
    } else {
      // Update existing session
      await analyticsDb
        .update(schema.analyticsSessions)
        .set({
          lastSeenAt: new Date(),
          pageViewCount: sql`page_view_count + 1`,
          // If test mode detected mid-session, mark it (only upgrade, never downgrade)
          ...(testDetection.isTest && {
            isTest: true,
            testReason: testDetection.reason,
          }),
        })
        .where(eq(schema.analyticsSessions.sessionId, sessionId));
    }

    // Record page view
    await analyticsDb.insert(schema.analyticsPageviews).values({
      sessionId,
      path,
      hostname: hostname || null,
    });

    return { success: true, isBot: botFlag, isTest: testDetection.isTest };
  } catch (error) {
    console.error("[Analytics] Track error:", error);
    return { success: false, error };
  }
}

/**
 * Check if path should be tracked
 */
export function shouldTrack(path: string): boolean {
  // Skip admin pages
  if (path.startsWith("/admin")) return false;
  
  // Skip API routes
  if (path.startsWith("/api")) return false;
  
  // Skip static files
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i.test(path)) {
    return false;
  }
  
  // Skip Next.js internals
  if (path.startsWith("/_next")) return false;
  if (path.startsWith("/__nextjs")) return false;
  
  // Skip favicon
  if (path === "/favicon.ico") return false;
  
  return true;
}
