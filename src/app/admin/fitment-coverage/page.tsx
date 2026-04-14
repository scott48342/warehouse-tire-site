"use client";

import { useEffect, useState } from "react";

interface CoverageStats {
  totalSelections: number;
  configBacked: number;
  legacyFallback: number;
  noData: number;
  configCoveragePercent: number;
  fallbackPercent: number;
  byConfidence: Record<string, number>;
  byProductType: Record<string, number>;
  byMake?: Record<string, { total: number; config: number; fallback: number }>;
  last24h?: {
    total: number;
    configBacked: number;
    configCoveragePercent: number;
  };
  redisConfigured?: boolean;
  message?: string;
}

export default function FitmentCoveragePage() {
  const [stats, setStats] = useState<CoverageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/analytics/fitment-coverage?detailed=true&hours=24");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Fitment Coverage Analytics</h1>
        <p className="mt-4 text-neutral-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Fitment Coverage Analytics</h1>
        <p className="mt-4 text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Fitment Coverage Analytics</h1>
        <p className="mt-4 text-neutral-600">No data available yet.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Fitment Coverage Analytics</h1>
      <p className="mt-2 text-neutral-600">
        Real-world tracking of config-backed vs fallback fitment
      </p>
      
      {/* Redis not configured warning */}
      {stats.redisConfigured === false && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-semibold text-amber-800">Redis Not Configured</div>
              <p className="mt-1 text-sm text-amber-700">
                {stats.message || "Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables to enable tracking."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-6">
          <div className="text-sm font-medium text-neutral-500">Total Selections</div>
          <div className="mt-2 text-3xl font-bold">{stats.totalSelections.toLocaleString()}</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-6">
          <div className="text-sm font-medium text-green-700">Config-Backed</div>
          <div className="mt-2 text-3xl font-bold text-green-800">
            {stats.configCoveragePercent.toFixed(1)}%
          </div>
          <div className="text-sm text-green-600">{stats.configBacked.toLocaleString()} selections</div>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <div className="text-sm font-medium text-amber-700">Legacy Fallback</div>
          <div className="mt-2 text-3xl font-bold text-amber-800">
            {stats.legacyFallback.toLocaleString()}
          </div>
          <div className="text-sm text-amber-600">
            {stats.totalSelections > 0
              ? ((stats.legacyFallback / stats.totalSelections) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-6">
          <div className="text-sm font-medium text-red-700">No Data</div>
          <div className="mt-2 text-3xl font-bold text-red-800">
            {stats.noData.toLocaleString()}
          </div>
          <div className="text-sm text-red-600">
            {stats.totalSelections > 0
              ? ((stats.noData / stats.totalSelections) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Last 24h */}
      {stats.last24h && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Last 24 Hours</h2>
          <div className="mt-4 bg-white rounded-xl border p-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-neutral-500">Selections</div>
                <div className="text-2xl font-bold">{stats.last24h.total.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-500">Config-Backed</div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.last24h.configBacked.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-neutral-500">Coverage Rate</div>
                <div className="text-2xl font-bold">
                  {stats.last24h.configCoveragePercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* By Confidence */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold">By Confidence Level</h2>
        <div className="mt-4 bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Confidence</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Count</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(stats.byConfidence).map(([level, count]) => (
                <tr key={level}>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        level === "high"
                          ? "bg-green-100 text-green-800"
                          : level === "medium"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {stats.totalSelections > 0 ? ((count / stats.totalSelections) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By Make */}
      {stats.byMake && Object.keys(stats.byMake).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">By Make (Top 20)</h2>
          <div className="mt-4 bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-700">Make</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Total</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Config</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Fallback</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-neutral-700">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(stats.byMake)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 20)
                  .map(([make, data]) => (
                    <tr key={make}>
                      <td className="px-4 py-3 text-sm font-medium capitalize">{make}</td>
                      <td className="px-4 py-3 text-sm text-right">{data.total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {data.config.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-amber-600">
                        {data.fallback.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={
                            data.total > 0 && (data.config / data.total) >= 0.8
                              ? "text-green-600 font-semibold"
                              : data.total > 0 && (data.config / data.total) >= 0.5
                              ? "text-amber-600"
                              : "text-red-600"
                          }
                        >
                          {data.total > 0 ? ((data.config / data.total) * 100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refresh Note */}
      <p className="mt-8 text-sm text-neutral-500">
        Data refreshes every 30 seconds. This tracks real user sessions, not theoretical coverage.
      </p>
    </div>
  );
}
