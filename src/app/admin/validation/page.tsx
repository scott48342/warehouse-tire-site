"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

interface ValidationRun {
  id: string;
  name: string;
  description?: string;
  status: string;
  filterYear?: number;
  filterMake?: string;
  filterModel?: string;
  includeLifted: boolean;
  totalVehicles: number;
  passCount: number;
  failCount: number;
  partialCount: number;
  staggeredApplicableCount: number;
  staggeredPassCount: number;
  staggeredFailCount: number;
  durationMs?: number;
  createdAt: string;
  completedAt?: string;
}

interface ValidationResult {
  id: string;
  runId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  status: string;
  failureType?: string;
  failureReason?: string;
  standardTireSizeCount: number;
  standardWheelCount: number;
  standardTireCount: number;
  standardPackageCount: number;
  standardBoltPattern?: string;
  standardSource?: string;
  liftedEnabled: boolean;
  liftedPresetId?: string;
  liftedWheelCount: number;
  liftedTireCount: number;
  liftedPackageCount: number;
  // Staggered fields
  staggeredApplicable: boolean;
  staggeredStatus?: string;
  staggeredFrontTireCount: number;
  staggeredRearTireCount: number;
  staggeredWheelCount: number;
  staggeredPackageCount: number;
  staggeredFrontSize?: string;
  staggeredRearSize?: string;
  durationMs?: number;
  testedAt: string;
  diagnostics?: any;
}

interface FailureBreakdown {
  [key: string]: number;
}

// ============================================================================
// Components
// ============================================================================

function SummaryCard({
  title,
  value,
  subtitle,
  color = "neutral",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "green" | "red" | "yellow" | "blue" | "neutral";
}) {
  const colorClasses = {
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    neutral: "text-white",
  };

  return (
    <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
      <div className="text-sm text-neutral-400 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = {
    pass: "bg-green-900/50 text-green-400 border-green-700",
    fail: "bg-red-900/50 text-red-400 border-red-700",
    partial: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
    running: "bg-blue-900/50 text-blue-400 border-blue-700",
    pending: "bg-neutral-700 text-neutral-400 border-neutral-600",
    completed: "bg-green-900/50 text-green-400 border-green-700",
    failed: "bg-red-900/50 text-red-400 border-red-700",
  }[status] || "bg-neutral-700 text-neutral-400 border-neutral-600";

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${classes}`}>
      {status.toUpperCase()}
    </span>
  );
}

function NewRunModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: any) => void;
}) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [limit, setLimit] = useState("100");
  const [includeLifted, setIncludeLifted] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-neutral-800 rounded-2xl p-6 w-full max-w-md border border-neutral-700">
        <h2 className="text-lg font-bold text-white mb-4">New Validation Run</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Run Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Dodge Full Validation"
              className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white placeholder:text-neutral-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Year (optional)</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white placeholder:text-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Make (optional)</label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="Dodge"
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white placeholder:text-neutral-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Model (optional)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Durango"
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white placeholder:text-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLifted}
              onChange={(e) => setIncludeLifted(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-600 bg-neutral-700"
            />
            <span className="text-sm text-neutral-300">Include lifted flow validation</span>
          </label>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit({
                name: name || `Validation ${new Date().toLocaleDateString()}`,
                year: year || undefined,
                make: make || undefined,
                model: model || undefined,
                limit: parseInt(limit, 10) || 100,
                includeLifted,
              });
              onClose();
            }}
            className="flex-1 h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700"
          >
            Start Run
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultDetailDrawer({
  result,
  onClose,
}: {
  result: ValidationResult | null;
  onClose: () => void;
}) {
  if (!result) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] bg-neutral-800 border-l border-neutral-700 shadow-xl z-40 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">
            {result.year} {result.make} {result.model}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Status */}
          <div>
            <div className="text-sm text-neutral-400 mb-2">Status</div>
            <StatusBadge status={result.status} />
            {result.failureReason && (
              <div className="mt-2 text-sm text-red-400 bg-red-900/20 rounded-lg p-3 border border-red-800">
                {result.failureReason}
              </div>
            )}
          </div>

          {/* Standard Flow */}
          <div>
            <div className="text-sm text-neutral-400 mb-2">Standard Flow</div>
            <div className="bg-neutral-900 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Source</span>
                <span className="text-white">{result.standardSource || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Bolt Pattern</span>
                <span className="text-white">{result.standardBoltPattern || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Tire Sizes</span>
                <span className="text-white">{result.standardTireSizeCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Wheels Found</span>
                <span className={result.standardWheelCount > 0 ? "text-green-400" : "text-red-400"}>
                  {result.standardWheelCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Tires Found</span>
                <span className={result.standardTireCount > 0 ? "text-green-400" : "text-red-400"}>
                  {result.standardTireCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Packages</span>
                <span className="text-white">{result.standardPackageCount}</span>
              </div>
            </div>
          </div>

          {/* Lifted Flow */}
          {result.liftedEnabled && (
            <div>
              <div className="text-sm text-neutral-400 mb-2">Lifted Flow</div>
              <div className="bg-neutral-900 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Preset</span>
                  <span className="text-white">{result.liftedPresetId || "daily"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Wheels Found</span>
                  <span className={result.liftedWheelCount > 0 ? "text-green-400" : "text-yellow-400"}>
                    {result.liftedWheelCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Tires Found</span>
                  <span className={result.liftedTireCount > 0 ? "text-green-400" : "text-yellow-400"}>
                    {result.liftedTireCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Staggered Flow */}
          {result.staggeredApplicable && (
            <div>
              <div className="text-sm text-neutral-400 mb-2">🔀 Staggered Flow</div>
              <div className="bg-neutral-900 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Status</span>
                  <span className={
                    result.staggeredStatus === "pass" ? "text-green-400" :
                    result.staggeredStatus === "fail" ? "text-red-400" :
                    "text-neutral-400"
                  }>
                    {result.staggeredStatus?.toUpperCase() || "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Front Size</span>
                  <span className="text-white font-mono">{result.staggeredFrontSize || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Rear Size</span>
                  <span className="text-white font-mono">{result.staggeredRearSize || "-"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Front Tires Found</span>
                  <span className={result.staggeredFrontTireCount > 0 ? "text-green-400" : "text-red-400"}>
                    {result.staggeredFrontTireCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Rear Tires Found</span>
                  <span className={result.staggeredRearTireCount > 0 ? "text-green-400" : "text-red-400"}>
                    {result.staggeredRearTireCount}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Packages</span>
                  <span className="text-white">{result.staggeredPackageCount}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Non-staggered indicator */}
          {!result.staggeredApplicable && (
            <div>
              <div className="text-sm text-neutral-400 mb-2">🔀 Staggered Flow</div>
              <div className="bg-neutral-900 rounded-lg p-4 text-sm text-neutral-500">
                Not applicable — vehicle does not have staggered OEM fitment
              </div>
            </div>
          )}

          {/* Timing */}
          <div>
            <div className="text-sm text-neutral-400 mb-2">Timing</div>
            <div className="bg-neutral-900 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Duration</span>
                <span className="text-white">{result.durationMs}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Tested At</span>
                <span className="text-white">{new Date(result.testedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Diagnostics JSON */}
          {result.diagnostics && (
            <div>
              <div className="text-sm text-neutral-400 mb-2">Diagnostics</div>
              <pre className="bg-neutral-900 rounded-lg p-4 text-xs text-neutral-300 overflow-x-auto max-h-64">
                {JSON.stringify(result.diagnostics, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function ValidationPage() {
  // State
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ValidationRun | null>(null);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [resultsTotal, setResultsTotal] = useState(0);
  const [failureBreakdown, setFailureBreakdown] = useState<FailureBreakdown>({});
  const [loading, setLoading] = useState(true);
  const [runningNewRun, setRunningNewRun] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [failureTypeFilter, setFailureTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // UI state
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null);

  // Load runs on mount
  useEffect(() => {
    fetchRuns();
  }, []);

  // Load results when run is selected or filters change
  useEffect(() => {
    if (selectedRun) {
      fetchResults();
    }
  }, [selectedRun, statusFilter, failureTypeFilter, page]);

  // Fetch functions
  const fetchRuns = async () => {
    try {
      const res = await fetch("/api/admin/validation/runs");
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs);
        if (data.runs.length > 0 && !selectedRun) {
          setSelectedRun(data.runs[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!selectedRun) return;
    
    try {
      const params = new URLSearchParams({
        runId: selectedRun.id,
        limit: String(pageSize),
        offset: String(page * pageSize),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (failureTypeFilter) params.set("failureType", failureTypeFilter);

      const res = await fetch(`/api/admin/validation/results?${params}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setResultsTotal(data.total);
      }

      // Also fetch failure breakdown
      const runRes = await fetch(`/api/admin/validation/runs/${selectedRun.id}`);
      const runData = await runRes.json();
      if (runData.success) {
        setFailureBreakdown(runData.failureBreakdown || {});
      }
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  };

  // Actions
  const startNewRun = async (config: any) => {
    setRunningNewRun(true);
    try {
      const res = await fetch("/api/admin/validation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        // Poll for completion
        setTimeout(() => {
          fetchRuns();
          setRunningNewRun(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to start run:", err);
      setRunningNewRun(false);
    }
  };

  const rerunFailed = async () => {
    if (!selectedRun) return;
    
    try {
      const res = await fetch("/api/admin/validation/rerun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: selectedRun.id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRuns();
      }
    } catch (err) {
      console.error("Failed to rerun:", err);
    }
  };

  const exportCsv = () => {
    if (!selectedRun) return;
    window.open(`/api/admin/validation/export?runId=${selectedRun.id}`, "_blank");
  };

  // Render
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-400">Loading validation data...</div>
      </div>
    );
  }

  const passRate = selectedRun
    ? ((selectedRun.passCount / (selectedRun.totalVehicles || 1)) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fitment Validation</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Test production fitment flows against real APIs
          </p>
        </div>
        <button
          onClick={() => setShowNewRunModal(true)}
          disabled={runningNewRun}
          className="px-4 h-10 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {runningNewRun ? "Running..." : "+ New Validation Run"}
        </button>
      </div>

      {/* Run Selector */}
      <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
        <label className="block text-sm text-neutral-400 mb-2">Select Validation Run</label>
        <select
          value={selectedRun?.id || ""}
          onChange={(e) => {
            const run = runs.find((r) => r.id === e.target.value);
            setSelectedRun(run || null);
            setPage(0);
          }}
          className="w-full h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
        >
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.name} - {run.status} ({run.totalVehicles} vehicles) - {new Date(run.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedRun && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <SummaryCard
              title="Total Vehicles"
              value={selectedRun.totalVehicles}
              subtitle={`${selectedRun.durationMs ? `${(selectedRun.durationMs / 1000).toFixed(1)}s` : "Running..."}`}
            />
            <SummaryCard
              title="Pass Rate"
              value={`${passRate}%`}
              color={parseFloat(passRate) >= 90 ? "green" : parseFloat(passRate) >= 70 ? "yellow" : "red"}
            />
            <SummaryCard title="Passed" value={selectedRun.passCount} color="green" />
            <SummaryCard title="Failed" value={selectedRun.failCount} color="red" />
            <SummaryCard title="Partial" value={selectedRun.partialCount} color="yellow" />
            <SummaryCard
              title="Status"
              value={selectedRun.status}
              color={selectedRun.status === "completed" ? "green" : selectedRun.status === "running" ? "blue" : "neutral"}
            />
          </div>
          
          {/* Staggered Stats */}
          {selectedRun.staggeredApplicableCount > 0 && (
            <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
              <h3 className="text-sm font-medium text-white mb-3">🔀 Staggered Fitment</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-neutral-400">Applicable</div>
                  <div className="text-lg font-bold text-white">{selectedRun.staggeredApplicableCount}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400">Pass</div>
                  <div className="text-lg font-bold text-green-400">{selectedRun.staggeredPassCount}</div>
                </div>
                <div>
                  <div className="text-xs text-neutral-400">Fail</div>
                  <div className="text-lg font-bold text-red-400">{selectedRun.staggeredFailCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Failure Breakdown */}
          {Object.keys(failureBreakdown).length > 0 && (
            <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
              <h3 className="text-sm font-medium text-white mb-3">Failure Breakdown</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(failureBreakdown).map(([type, count]) => (
                  <button
                    key={type}
                    onClick={() => {
                      setFailureTypeFilter(failureTypeFilter === type ? "" : type);
                      setPage(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      failureTypeFilter === type
                        ? "bg-red-600 text-white"
                        : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                    }`}
                  >
                    {type.replace(/_/g, " ")}: {count}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="flex items-center gap-4">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              className="h-10 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white"
            >
              <option value="">All Statuses</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="partial">Partial</option>
            </select>

            <div className="flex-1" />

            <button
              onClick={rerunFailed}
              disabled={selectedRun.failCount === 0}
              className="px-4 h-10 rounded-lg bg-neutral-700 text-neutral-300 hover:bg-neutral-600 disabled:opacity-50"
            >
              🔄 Rerun Failed ({selectedRun.failCount})
            </button>
            <button
              onClick={exportCsv}
              className="px-4 h-10 rounded-lg bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
            >
              📥 Export CSV
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-900 text-left text-sm text-neutral-400">
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Bolt Pattern</th>
                  <th className="px-4 py-3">Tire Sizes</th>
                  <th className="px-4 py-3">Wheels</th>
                  <th className="px-4 py-3">Tires</th>
                  <th className="px-4 py-3">Staggered</th>
                  <th className="px-4 py-3">Failure</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className="border-t border-neutral-700 hover:bg-neutral-700/50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-white">
                      {result.year} {result.make} {result.model}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={result.status} />
                    </td>
                    <td className="px-4 py-3 text-neutral-300 font-mono text-sm">
                      {result.standardBoltPattern || "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {result.standardTireSizeCount}
                    </td>
                    <td className="px-4 py-3">
                      <span className={result.standardWheelCount > 0 ? "text-green-400" : "text-red-400"}>
                        {result.standardWheelCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={result.standardTireCount > 0 ? "text-green-400" : "text-red-400"}>
                        {result.standardTireCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {result.staggeredApplicable ? (
                        <span className={
                          result.staggeredStatus === "pass" ? "text-green-400" :
                          result.staggeredStatus === "fail" ? "text-red-400" :
                          "text-neutral-500"
                        }>
                          {result.staggeredStatus === "pass" ? "✓" : result.staggeredStatus === "fail" ? "✗" : "-"}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400 max-w-[200px] truncate">
                      {result.failureType?.replace(/_/g, " ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">
                      {result.durationMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-t border-neutral-700">
              <div className="text-sm text-neutral-400">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, resultsTotal)} of {resultsTotal}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded bg-neutral-700 text-neutral-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * pageSize >= resultsTotal}
                  className="px-3 py-1 rounded bg-neutral-700 text-neutral-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <NewRunModal
        isOpen={showNewRunModal}
        onClose={() => setShowNewRunModal(false)}
        onSubmit={startNewRun}
      />

      {/* Detail Drawer */}
      <ResultDetailDrawer result={selectedResult} onClose={() => setSelectedResult(null)} />

      {/* Overlay for drawer */}
      {selectedResult && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
}
