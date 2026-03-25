/**
 * Wheel-Size API Usage Stats Endpoint
 * 
 * Returns usage statistics from the wheelSizeGuard module.
 * Read-only - does NOT make any Wheel-Size API calls.
 * 
 * @created 2026-03-25
 */

import { NextResponse } from "next/server";
import { 
  getRecentLogs, 
  getLogStats, 
  getUsageStats,
  getAdminLogs,
  USAGE_THRESHOLDS,
  WHEEL_SIZE_SAFE_MODE,
} from "@/lib/wheelSizeGuard";

export const runtime = "nodejs";

/**
 * GET /api/admin/wheel-size-usage
 * 
 * Returns Wheel-Size API usage stats for admin dashboard.
 * Does NOT generate any Wheel-Size API traffic.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const logsLimit = Math.min(500, Number(url.searchParams.get("logsLimit") || "100") || 100);
  
  // Get all stats from the guard module
  const logStats = getLogStats();
  const usageStats = getUsageStats();
  const recentLogs = getRecentLogs(logsLimit);
  const adminLogs = getAdminLogs(50);
  
  // Calculate search API calls today (search/by_model endpoint)
  const searchCallsToday = logStats.lastDay.byEndpoint?.["search/by_model"] || 0;
  
  // Determine alert status
  const hourlyPercent = (usageStats.hourly.count / usageStats.hourly.limit) * 100;
  const dailyPercent = (usageStats.daily.count / USAGE_THRESHOLDS.warningPerDay) * 100;
  
  let alertStatus: "healthy" | "warning" | "blocked" = "healthy";
  let alertMessage = "All systems nominal";
  
  if (usageStats.hourly.count >= usageStats.hourly.limit) {
    alertStatus = "blocked";
    alertMessage = `Hourly limit exceeded (${usageStats.hourly.count}/${usageStats.hourly.limit}). Calls blocked until reset.`;
  } else if (usageStats.hourly.count >= usageStats.hourly.warning) {
    alertStatus = "warning";
    alertMessage = `Warning: ${usageStats.hourly.count} calls this hour (warning threshold: ${usageStats.hourly.warning})`;
  } else if (usageStats.daily.count >= USAGE_THRESHOLDS.warningPerDay) {
    alertStatus = "warning";
    alertMessage = `Warning: ${usageStats.daily.count} calls today (warning threshold: ${USAGE_THRESHOLDS.warningPerDay})`;
  }
  
  // Build hourly breakdown for chart (last 24 hours)
  const now = Date.now();
  const hourlyBreakdown: { hour: string; count: number }[] = [];
  
  for (let i = 23; i >= 0; i--) {
    const hourStart = now - (i + 1) * 3600000;
    const hourEnd = now - i * 3600000;
    const hourLogs = recentLogs.filter(l => l.timestamp >= hourStart && l.timestamp < hourEnd);
    const hourLabel = new Date(hourEnd).toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    hourlyBreakdown.push({ hour: hourLabel, count: hourLogs.length });
  }
  
  // Build endpoint breakdown
  const endpointBreakdown = Object.entries(logStats.lastDay.bySource || {}).map(([source, count]) => ({
    source,
    count,
  }));
  
  return NextResponse.json({
    // Summary cards
    summary: {
      lastHourCalls: logStats.lastHour.count,
      todayCalls: logStats.lastDay.count,
      searchApiCallsToday: searchCallsToday,
    },
    
    // Alert status
    alert: {
      status: alertStatus,
      message: alertMessage,
      hourlyPercent: Math.round(hourlyPercent),
      dailyPercent: Math.round(dailyPercent),
    },
    
    // Usage stats
    usage: usageStats,
    
    // Thresholds
    thresholds: USAGE_THRESHOLDS,
    safeModeEnabled: WHEEL_SIZE_SAFE_MODE,
    
    // Breakdowns
    byEndpoint: logStats.lastHour.byEndpoint || {},
    byEndpointToday: logStats.lastDay.byEndpoint || {},
    bySource: logStats.lastHour.bySource || {},
    bySourceToday: logStats.lastDay.bySource || {},
    
    // Charts data
    hourlyChart: hourlyBreakdown,
    
    // Recent logs (for table)
    recentLogs: recentLogs.slice(0, logsLimit).map(log => ({
      timestamp: new Date(log.timestamp).toISOString(),
      endpoint: log.endpoint,
      triggerSource: log.triggerSource,
      vehicle: log.vehicle 
        ? `${log.vehicle.year || ""} ${log.vehicle.make || ""} ${log.vehicle.model || ""}`.trim() 
        : null,
      status: log.status,
      durationMs: log.durationMs,
    })),
    
    // Batch job state
    batchJobState: logStats.batchJobState,
    
    // Admin action logs
    adminLogs: adminLogs.map(log => ({
      timestamp: new Date(log.timestamp).toISOString(),
      action: log.action,
      details: log.details,
    })),
    
    // Meta
    generatedAt: new Date().toISOString(),
    totalLogsInMemory: logStats.totalLogs,
  });
}
