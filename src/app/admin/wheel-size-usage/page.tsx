"use client";

import { useState, useEffect, useCallback } from "react";

interface UsageData {
  summary: {
    lastHourCalls: number;
    todayCalls: number;
    searchApiCallsToday: number;
  };
  alert: {
    status: "healthy" | "warning" | "blocked";
    message: string;
    hourlyPercent: number;
    dailyPercent: number;
  };
  usage: {
    hourly: { count: number; limit: number; warning: number; resetsAt: string };
    daily: { count: number; warning: number; resetsAt: string };
  };
  thresholds: {
    warningPerHour: number;
    warningPerDay: number;
    hardLimitPerHour: number;
  };
  safeModeEnabled: boolean;
  byEndpoint: Record<string, number>;
  byEndpointToday: Record<string, number>;
  bySource: Record<string, number>;
  bySourceToday: Record<string, number>;
  hourlyChart: { hour: string; count: number }[];
  recentLogs: Array<{
    timestamp: string;
    endpoint: string;
    triggerSource: string;
    vehicle: string | null;
    status: number;
    durationMs: number;
  }>;
  batchJobState: {
    isRunning: boolean;
    lastRunAt: string | null;
    lastRunBy: string | null;
    totalRuns: number;
  };
  generatedAt: string;
  totalLogsInMemory: number;
}

function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = "neutral" 
}: { 
  title: string; 
  value: number | string; 
  subtitle?: string; 
  icon: string;
  color?: "neutral" | "green" | "yellow" | "red";
}) {
  const colorClasses = {
    neutral: "bg-neutral-700 border-neutral-600",
    green: "bg-green-900/50 border-green-700",
    yellow: "bg-yellow-900/50 border-yellow-700",
    red: "bg-red-900/50 border-red-700",
  };
  
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-neutral-400">{title}</div>
          <div className="mt-1 text-3xl font-bold text-white">{value}</div>
          {subtitle && (
            <div className="mt-1 text-xs text-neutral-500">{subtitle}</div>
          )}
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

function AlertBanner({ status, message }: { status: string; message: string }) {
  const config = {
    healthy: {
      bg: "bg-green-900/30 border-green-700",
      text: "text-green-300",
      icon: "✅",
      label: "Healthy",
    },
    warning: {
      bg: "bg-yellow-900/30 border-yellow-700",
      text: "text-yellow-300",
      icon: "⚠️",
      label: "Warning",
    },
    blocked: {
      bg: "bg-red-900/30 border-red-700",
      text: "text-red-300",
      icon: "🚨",
      label: "Blocked",
    },
  }[status] || { bg: "bg-neutral-800 border-neutral-700", text: "text-neutral-300", icon: "❓", label: "Unknown" };
  
  return (
    <div className={`rounded-xl border p-4 ${config.bg}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div>
          <div className={`font-bold ${config.text}`}>{config.label}</div>
          <div className="text-sm text-neutral-400">{message}</div>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ 
  label, 
  current, 
  warning, 
  limit, 
  resetsAt 
}: { 
  label: string; 
  current: number; 
  warning: number; 
  limit?: number; 
  resetsAt: string;
}) {
  const max = limit || warning * 2;
  const percent = Math.min(100, (current / max) * 100);
  const warningPercent = (warning / max) * 100;
  
  let barColor = "bg-green-500";
  if (current >= (limit || warning * 2)) barColor = "bg-red-500";
  else if (current >= warning) barColor = "bg-yellow-500";
  
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-neutral-300">{label}</span>
        <span className="text-neutral-400">
          {current} / {limit || warning} 
          {limit && ` (warning: ${warning})`}
        </span>
      </div>
      <div className="h-3 bg-neutral-700 rounded-full overflow-hidden relative">
        <div 
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
        <div 
          className="absolute top-0 h-full w-0.5 bg-yellow-400"
          style={{ left: `${warningPercent}%` }}
        />
      </div>
      <div className="text-xs text-neutral-500 mt-1">
        Resets at {new Date(resetsAt).toLocaleTimeString()}
      </div>
    </div>
  );
}

function EndpointBreakdown({ data, title }: { data: Record<string, number>; title: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  
  if (entries.length === 0) {
    return (
      <div className="text-sm text-neutral-500">No data</div>
    );
  }
  
  return (
    <div>
      <div className="text-sm font-medium text-neutral-300 mb-3">{title}</div>
      <div className="space-y-2">
        {entries.map(([endpoint, count]) => (
          <div key={endpoint} className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-neutral-400 font-mono">{endpoint}</span>
                <span className="text-neutral-500">{count}</span>
              </div>
              <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500"
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourlyChart({ data }: { data: { hour: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div>
      <div className="text-sm font-medium text-neutral-300 mb-3">Calls per Hour (Last 24h)</div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400"
              style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }}
              title={`${d.hour}: ${d.count} calls`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
        <span>{data[0]?.hour}</span>
        <span>{data[Math.floor(data.length / 2)]?.hour}</span>
        <span>{data[data.length - 1]?.hour}</span>
      </div>
    </div>
  );
}

function RecentLogsTable({ 
  logs, 
  loading 
}: { 
  logs: UsageData["recentLogs"]; 
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center text-neutral-500 py-8">Loading...</div>
    );
  }
  
  if (logs.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-8">
        No recent Wheel-Size API calls logged.
        <br />
        <span className="text-xs">(Logs reset on server restart)</span>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-400 border-b border-neutral-700">
            <th className="pb-2 pr-4">Time</th>
            <th className="pb-2 pr-4">Endpoint</th>
            <th className="pb-2 pr-4">Source</th>
            <th className="pb-2 pr-4">Vehicle</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} className="border-b border-neutral-800 hover:bg-neutral-800/50">
              <td className="py-2 pr-4 text-neutral-400 text-xs">
                {new Date(log.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-2 pr-4 font-mono text-xs text-blue-400">
                {log.endpoint}
              </td>
              <td className="py-2 pr-4">
                <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                  log.triggerSource === "user" 
                    ? "bg-green-900/50 text-green-300" 
                    : log.triggerSource === "admin-batch"
                      ? "bg-yellow-900/50 text-yellow-300"
                      : "bg-neutral-700 text-neutral-300"
                }`}>
                  {log.triggerSource}
                </span>
              </td>
              <td className="py-2 pr-4 text-neutral-300 text-xs">
                {log.vehicle || "-"}
              </td>
              <td className="py-2 pr-4">
                <span className={`text-xs ${
                  log.status === 200 
                    ? "text-green-400" 
                    : log.status >= 400 
                      ? "text-red-400" 
                      : "text-yellow-400"
                }`}>
                  {log.status}
                </span>
              </td>
              <td className="py-2 text-neutral-500 text-xs">
                {log.durationMs}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WheelSizeUsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/wheel-size-usage?logsLimit=100");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);
  
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🔍</span>
            Wheel-Size API Usage
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Monitor API usage to stay within Terms of Service limits
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300">
          Error: {error}
        </div>
      )}
      
      {/* Alert Banner */}
      {data && (
        <div className="mb-6">
          <AlertBanner status={data.alert.status} message={data.alert.message} />
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Last Hour Calls"
          value={data?.summary.lastHourCalls ?? "-"}
          subtitle={data ? `Limit: ${data.thresholds.hardLimitPerHour}/hr` : undefined}
          icon="⏱️"
          color={
            data && data.summary.lastHourCalls >= data.thresholds.hardLimitPerHour
              ? "red"
              : data && data.summary.lastHourCalls >= data.thresholds.warningPerHour
                ? "yellow"
                : "neutral"
          }
        />
        <SummaryCard
          title="Today's Calls"
          value={data?.summary.todayCalls ?? "-"}
          subtitle={data ? `Warning at ${data.thresholds.warningPerDay}` : undefined}
          icon="📅"
          color={
            data && data.summary.todayCalls >= data.thresholds.warningPerDay
              ? "yellow"
              : "neutral"
          }
        />
        <SummaryCard
          title="Search API Calls Today"
          value={data?.summary.searchApiCallsToday ?? "-"}
          subtitle="search/by_model endpoint"
          icon="🔎"
        />
      </div>
      
      {/* Usage Bars & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Usage Progress */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-4">Usage Limits</h2>
          {data && (
            <>
              <UsageBar
                label="Hourly Usage"
                current={data.usage.hourly.count}
                warning={data.usage.hourly.warning}
                limit={data.usage.hourly.limit}
                resetsAt={data.usage.hourly.resetsAt}
              />
              <UsageBar
                label="Daily Usage"
                current={data.usage.daily.count}
                warning={data.usage.daily.warning}
                resetsAt={data.usage.daily.resetsAt}
              />
              <div className="mt-4 p-3 bg-neutral-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className={data.safeModeEnabled ? "text-green-400" : "text-yellow-400"}>
                    {data.safeModeEnabled ? "🔒" : "⚠️"}
                  </span>
                  <span className="text-neutral-300">
                    Safe Mode: <strong>{data.safeModeEnabled ? "ENABLED" : "DISABLED"}</strong>
                  </span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {data.safeModeEnabled 
                    ? "Automated/cron calls are blocked" 
                    : "Automated calls are allowed (risky)"}
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Hourly Chart */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-4">Activity</h2>
          {data && <HourlyChart data={data.hourlyChart} />}
        </div>
      </div>
      
      {/* Breakdowns Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* By Endpoint */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-4">Calls by Endpoint</h2>
          {data && (
            <div className="space-y-6">
              <EndpointBreakdown data={data.byEndpoint} title="Last Hour" />
              <EndpointBreakdown data={data.byEndpointToday} title="Today" />
            </div>
          )}
        </div>
        
        {/* By Source */}
        <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white mb-4">Calls by Source</h2>
          {data && (
            <div className="space-y-6">
              <EndpointBreakdown data={data.bySource} title="Last Hour" />
              <EndpointBreakdown data={data.bySourceToday} title="Today" />
            </div>
          )}
          
          {/* Batch Job State */}
          {data?.batchJobState && (
            <div className="mt-6 p-3 bg-neutral-700/50 rounded-lg">
              <div className="text-sm font-medium text-neutral-300 mb-2">Batch Job Status</div>
              <div className="text-xs text-neutral-400 space-y-1">
                <div>Running: {data.batchJobState.isRunning ? "Yes ⚙️" : "No"}</div>
                <div>Last Run: {data.batchJobState.lastRunAt 
                  ? new Date(data.batchJobState.lastRunAt).toLocaleString() 
                  : "Never"}</div>
                <div>Total Runs: {data.batchJobState.totalRuns}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Logs Table */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Recent API Calls</h2>
          <div className="text-xs text-neutral-500">
            {data ? `${data.recentLogs.length} of ${data.totalLogsInMemory} in memory` : ""}
          </div>
        </div>
        <RecentLogsTable logs={data?.recentLogs || []} loading={loading && !data} />
      </div>
      
      {/* Footer */}
      <div className="mt-6 text-center text-xs text-neutral-500">
        Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "-"}
        <br />
        This dashboard is read-only and does not generate Wheel-Size API traffic.
      </div>
    </div>
  );
}
