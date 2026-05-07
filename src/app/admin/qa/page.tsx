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
  notes: string | null;
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
  const [activeTab, setActiveTab] = useState<'all' | 'lifted'>('all');

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

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Tests
        </button>
        <button
          onClick={() => setActiveTab('lifted')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'lifted'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🔧 Lifted Package QA
        </button>
      </div>

      {/* Summary Cards - filter based on tab */}
      {(() => {
        // For lifted tab, filter to runs with lifted category
        const filteredRuns = activeTab === 'lifted' 
          ? stats?.runs?.filter(r => r.category_stats?.lifted) || []
          : stats?.runs || [];
        const tabLatest = filteredRuns[0] || null;
        const liftedStats = tabLatest?.category_stats?.lifted;
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">
                {activeTab === 'lifted' ? 'Lifted Pass Rate' : 'Latest Pass Rate'}
              </div>
              <div className={`text-3xl font-bold ${
                activeTab === 'lifted' 
                  ? (liftedStats ? passRateColor(liftedStats.passRate) : 'text-gray-400')
                  : (latest ? passRateColor(latest.pass_rate) : 'text-gray-400')
              }`}>
                {activeTab === 'lifted' 
                  ? (liftedStats ? `${liftedStats.passRate}%` : '-')
                  : (latest ? `${latest.pass_rate}%` : '-')
                }
              </div>
              {activeTab === 'lifted' && liftedStats && (
                <div className="text-sm text-gray-500 mt-2">
                  {liftedStats.passed} / {liftedStats.total} tests
                </div>
              )}
              {activeTab !== 'lifted' && latest && (
                <div className="text-sm text-gray-500 mt-2">
                  {latest.passed_count} / {latest.vehicle_count} vehicles
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">
                {activeTab === 'lifted' ? 'Failed Tests' : 'Critical Failures'}
              </div>
              <div className={`text-3xl font-bold ${
                activeTab === 'lifted'
                  ? ((liftedStats?.failed || 0) > 0 ? 'text-red-600' : 'text-green-600')
                  : ((latest?.critical_failures || 0) > 0 ? 'text-red-600' : 'text-green-600')
              }`}>
                {activeTab === 'lifted' 
                  ? (liftedStats?.failed || 0)
                  : (latest?.critical_failures || 0)
                }
              </div>
              {activeTab !== 'lifted' && latest?.high_failures ? (
                <div className="text-sm text-orange-600 mt-2">
                  + {latest.high_failures} high severity
                </div>
              ) : null}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">
                {activeTab === 'lifted' ? 'Lifted Runs' : 'Unresolved Anomalies'}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {activeTab === 'lifted'
                  ? filteredRuns.length
                  : (stats?.unresolvedAnomalies?.reduce((sum, a) => sum + parseInt(a.count), 0) || 0)
                }
              </div>
              {activeTab !== 'lifted' && (
                <div className="text-sm text-gray-500 mt-2 flex gap-2">
                  {stats?.unresolvedAnomalies?.map(a => (
                    <span key={a.severity} className={`px-2 py-0.5 rounded text-xs ${severityBadge(a.severity)}`}>
                      {a.count} {a.severity}
                    </span>
                  ))}
                </div>
              )}
              {activeTab === 'lifted' && (
                <div className="text-sm text-gray-500 mt-2">
                  in last {days} days
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Latest Run</div>
              <div className="text-lg font-semibold text-gray-900">
                {tabLatest ? formatDate(tabLatest.started_at) : 'No runs yet'}
              </div>
              {tabLatest && (
                <div className="text-sm text-gray-500 mt-2">
                  Duration: {formatDuration(tabLatest.duration_ms)}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Category Health - only show for All tab */}
      {activeTab === 'all' && latest?.category_stats && (
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

      {/* Lifted Package Info - only show for Lifted tab */}
      {activeTab === 'lifted' && (
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">🔧 Lifted Package QA</h2>
          <p className="text-blue-700 text-sm mb-4">
            Tests the lifted vehicle build flow across multiple lift heights (2&quot;, 4&quot;, 6&quot;).
            Validates wheel/tire recommendations for leveled and lifted trucks.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="bg-white rounded-lg px-3 py-2 border border-blue-200">
              <span className="text-gray-500">2&quot; Lift:</span>
              <span className="ml-2 font-medium">32-33&quot; tires, -12 to 0 offset</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-blue-200">
              <span className="text-gray-500">4&quot; Lift:</span>
              <span className="ml-2 font-medium">33-35&quot; tires, -18 to 0 offset</span>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-blue-200">
              <span className="text-gray-500">6&quot; Lift:</span>
              <span className="ml-2 font-medium">35-37&quot; tires, -50 to -24 offset</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Runs - filter based on tab */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {activeTab === 'lifted' ? 'Recent Lifted Runs' : 'Recent Runs'}
          </h2>
          <div className="space-y-3">
            {(() => {
              const filteredRuns = activeTab === 'lifted'
                ? stats?.runs?.filter(r => r.category_stats?.lifted) || []
                : stats?.runs || [];
              
              if (filteredRuns.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    {activeTab === 'lifted' 
                      ? 'No lifted QA runs yet. Run the lifted package QA script to generate data.'
                      : 'No runs yet'
                    }
                  </div>
                );
              }
              
              return filteredRuns.slice(0, 10).map(run => {
                const liftedStats = run.category_stats?.lifted;
                const displayRate = activeTab === 'lifted' && liftedStats
                  ? liftedStats.passRate
                  : run.pass_rate;
                const displayCount = activeTab === 'lifted' && liftedStats
                  ? `${liftedStats.total} tests`
                  : `${run.vehicle_count} vehicles`;
                
                return (
                  <Link
                    key={run.run_id}
                    href={`/admin/qa/runs/${run.run_id}${activeTab === 'lifted' ? '?category=lifted' : ''}`}
                    className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(run.started_at).toLocaleDateString()}
                          {run.notes?.includes('Lifted') && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              🔧 Lifted
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {displayCount} • {formatDuration(run.duration_ms)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${passRateColor(displayRate)}`}>
                          {displayRate}%
                        </div>
                        {activeTab !== 'lifted' && run.critical_failures > 0 && (
                          <div className="text-xs text-red-600">
                            {run.critical_failures} critical
                          </div>
                        )}
                        {activeTab === 'lifted' && liftedStats?.failed > 0 && (
                          <div className="text-xs text-red-600">
                            {liftedStats.failed} failed
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              });
            })()}
          </div>
        </div>

        {/* Top Failing Vehicles */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {activeTab === 'lifted' ? 'Lifted Test Failures' : 'Top Failing Vehicles'}
          </h2>
          {(() => {
            const failures = activeTab === 'lifted'
              ? stats?.topFailingVehicles?.filter(v => v.category === 'lifted') || []
              : stats?.topFailingVehicles || [];
            
            if (failures.length > 0) {
              return (
                <div className="space-y-3">
                  {failures.map((v, i) => (
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
              );
            }
            
            return (
              <div className="text-gray-500 text-center py-8">
                {activeTab === 'lifted' 
                  ? 'No lifted test failures 🎉'
                  : 'No failing vehicles in this period 🎉'
                }
              </div>
            );
          })()}
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
        {activeTab === 'all' ? (
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Quick test (50 vehicles):</strong></p>
            <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs --quick</code>
            
            <p className="mt-3"><strong>Full sweep (250 vehicles):</strong></p>
            <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs</code>
            
            <p className="mt-3"><strong>Test specific category:</strong></p>
            <code className="block bg-gray-200 p-2 rounded">node scripts/nightly-qa/index.mjs --category staggered</code>
          </div>
        ) : (
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Run lifted package QA (against prod):</strong></p>
            <code className="block bg-gray-200 p-2 rounded">node scripts/qa-sweep/lifted-package-qa.mjs</code>
            
            <p className="mt-3"><strong>Run against localhost:</strong></p>
            <code className="block bg-gray-200 p-2 rounded">BASE_URL=http://localhost:3001 node scripts/qa-sweep/lifted-package-qa.mjs</code>
            
            <p className="mt-3"><strong>Dry run (no DB save):</strong></p>
            <code className="block bg-gray-200 p-2 rounded">node scripts/qa-sweep/lifted-package-qa.mjs --dry-run</code>
            
            <p className="mt-4 text-blue-700">
              <strong>Test Vehicles:</strong> Ram 1500, Ford F-150, Silverado 1500, Sierra 1500, 
              Tacoma, Tundra, Wrangler, Silverado 2500 HD
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
