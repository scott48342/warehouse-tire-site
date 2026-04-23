"use client";

import { useState, useEffect } from "react";

interface Subscriber {
  id: string;
  email: string;
  source: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim?: string;
  } | null;
  cartId?: string;
  createdAt: string;
}

interface Stats {
  total: number;
  bySource: Record<string, number>;
  withVehicle: number;
  last24h: number;
  last7d: number;
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [hasVehicleFilter, setHasVehicleFilter] = useState(false);

  const sources = ["exit_intent", "cart_save", "checkout", "newsletter", "quote"];

  useEffect(() => {
    loadData();
  }, [sourceFilter, hasVehicleFilter]);

  async function loadData() {
    setLoading(true);
    setError(null);
    
    try {
      // Load stats
      const statsRes = await fetch("/api/admin/subscribers?stats=1");
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      // Load subscribers
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (hasVehicleFilter) params.set("hasVehicle", "1");

      const res = await fetch(`/api/admin/subscribers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch subscribers");
      
      const data = await res.json();
      setSubscribers(data.subscribers || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  function getSourceBadgeColor(source: string) {
    switch (source) {
      case "exit_intent": return "bg-purple-100 text-purple-800";
      case "cart_save": return "bg-blue-100 text-blue-800";
      case "checkout": return "bg-green-100 text-green-800";
      case "newsletter": return "bg-yellow-100 text-yellow-800";
      case "quote": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Email Subscribers</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Last 24h</div>
            <div className="text-2xl font-bold text-green-600">{stats.last24h}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Last 7 Days</div>
            <div className="text-2xl font-bold">{stats.last7d}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">With Vehicle</div>
            <div className="text-2xl font-bold">{stats.withVehicle}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Exit Intent</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.bySource?.exit_intent || 0}
            </div>
          </div>
        </div>
      )}

      {/* Source breakdown */}
      {stats?.bySource && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold mb-3">By Source</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.bySource).map(([source, count]) => (
              <div
                key={source}
                className={`px-3 py-1 rounded-full text-sm ${getSourceBadgeColor(source)}`}
              >
                {source}: <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-4 items-center">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasVehicleFilter}
            onChange={(e) => setHasVehicleFilter(e.target.checked)}
            className="rounded"
          />
          <span>With Vehicle Only</span>
        </label>

        <button
          onClick={loadData}
          className="ml-auto bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Loading/Error */}
      {loading && <div className="text-center py-8">Loading...</div>}
      {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-4">{error}</div>}

      {/* Table */}
      {!loading && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Vehicle</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{sub.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${getSourceBadgeColor(sub.source)}`}>
                      {sub.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {sub.vehicle
                      ? `${sub.vehicle.year} ${sub.vehicle.make} ${sub.vehicle.model}${sub.vehicle.trim ? ` ${sub.vehicle.trim}` : ""}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(sub.createdAt)}
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No subscribers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
