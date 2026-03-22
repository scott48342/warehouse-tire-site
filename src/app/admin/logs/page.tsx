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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (logType) params.set("type", logType);
      params.set("limit", "100");

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();

      setLogs(data.logs || []);
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
  }, [logType]);

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <LogTypeCard
          type=""
          label="All Logs"
          count={Object.values(counts).reduce((a, b) => a + b, 0)}
          active={logType === ""}
          onClick={() => setLogType("")}
        />
        {Object.entries(LOG_TYPE_LABELS).map(([type, info]) => (
          <LogTypeCard
            key={type}
            type={type}
            label={info.label}
            icon={info.icon}
            count={counts[type] || 0}
            active={logType === type}
            onClick={() => setLogType(type)}
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

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-neutral-700/30 cursor-pointer"
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
  onClick,
}: {
  type: string;
  label: string;
  icon?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-xl border text-left transition-colors ${
        active
          ? "bg-red-600/20 border-red-600"
          : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-1">{count}</div>
    </button>
  );
}
