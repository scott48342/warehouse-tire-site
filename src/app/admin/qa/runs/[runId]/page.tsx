'use client';

import { useState, useEffect, use } from 'react';
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

interface QAResult {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string;
  category: string;
  is_performance: boolean;
  is_canary: boolean;
  status: 'pass' | 'fail' | 'warning' | 'error';
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
  failure_type: string | null;
  wheel_test_passed: boolean;
  wheel_count: number;
  bolt_pattern: string;
  bolt_pattern_expected: string;
  bolt_pattern_match: boolean;
  staggered_detected: boolean;
  staggered_expected: boolean;
  staggered_mismatch: boolean;
  tire_test_passed: boolean;
  tire_count: number;
  tire_diameter: string;
  lifted_tests: any;
  package_test_passed: boolean;
  package_viable: boolean;
  error_message: string | null;
  duration_ms: number;
}

interface CategoryBreakdown {
  category: string;
  total: string;
  passed: string;
  failed: string;
  critical: string;
}

interface RunData {
  run: QARun;
  results: QAResult[];
  categoryBreakdown: CategoryBreakdown[];
  total: number;
  limit: number;
  offset: number;
}

export default function QARunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const [data, setData] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [failureTypeFilter, setFailureTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchRunData();
  }, [runId, statusFilter, severityFilter, categoryFilter, failureTypeFilter, page]);

  const fetchRunData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (failureTypeFilter) params.set('failureType', failureTypeFilter);
      params.set('limit', limit.toString());
      params.set('offset', (page * limit).toString());

      const res = await fetch(`/api/admin/qa/runs/${runId}?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Run not found');
        throw new Error('Failed to fetch run details');
      }
      const json = await res.json();
      setData(json);
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
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const severityBadge = (severity: string | null) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return severity ? colors[severity] || 'bg-gray-100 text-gray-800' : '';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pass: 'bg-green-100 text-green-800 border-green-200',
      fail: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const passRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link href="/admin/qa" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to QA Dashboard
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
          <h2 className="text-red-800 font-semibold">Error</h2>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const run = data?.run;
  const results = data?.results || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Get unique failure types for filter
  const failureTypes = [...new Set(results.filter(r => r.failure_type).map(r => r.failure_type))];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/qa" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to QA Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            QA Run: {run ? new Date(run.started_at).toLocaleDateString() : ''}
          </h1>
          <p className="text-gray-500 mt-1">
            {run ? formatDate(run.started_at) : ''}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${run ? passRateColor(run.pass_rate) : ''}`}>
            {run?.pass_rate ?? '-'}%
          </div>
          <div className="text-sm text-gray-500">Pass Rate</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Vehicles</div>
          <div className="text-2xl font-bold text-gray-900">{run?.vehicle_count || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Passed</div>
          <div className="text-2xl font-bold text-green-600">{run?.passed_count || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Failed</div>
          <div className="text-2xl font-bold text-red-600">{run?.failed_count || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Critical</div>
          <div className="text-2xl font-bold text-red-700">{run?.critical_failures || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Duration</div>
          <div className="text-2xl font-bold text-gray-900">{formatDuration(run?.duration_ms ?? null)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-2xl font-bold text-gray-900 capitalize">{run?.status || '-'}</div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Category Breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {categoryBreakdown.map(cat => {
              const passRate = parseInt(cat.total) > 0 
                ? Math.round((parseInt(cat.passed) / parseInt(cat.total)) * 100) 
                : 0;
              return (
                <button
                  key={cat.category}
                  onClick={() => {
                    setCategoryFilter(categoryFilter === cat.category ? '' : cat.category);
                    setPage(0);
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    categoryFilter === cat.category
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span className="font-medium">{cat.category}</span>
                  <span className={`ml-2 ${passRateColor(passRate)}`}>
                    {passRate}%
                  </span>
                  <span className="text-gray-400 ml-1">
                    ({cat.passed}/{cat.total})
                  </span>
                  {parseInt(cat.critical) > 0 && (
                    <span className="ml-2 text-red-600 font-semibold">
                      {cat.critical} critical
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Failure Type</label>
            <select
              value={failureTypeFilter}
              onChange={(e) => { setFailureTypeFilter(e.target.value); setPage(0); }}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="logic">Logic</option>
              <option value="inventory">Inventory</option>
              <option value="supplier">Supplier</option>
              <option value="data">Data</option>
              <option value="known_gap">Known Gap</option>
            </select>
          </div>
          {(statusFilter || severityFilter || categoryFilter || failureTypeFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setSeverityFilter('');
                setCategoryFilter('');
                setFailureTypeFilter('');
                setPage(0);
              }}
              className="text-sm text-blue-600 hover:underline mt-4"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto text-sm text-gray-500">
            Showing {results.length} of {total} results
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wheels</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tires</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staggered</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result) => (
              <tr key={result.id} className={result.status === 'fail' ? 'bg-red-50' : ''}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {result.year} {result.make} {result.model}
                  </div>
                  <div className="text-sm text-gray-500">
                    {result.trim}
                    {result.is_canary && <span className="ml-2 text-yellow-600">🐤 canary</span>}
                    {result.is_performance && <span className="ml-2 text-purple-600">⚡ perf</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{result.category}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge(result.status)}`}>
                    {result.status}
                  </span>
                  {result.severity && (
                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${severityBadge(result.severity)}`}>
                      {result.severity}
                    </span>
                  )}
                  {result.failure_type && (
                    <div className="text-xs text-gray-500 mt-1">{result.failure_type}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={`text-sm ${result.wheel_test_passed ? 'text-green-600' : 'text-red-600'}`}>
                    {result.wheel_test_passed ? '✓' : '✗'} {result.wheel_count || 0}
                  </div>
                  {result.bolt_pattern && (
                    <div className="text-xs text-gray-500">
                      {result.bolt_pattern}
                      {!result.bolt_pattern_match && result.bolt_pattern_expected && (
                        <span className="text-red-500"> (exp: {result.bolt_pattern_expected})</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={`text-sm ${result.tire_test_passed ? 'text-green-600' : 'text-red-600'}`}>
                    {result.tire_test_passed ? '✓' : '✗'} {result.tire_count || 0}
                  </div>
                  {result.tire_diameter && (
                    <div className="text-xs text-gray-500">{result.tire_diameter}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {result.staggered_expected !== null && (
                    <div className={`text-sm ${!result.staggered_mismatch ? 'text-green-600' : 'text-red-600'}`}>
                      {result.staggered_detected ? 'Yes' : 'No'}
                      {result.staggered_mismatch && (
                        <span className="text-red-500 text-xs block">
                          (exp: {result.staggered_expected ? 'Yes' : 'No'})
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {result.error_message && (
                    <div className="text-xs text-red-600 max-w-xs truncate" title={result.error_message}>
                      {result.error_message}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {result.duration_ms}ms
                  </div>
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No results match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow px-4 py-3">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
