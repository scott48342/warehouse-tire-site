'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QARun {
  run_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  vehicle_count: number;
  passed_count: number;
  failed_count: number;
  warning_count: number;
  critical_failures: number;
  high_failures: number;
  pass_rate: number;
  category_stats: Record<string, { total: number; passed: number; failed: number; passRate: number }>;
  commit_hash: string | null;
  duration_ms: number | null;
}

interface QAStats {
  latestRun: QARun | null;
  runs: QARun[];
  failureBreakdown: { failure_type: string; severity: string; count: string }[];
  trend: { date: string; avg_pass_rate: string; total_vehicles: string; critical_failures: string }[];
  unresolvedAnomalies: { severity: string; count: string }[];
  topFailingVehicles: {
    year: number;
    make: string;
    model: string;
    trim: string;
    category: string;
    failure_count: string;
    failure_types: string[];
  }[];
}

export default function QADashboard() {
  const [stats, setStats] = useState<QAStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/qa/stats?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  const severityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const passRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold">Error Loading QA Dashboard</h2>
          <p className="text-red-600 mt-1">{error}</p>
          <p className="text-red-500 text-sm mt-2">
            Make sure the QA tables exist. Run: <code>psql -f scripts/migrations/0031_qa_infrastructure.sql</code>
          </p>
        </div>
      </div>
    );
  }

  const latest = stats?.latestRun;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">QA Dashboard</h1>
          <p className="text-gray-500 mt-1">Fitment quality assurance monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="border rounded-lg px-3 py-2"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Latest Pass Rate</div>
          <div className={`text-3xl font-bold ${latest ? passRateColor(latest.pass_rate) : 'text-gray-400'}`}>
            {latest ? `${latest.pass_rate}%` : '-'}
          </div>
          {latest && (
            <div className="text-sm text-gray-500 mt-2">
              {latest.passed_count} / {latest.vehicle_count} vehicles
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Critical Failures</div>
          <div className={`text-3xl font-bold ${(latest?.critical_failures || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {latest?.critical_failures || 0}
          </div>
          {latest?.high_failures ? (
            <div className="text-sm text-orange-600 mt-2">
              + {latest.high_failures} high severity
            </div>
          ) : null}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Unresolved Anomalies</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats?.unresolvedAnomalies?.reduce((sum, a) => sum + parseInt(a.count), 0) || 0}
          </div>
          <div className="text-sm text-gray-500 mt-2 flex gap-2">
            {stats?.unresolvedAnomalies?.map(a => (
              <span key={a.severity} className={`px-2 py-0.5 rounded text-xs ${severityBadge(a.severity)}`}>
                {a.count} {a.severity}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Latest Run</div>
          <div className="text-lg font-semibold text-gray-900">
            {latest ? formatDate(latest.started_at) : 'No runs yet'}
          </div>
          {latest && (
            <div className="text-sm text-gray-500 mt-2">
              Duration: {formatDuration(latest.duration_ms)}
            </div>
          )}
        </div>
      </div>

      {/* Category Health */}
      {latest?.category_stats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Health (Latest Run)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {Object.entries(latest.category_stats).map(([category, stats]) => (
              <div key={category} className="text-center">
                <div className="text-sm font-medium text-gray-700 mb-1">{category}</div>
                <div className={`text-xl font-bold ${passRateColor(stats.passRate)}`}>
                  {stats.passRate}%
                </div>
                <div className="text-xs text-gray-500">
                  {stats.passed}/{stats.total}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Runs</h2>
          <div className="space-y-3">
            {stats?.runs?.slice(0, 10).map(run => (
              <Link
                key={run.run_id}
                href={`/admin/qa/runs/${run.run_id}`}
                className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(run.started_at).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {run.vehicle_count} vehicles • {formatDuration(run.duration_ms)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${passRateColor(run.pass_rate)}`}>
                      {run.pass_rate}%
                    </div>
                    {run.critical_failures > 0 && (
                      <div className="text-xs text-red-600">
                        {run.critical_failures} critical
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Failing Vehicles */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Failing Vehicles</h2>
          {stats?.topFailingVehicles?.length ? (
            <div className="space-y-3">
              {stats.topFailingVehicles.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">
                      {v.year} {v.make} {v.model} {v.trim}
                    </div>
                    <div className="text-sm text-gray-500">
                      {v.category} • {v.failure_types?.join(', ')}
                    </div>
                  </div>
                  <div className="text-red-600 font-semibold">
                    {v.failure_count}x
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-8">
              No failing vehicles in this period 🎉
            </div>
          )}
        </div>
      </div>

      {/* Failure Breakdown */}
      {stats?.failureBreakdown && stats.failureBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Latest Run Failure Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.failureBreakdown.map((fb, i) => (
              <div key={i} className="text-center p-4 border rounded-lg">
                <div className={`inline-block px-2 py-1 rounded text-xs mb-2 ${severityBadge(fb.severity)}`}>
                  {fb.severity}
                </div>
                <div className="text-2xl font-bold text-gray-900">{fb.count}</div>
                <div className="text-sm text-gray-500">{fb.failure_type || 'unknown'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to Run */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Running QA Sweeps</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Quick test (50 vehicles):</strong></p>
          <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs --quick</code>
          
          <p className="mt-3"><strong>Full sweep (250 vehicles):</strong></p>
          <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs</code>
          
          <p className="mt-3"><strong>Test specific category:</strong></p>
          <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs --category staggered</code>
        </div>
      </div>
    </div>
  );
}
