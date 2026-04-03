/**
 * GET /api/admin/suppliers/status
 * 
 * Returns real-time status for all suppliers.
 * This is the source of truth for supplier health.
 */

import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

export interface SupplierStatus {
  id: string;
  canonicalName: string;
  provider: string;
  enabled: boolean;
  credentialsConfigured: boolean;
  credentialSource: "env" | "db" | "none";
  usedInLiveSearch: boolean;
  lastSuccessAt: string | null;
  lastSuccessCount: number | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  recentSearches: number;
  recentResults: number;
  status: "active" | "degraded" | "error" | "disabled" | "unconfigured";
  statusMessage: string;
}

export async function GET() {
  try {
    const statuses: SupplierStatus[] = [];
    const pool = getPool();

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. WheelPros
    // ═══════════════════════════════════════════════════════════════════════════
    const wpEnvConfigured = Boolean(
      process.env.WHEELPROS_USERNAME && process.env.WHEELPROS_PASSWORD
    );
    
    let wpDbConfig: any = null;
    try {
      const { rows } = await pool.query(`
        SELECT enabled, credentials_configured, last_test_at, last_test_status, last_test_message
        FROM suppliers WHERE provider = 'wheelpros' LIMIT 1
      `);
      wpDbConfig = rows[0];
    } catch { /* table may not exist */ }
    
    const wpEnabled = wpDbConfig?.enabled ?? true;
    const wpConfigured = wpEnvConfigured || wpDbConfig?.credentials_configured;
    
    statuses.push({
      id: "wheelpros",
      canonicalName: "WheelPros",
      provider: "wheelpros",
      enabled: wpEnabled,
      credentialsConfigured: wpConfigured,
      credentialSource: wpEnvConfigured ? "env" : (wpDbConfig?.credentials_configured ? "db" : "none"),
      usedInLiveSearch: wpEnabled && wpConfigured,
      lastSuccessAt: wpDbConfig?.last_test_status === "success" ? wpDbConfig.last_test_at : null,
      lastSuccessCount: null, // Would need metrics table
      lastErrorAt: wpDbConfig?.last_test_status === "error" ? wpDbConfig.last_test_at : null,
      lastErrorMessage: wpDbConfig?.last_test_status === "error" ? wpDbConfig.last_test_message : null,
      recentSearches: 0, // Would need metrics
      recentResults: 0,
      status: !wpConfigured ? "unconfigured" : !wpEnabled ? "disabled" : "active",
      statusMessage: !wpConfigured ? "Credentials not configured" : !wpEnabled ? "Disabled by admin" : "Active",
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. TireWeb Connections (ATD, NTW, US AutoForce)
    // ═══════════════════════════════════════════════════════════════════════════
    const tirewebEnvConfigured = Boolean(
      (process.env.TIREWEB_ACCESS_KEY || process.env.TIREWIRE_ACCESS_KEY) &&
      (process.env.TIREWEB_GROUP_TOKEN || process.env.TIREWIRE_GROUP_TOKEN)
    );
    
    let tirewebDbConfigured = false;
    try {
      const { rows } = await pool.query(`
        SELECT key, value FROM tireweb_config WHERE key IN ('access_key', 'group_token')
      `);
      tirewebDbConfigured = rows.length >= 2 && rows.every((r: any) => r.value);
    } catch { /* table may not exist */ }
    
    const tirewebConfigured = tirewebEnvConfigured || tirewebDbConfigured;

    // Get connection status for each TireWeb provider
    const tirewebProviders = [
      { provider: "tireweb_atd", canonicalName: "ATD", description: "American Tire Distributors" },
      { provider: "tireweb_ntw", canonicalName: "NTW", description: "National Tire Wholesale" },
      { provider: "tireweb_usautoforce", canonicalName: "US AutoForce", description: "US AutoForce Distribution" },
    ];

    for (const tw of tirewebProviders) {
      let connInfo: any = null;
      try {
        const { rows } = await pool.query(`
          SELECT enabled, connection_id, last_test_at, last_test_status, last_test_message
          FROM tireweb_connections WHERE provider = $1 LIMIT 1
        `, [tw.provider]);
        connInfo = rows[0];
      } catch { /* table may not exist */ }

      // Check for rate limiting in recent errors
      const isRateLimited = connInfo?.last_test_message?.includes("rate limit") || 
                           connInfo?.last_test_message?.includes("ErrorCode>127");
      
      const enabled = connInfo?.enabled ?? false;
      const hasConnectionId = Boolean(connInfo?.connection_id);
      const fullyConfigured = tirewebConfigured && hasConnectionId;
      
      let status: SupplierStatus["status"] = "unconfigured";
      let statusMessage = "Not configured";
      
      if (!tirewebConfigured) {
        status = "unconfigured";
        statusMessage = "TireWeb credentials not configured";
      } else if (!hasConnectionId) {
        status = "unconfigured";
        statusMessage = "Connection ID not set";
      } else if (!enabled) {
        status = "disabled";
        statusMessage = "Disabled by admin";
      } else if (isRateLimited) {
        status = "degraded";
        statusMessage = "Rate limited - results may be empty";
      } else if (connInfo?.last_test_status === "error") {
        status = "error";
        statusMessage = connInfo.last_test_message || "Last test failed";
      } else {
        status = "active";
        statusMessage = "Active";
      }

      statuses.push({
        id: tw.provider,
        canonicalName: tw.canonicalName,
        provider: tw.provider,
        enabled,
        credentialsConfigured: fullyConfigured,
        credentialSource: tirewebEnvConfigured ? "env" : (tirewebDbConfigured ? "db" : "none"),
        usedInLiveSearch: enabled && fullyConfigured,
        lastSuccessAt: connInfo?.last_test_status === "success" ? connInfo.last_test_at : null,
        lastSuccessCount: null,
        lastErrorAt: connInfo?.last_test_status === "error" ? connInfo.last_test_at : null,
        lastErrorMessage: connInfo?.last_test_status === "error" ? connInfo.last_test_message : null,
        recentSearches: 0,
        recentResults: 0,
        status,
        statusMessage,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. K&M / Keystone
    // ═══════════════════════════════════════════════════════════════════════════
    const kmApiKey = process.env.KM_API_KEY || process.env.KMTIRE_API_KEY || process.env.KM_TIRE_API_KEY;
    const kmConfigured = Boolean(kmApiKey);
    
    // K&M is currently disabled due to invalid API key
    const kmEnabled = false; // Hardcoded disabled until new key obtained
    const kmLastError = "Invalid Security Information - API key expired or invalid";

    statuses.push({
      id: "km",
      canonicalName: "K&M",
      provider: "km",
      enabled: kmEnabled,
      credentialsConfigured: kmConfigured,
      credentialSource: kmConfigured ? "env" : "none",
      usedInLiveSearch: false, // Disabled
      lastSuccessAt: null,
      lastSuccessCount: null,
      lastErrorAt: new Date().toISOString(), // Recently errored
      lastErrorMessage: kmLastError,
      recentSearches: 0,
      recentResults: 0,
      status: "disabled",
      statusMessage: "Disabled - " + kmLastError,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════════════
    const activeCount = statuses.filter(s => s.status === "active").length;
    const degradedCount = statuses.filter(s => s.status === "degraded").length;
    const errorCount = statuses.filter(s => s.status === "error").length;
    const disabledCount = statuses.filter(s => s.status === "disabled").length;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      summary: {
        total: statuses.length,
        active: activeCount,
        degraded: degradedCount,
        error: errorCount,
        disabled: disabledCount,
        usedInSearch: statuses.filter(s => s.usedInLiveSearch).length,
      },
      suppliers: statuses,
    });

  } catch (err: any) {
    console.error("[suppliers/status] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
