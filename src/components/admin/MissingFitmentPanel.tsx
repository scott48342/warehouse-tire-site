"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * Missing Fitment Panel for Admin Dashboard
 * 
 * Shows vehicles missing from WTD fitment database with:
 * - Stats overview
 * - Alert badges
 * - Sortable/filterable table
 * - Status management actions
 * - Conversation replay links
 */

interface MissingFitmentRequest {
  id: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  normalizedVehicle: string;
  source: string;
  sessionId?: string;
  fallbackUsed: boolean;
  fallbackConfidence?: string;
  cartCreated: boolean;
  checkoutStarted: boolean;
  status: "new" | "reviewed" | "added_to_db" | "ignored";
  requestCount: number;
  lastRequestedAt: string;
  createdAt: string;
  notes?: string;
}

interface Stats {
  total: number;
  new: number;
  reviewed: number;
  addedToDb: number;
  ignored: number;
  withCart: number;
  withCheckout: number;
  topMakes: { make: string; count: number }[];
  recentAlerts: any[];
}

interface Alert {
  id: number;
  type: string;
  normalizedVehicle: string;
  message: string;
  createdAt: string;
}

export function MissingFitmentPanel() {
  const [requests, setRequests] = useState<MissingFitmentRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("request_count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;
  
  // Selection for bulk actions
  const [selected, setSelected] = useState<Set<number>>(new Set());
  
  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: String(limit),
        offset: String(page * limit),
        sortBy,
        sortDir,
      });
      if (search) params.set("search", search);
      
      const [requestsRes, statsRes, alertsRes] = await Promise.all([
        fetch(`/api/admin/missing-fitment?${params}`),
        fetch("/api/admin/missing-fitment?endpoint=stats"),
        fetch("/api/admin/missing-fitment?endpoint=alerts"),
      ]);
      
      const requestsData = await requestsRes.json();
      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      
      setRequests(requestsData.requests || []);
      setTotal(requestsData.total || 0);
      setStats(statsData);
      setAlerts(alertsData.alerts || []);
    } catch (error) {
      console.error("Failed to fetch missing fitment data:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sortBy, sortDir, search, page]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Update status
  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch("/api/admin/missing-fitment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };
  
  // Bulk update
  const bulkUpdate = async (status: string) => {
    if (selected.size === 0) return;
    try {
      await fetch("/api/admin/missing-fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk-status",
          ids: Array.from(selected),
          status,
        }),
      });
      setSelected(new Set());
      fetchData();
    } catch (error) {
      console.error("Failed to bulk update:", error);
    }
  };
  
  // Dismiss alert
  const handleDismissAlert = async (alertId: number) => {
    try {
      await fetch("/api/admin/missing-fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss-alert", alertId }),
      });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error) {
      console.error("Failed to dismiss alert:", error);
    }
  };
  
  // Dismiss all alerts
  const handleDismissAll = async () => {
    try {
      await fetch("/api/admin/missing-fitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss-all-alerts" }),
      });
      setAlerts([]);
    } catch (error) {
      console.error("Failed to dismiss all:", error);
    }
  };
  
  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const toggleSelectAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requests.map(r => r.id)));
    }
  };
  
  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-800",
      reviewed: "bg-yellow-100 text-yellow-800",
      added_to_db: "bg-green-100 text-green-800",
      ignored: "bg-gray-100 text-gray-600",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>
        {status.replace("_", " ")}
      </span>
    );
  };
  
  // Confidence badge
  const ConfidenceBadge = ({ confidence }: { confidence?: string }) => {
    if (!confidence) return <span className="text-gray-400">-</span>;
    const colors: Record<string, string> = {
      high: "text-green-600",
      medium: "text-yellow-600",
      low: "text-orange-600",
      unknown: "text-red-600",
    };
    return (
      <span className={`font-medium ${colors[confidence] || ""}`}>
        {confidence}
      </span>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Missing Fitment Requests</h2>
          <p className="text-sm text-gray-600">
            Vehicles not found in WTD fitment database
          </p>
        </div>
        {stats && stats.new > 0 && (
          <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
            {stats.new} new
          </span>
        )}
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-amber-800">
              🔔 Alerts ({alerts.length})
            </h3>
            <button
              onClick={handleDismissAll}
              className="text-sm text-amber-700 hover:text-amber-900"
            >
              Dismiss all
            </button>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className="flex items-center justify-between bg-white rounded p-2 text-sm"
              >
                <span>{alert.message}</span>
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="New" value={stats.new} highlight />
          <StatCard label="Reviewed" value={stats.reviewed} />
          <StatCard label="Added to DB" value={stats.addedToDb} />
          <StatCard label="Ignored" value={stats.ignored} />
          <StatCard label="With Cart" value={stats.withCart} />
          <StatCard label="Checkout" value={stats.withCheckout} />
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="added_to_db">Added to DB</option>
          <option value="ignored">Ignored</option>
        </select>
        
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="request_count">Request Count</option>
          <option value="last_requested_at">Last Requested</option>
          <option value="created_at">First Requested</option>
        </select>
        
        <button
          onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
          className="border rounded px-3 py-2"
        >
          {sortDir === "desc" ? "↓ Desc" : "↑ Asc"}
        </button>
        
        <input
          type="text"
          placeholder="Search make/model..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
          className="border rounded px-3 py-2 flex-1 min-w-[200px]"
        />
        
        <button
          onClick={fetchData}
          className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded"
        >
          Refresh
        </button>
      </div>
      
      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={() => bulkUpdate("reviewed")}
            className="text-sm bg-yellow-100 hover:bg-yellow-200 px-3 py-1 rounded"
          >
            Mark Reviewed
          </button>
          <button
            onClick={() => bulkUpdate("added_to_db")}
            className="text-sm bg-green-100 hover:bg-green-200 px-3 py-1 rounded"
          >
            Mark Added to DB
          </button>
          <button
            onClick={() => bulkUpdate("ignored")}
            className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
          >
            Ignore
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      )}
      
      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === requests.length && requests.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Vehicle</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Requests</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Fallback</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Outcome</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Last</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No missing fitment requests found
                </td>
              </tr>
            ) : (
              requests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {req.normalizedVehicle}
                    </div>
                    <div className="text-xs text-gray-500">
                      {req.source}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${req.requestCount >= 5 ? "text-red-600" : req.requestCount >= 3 ? "text-orange-600" : "text-gray-900"}`}>
                      {req.requestCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {req.fallbackUsed ? (
                      <ConfidenceBadge confidence={req.fallbackConfidence} />
                    ) : (
                      <span className="text-gray-400">none</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {req.cartCreated && (
                        <span className="text-green-600" title="Cart created">🛒</span>
                      )}
                      {req.checkoutStarted && (
                        <span className="text-blue-600" title="Checkout started">💳</span>
                      )}
                      {!req.cartCreated && !req.checkoutStarted && (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(req.lastRequestedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {req.sessionId && (
                        <a
                          href={`/admin/jake-analytics?conversation=${req.sessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          title="View conversation"
                        >
                          💬
                        </a>
                      )}
                      <select
                        value={req.status}
                        onChange={e => updateStatus(req.id, e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="new">New</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="added_to_db">Added to DB</option>
                        <option value="ignored">Ignore</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      {/* Top Makes */}
      {stats && stats.topMakes.length > 0 && (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3">Top Missing Makes</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topMakes.map(({ make, count }) => (
              <span
                key={make}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm"
              >
                {make} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
      <div className={`text-2xl font-bold ${highlight ? "text-blue-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

export default MissingFitmentPanel;
