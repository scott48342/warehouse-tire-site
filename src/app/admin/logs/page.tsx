"use client";

import { useState, useEffect } from "react";

type LogEntry = {
  id: string;
  log_type: string;
  vehicle_params: Record<string, any> | null;
  sku: string | null;
  resolution_path: string | null;
  details: Record<string, any> | null;
  duration_ms: number | null;
  created_at: string;
};

const LOG_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  fitment: { label: "Fitment", icon: "🔧", color: "blue" },
  fitment_override: { label: "Override", icon: "✏️", color: "amber" },
  fitment_override_deleted: { label: "Override Deleted", icon: "🗑️", color: "red" },
  inventory: { label: "Inventory", icon: "📦", color: "green" },
  search_error: { label: "Search Error", icon: "❌", color: "red" },
  warning: { label: "Warning", icon: "⚠️", color: "amber" },
  product_flag: { label: "Product Flag", icon: "🚩", color: "amber" },
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logType, setLogType] = useState<string>("");
  const [timeFilter, setTimeFilter] = useState<"all" | "24h" | "1h">("all");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (logType) params.set("type", logType);
      if (errorsOnly) params.set("type", "search_error");
      params.set("limit", "100");

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();

      let filteredLogs = data.logs || [];
      
      // Client-side time filtering
      if (timeFilter !== "all") {
        const cutoff = new Date();
        if (timeFilter === "24h") cutoff.setHours(cutoff.getHours() - 24);
        if (timeFilter === "1h") cutoff.setHours(cutoff.getHours() - 1);
        filteredLogs = filteredLogs.filter((l: LogEntry) => new Date(l.created_at) >= cutoff);
      }

      setLogs(filteredLogs);
      setCounts(data.counts || {});
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logType, errorsOnly, timeFilter]);

  const handleClearOld = async () => {
    if (!confirm("Delete logs older than 30 days?")) return;

    try {
      await fetch(`/api/admin/logs?olderThanDays=30${logType ? `&type=${logType}` : ""}`, {
        method: "DELETE",
      });
      fetchLogs();
    } catch (err) {
      alert("Failed to clear logs");
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Logs & Diagnostics</h1>
          <p className="text-neutral-400 mt-1">
            View system logs and debug information
          </p>
        </div>
        <button
          onClick={handleClearOld}
          className="px-4 py-2 rounded-lg bg-neutral-700 text-neutral-300 text-sm font-medium hover:bg-neutral-600"
        >
          Clear Old Logs
        </button>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-400">Time:</span>
          {[
            { value: "all", label: "All time" },
            { value: "24h", label: "Last 24h" },
            { value: "1h", label: "Last hour" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeFilter(t.value as typeof timeFilter)}
              className={`px-3 py-1 rounded text-sm ${
                timeFilter === t.value
                  ? "bg-neutral-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setErrorsOnly(!errorsOnly); setLogType(""); }}
          className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
            errorsOnly
              ? "bg-red-600 text-white"
              : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
        >
          <span>❌</span> Errors only
        </button>
        <button
          onClick={fetchLogs}
          className="px-3 py-1 rounded text-sm bg-neutral-800 text-neutral-400 hover:text-white"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <LogTypeCard
          type=""
          label="All Logs"
          count={Object.values(counts).reduce((a, b) => a + b, 0)}
          active={logType === "" && !errorsOnly}
          onClick={() => { setLogType(""); setErrorsOnly(false); }}
        />
        {Object.entries(LOG_TYPE_LABELS).map(([type, info]) => (
          <LogTypeCard
            key={type}
            type={type}
            label={info.label}
            icon={info.icon}
            count={counts[type] || 0}
            active={logType === type}
            color={info.color}
            onClick={() => { setLogType(type); setErrorsOnly(false); }}
          />
        ))}
      </div>

      {/* Logs List */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No logs found. Logs will appear as the system processes requests.
          </div>
        ) : (
          <div className="divide-y divide-neutral-700">
            {logs.map((log) => {
              const typeInfo = LOG_TYPE_LABELS[log.log_type] || {
                label: log.log_type,
                icon: "📋",
                color: "neutral",
              };
              const isExpanded = expandedId === log.id;
              const isError = log.log_type === "search_error";
              const isWarning = log.log_type === "warning";

              return (
                <div
                  key={log.id}
                  className={`p-4 cursor-pointer ${
                    isError 
                      ? "bg-red-900/20 hover:bg-red-900/30 border-l-4 border-red-600" 
                      : isWarning
                      ? "bg-amber-900/10 hover:bg-amber-900/20 border-l-4 border-amber-600"
                      : "hover:bg-neutral-700/30"
                  }`}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{typeInfo.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">
                            {typeInfo.label}
                          </span>
                          {log.duration_ms && (
                            <span className="text-xs text-neutral-500">
                              {log.duration_ms}ms
                            </span>
                          )}
                        </div>

                        {/* Quick summary based on log type */}
                        <div className="text-sm text-neutral-400 mt-0.5">
                          {log.vehicle_params && (
                            <span>
                              {log.vehicle_params.year} {log.vehicle_params.make}{" "}
                              {log.vehicle_params.model}
                            </span>
                          )}
                          {log.sku && (
                            <span>
                              {log.vehicle_params && " • "}
                              SKU: <code className="bg-neutral-700 px-1 rounded">{log.sku}</code>
                            </span>
                          )}
                          {log.resolution_path && (
                            <span>
                              {(log.vehicle_params || log.sku) && " • "}
                              Path: {log.resolution_path}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-neutral-500 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && log.details && (
                    <div className="mt-4 p-3 bg-neutral-900 rounded-lg">
                      <pre className="text-xs text-neutral-400 overflow-auto max-h-64">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Total count */}
      <div className="text-sm text-neutral-500">
        Showing {logs.length} of {total} logs
      </div>
    </div>
  );
}

function LogTypeCard({
  type,
  label,
  icon,
  count,
  active,
  color,
  onClick,
}: {
  type: string;
  label: string;
  icon?: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  const colorClasses: Record<string, string> = {
    red: "border-red-600 bg-red-600/20",
    amber: "border-amber-600 bg-amber-600/20",
    green: "border-green-600 bg-green-600/20",
    blue: "border-blue-600 bg-blue-600/20",
  };
  
  const countColors: Record<string, string> = {
    red: "text-red-400",
    amber: "text-amber-400",
  };
  
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border text-left transition-colors ${
        active
          ? colorClasses[color || ""] || "bg-red-600/20 border-red-600"
          : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <div className={`text-2xl font-bold mt-1 ${count > 0 && (color === "red" || color === "amber") ? countColors[color] : "text-white"}`}>
        {count}
      </div>
    </button>
  );
}
