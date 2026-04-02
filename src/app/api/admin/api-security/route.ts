/**
 * Admin API Security Management
 * 
 * Endpoints for:
 * - Viewing abuse events
 * - Managing client throttles/suspensions
 * - Key rotation utilities
 * - Usage statistics
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getRecentAbuseEvents,
  getAllClientBehaviors,
  getAbuseStatus,
  throttleClient,
  suspendClient,
  clearAbuseFlags,
  ABUSE_CONFIG,
} from "@/lib/api/abuse-detection";
import {
  getRateLimitStatus,
  setThrottleMultiplier,
  resetThrottle,
} from "@/lib/api/rate-limit";
import {
  generateEnvEntry,
  rotateKey,
  suspendKey,
  revokeKey,
  reactivateKey,
  parseAllKeysFromEnv,
  getAllUsageStats,
} from "@/lib/api/key-management";
import type { ApiKeyTier } from "@/lib/api/types";

// Simple admin auth check
function isAdmin(req: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  
  const providedKey = req.headers.get("x-admin-key");
  return providedKey === adminKey;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  switch (action) {
    case "abuse-events": {
      const limit = parseInt(url.searchParams.get("limit") || "100", 10);
      const events = getRecentAbuseEvents(limit);
      return NextResponse.json({
        success: true,
        data: {
          events,
          count: events.length,
          config: ABUSE_CONFIG,
        },
      });
    }

    case "client-behaviors": {
      const behaviors = getAllClientBehaviors();
      const data: Record<string, any> = {};
      
      for (const [clientId, behavior] of behaviors) {
        data[clientId] = {
          ...behavior,
          uniqueEndpoints: Array.from(behavior.uniqueEndpoints),
          uniqueYears: Array.from(behavior.uniqueYears),
          uniqueMakes: Array.from(behavior.uniqueMakes),
          uniqueModels: Array.from(behavior.uniqueModels),
          uniqueTrims: Array.from(behavior.uniqueTrims),
        };
      }
      
      return NextResponse.json({
        success: true,
        data,
        count: behaviors.size,
      });
    }

    case "client-status": {
      const clientId = url.searchParams.get("clientId");
      if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
      }
      
      const abuseStatus = getAbuseStatus(clientId);
      const rateLimitStatus = getRateLimitStatus(clientId);
      
      return NextResponse.json({
        success: true,
        data: {
          clientId,
          abuse: abuseStatus,
          rateLimit: rateLimitStatus,
        },
      });
    }

    case "usage-stats": {
      const stats = getAllUsageStats();
      const data: Record<string, any> = {};
      
      for (const [clientId, stat] of stats) {
        data[clientId] = stat;
      }
      
      return NextResponse.json({
        success: true,
        data,
        count: stats.size,
      });
    }

    case "list-keys": {
      const envValue = process.env.PUBLIC_API_KEYS || "";
      const keys = parseAllKeysFromEnv(envValue);
      
      // Redact actual key values
      const redacted = keys.map(k => ({
        ...k,
        key: `${k.key.slice(0, 8)}...${k.key.slice(-4)}`,
      }));
      
      return NextResponse.json({
        success: true,
        data: redacted,
        count: keys.length,
      });
    }

    case "generate-key": {
      const clientName = url.searchParams.get("clientName") || "New Client";
      const tier = (url.searchParams.get("tier") || "basic") as ApiKeyTier;
      
      const result = generateEnvEntry({ clientName, tier });
      
      return NextResponse.json({
        success: true,
        data: {
          key: result.key,
          clientId: result.clientId,
          envEntry: result.envEntry,
          config: result.config,
          instructions: "Add envEntry to PUBLIC_API_KEYS environment variable",
        },
      });
    }

    default:
      return NextResponse.json({
        success: true,
        data: {
          availableActions: [
            "abuse-events",
            "client-behaviors",
            "client-status?clientId=xxx",
            "usage-stats",
            "list-keys",
            "generate-key?clientName=xxx&tier=basic",
          ],
        },
      });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, clientId, duration } = body;

  switch (action) {
    case "throttle": {
      if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
      }
      
      const durationMs = duration || ABUSE_CONFIG.THROTTLE_DURATION_MS;
      throttleClient(clientId, durationMs);
      setThrottleMultiplier(clientId, 3.0); // 3x slower
      
      return NextResponse.json({
        success: true,
        message: `Client ${clientId} throttled for ${durationMs / 1000} seconds`,
      });
    }

    case "suspend": {
      if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
      }
      
      const durationMs = duration || ABUSE_CONFIG.SUSPEND_DURATION_MS;
      suspendClient(clientId, durationMs);
      
      return NextResponse.json({
        success: true,
        message: `Client ${clientId} suspended for ${durationMs / 60000} minutes`,
      });
    }

    case "clear-flags": {
      if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
      }
      
      clearAbuseFlags(clientId);
      resetThrottle(clientId);
      
      return NextResponse.json({
        success: true,
        message: `Abuse flags cleared for ${clientId}`,
      });
    }

    case "set-throttle": {
      if (!clientId) {
        return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
      }
      
      const multiplier = body.multiplier || 2.0;
      setThrottleMultiplier(clientId, multiplier);
      
      return NextResponse.json({
        success: true,
        message: `Throttle multiplier set to ${multiplier}x for ${clientId}`,
      });
    }

    case "rotate-key": {
      // This generates new key info - actual rotation requires env update
      const envValue = process.env.PUBLIC_API_KEYS || "";
      const keys = parseAllKeysFromEnv(envValue);
      const currentKey = keys.find(k => k.clientId === clientId);
      
      if (!currentKey) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      
      const rotation = rotateKey(currentKey);
      
      return NextResponse.json({
        success: true,
        data: {
          oldKeyRedacted: `${rotation.oldKey.slice(0, 8)}...`,
          newKey: rotation.newKey,
          envEntry: rotation.envEntry,
          message: rotation.message,
          instructions: [
            "1. Add new envEntry to PUBLIC_API_KEYS",
            "2. Deploy changes",
            "3. Notify client of new key",
            "4. Remove old key after grace period",
          ],
        },
      });
    }

    case "suspend-key": {
      const envValue = process.env.PUBLIC_API_KEYS || "";
      const keys = parseAllKeysFromEnv(envValue);
      const currentKey = keys.find(k => k.clientId === clientId);
      
      if (!currentKey) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      
      const result = suspendKey(currentKey);
      
      return NextResponse.json({
        success: true,
        data: {
          newEnvEntry: result.newEnvEntry,
          message: result.message,
        },
      });
    }

    case "revoke-key": {
      const envValue = process.env.PUBLIC_API_KEYS || "";
      const keys = parseAllKeysFromEnv(envValue);
      const currentKey = keys.find(k => k.clientId === clientId);
      
      if (!currentKey) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      
      const result = revokeKey(currentKey);
      
      return NextResponse.json({
        success: true,
        data: {
          newEnvEntry: result.newEnvEntry,
          message: result.message,
        },
      });
    }

    case "reactivate-key": {
      const envValue = process.env.PUBLIC_API_KEYS || "";
      const keys = parseAllKeysFromEnv(envValue);
      const currentKey = keys.find(k => k.clientId === clientId);
      
      if (!currentKey) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      
      const result = reactivateKey(currentKey);
      
      return NextResponse.json({
        success: true,
        data: {
          newEnvEntry: result.newEnvEntry,
          message: result.message,
        },
      });
    }

    default:
      return NextResponse.json({
        success: false,
        error: "Unknown action",
        availableActions: [
          "throttle",
          "suspend",
          "clear-flags",
          "set-throttle",
          "rotate-key",
          "suspend-key",
          "revoke-key",
          "reactivate-key",
        ],
      }, { status: 400 });
  }
}
