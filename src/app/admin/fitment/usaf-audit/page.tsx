"use client";

import { useState, useEffect } from "react";

interface EnrichedVehicle {
  year: number;
  make: string;
  model: string;
  wtd: { sizes: string[]; trims: string[] };
  usaf: { sizes: string[] };
  normalizedComparison: {
    common: Array<{ wtd: string; usaf: string; normalized: string }>;
    wtdOnly: string[];
    usafOnly: string[];
  };
  staggeredPairs: Array<{ front: string; rear: string; confidence: number }>;
  mismatchAnalysis: {
    confidence: number;
    reason: string;
    category: string;
  };
  category: string;
  recommendedAction: string;
  error?: string;
}

interface AuditData {
  filename: string;
  timestamp: string;
  filters: Record<string, string>;
  summary: {
    total: number;
    matched: number;
    partial: number;
    wtdOnly: number;
    usafOnly: number;
    errors: number;
    categories: Record<string, number>;
    recommendations: Record<string, number>;
  };
  grouped: Record<string, EnrichedVehicle[]>;
  highlights: {
    enrichmentCandidates: EnrichedVehicle[];
    likelyBadRecords: EnrichedVehicle[];
    staggeredIssues: EnrichedVehicle[];
  };
}

type ReviewDecision = "approve" | "ignore" | "manual_review" | null;

export default function UsafAuditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditData | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState("latest");
  const [activeTab, setActiveTab] = useState<string>("enrichment");
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    loadAuditData(selectedFile);
  }, [selectedFile]);

  async function loadFiles() {
    try {
      const res = await fetch("/api/admin/usaf-audit?action=files");
      const json = await res.json();
      setFiles(json.files || []);
    } catch (e) {
      console.error("Failed to load files:", e);
    }
  }

  async function loadAuditData(file: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/usaf-audit?file=${encodeURIComponent(file)}`);
      if (!res.ok) {
        throw new Error(`Failed to load: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setDecisions({}); // Reset decisions when file changes
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function setDecision(key: string, decision: ReviewDecision) {
    setDecisions(prev => ({ ...prev, [key]: decision }));
  }

  function getVehicleKey(v: EnrichedVehicle): string {
    return `${v.year}-${v.make}-${v.model}`;
  }

  async function exportApproved() {
    setExporting(true);
    try {
      const approved = data?.highlights.enrichmentCandidates
        .filter(v => decisions[getVehicleKey(v)] === "approve" || 
          (decisions[getVehicleKey(v)] === null && v.recommendedAction === "approve"))
        .map(v => ({
          year: v.year,
          make: v.make,
          model: v.model,
          usafOnly: v.normalizedComparison.usafOnly,
          confidence: v.mismatchAnalysis.confidence,
          action: "approve",
        })) || [];

      const res = await fetch("/api/admin/usaf-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", decisions: approved }),
      });
      
      const json = await res.json();
      if (json.success) {
        alert(`Exported ${json.count} approved fixes to ${json.filename}`);
      } else {
        alert(`Export failed: ${json.error}`);
      }
    } catch (e) {
      alert(`Export error: ${e}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">USAF Fitment Audit Review</h1>
        <p className="text-gray-500">Loading audit data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">USAF Fitment Audit Review</h1>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const tabs = [
    { id: "enrichment", label: `Enrichment Candidates (${data.highlights.enrichmentCandidates.length})`, color: "bg-green-100" },
    { id: "badRecords", label: `Likely Bad WTD (${data.highlights.likelyBadRecords.length})`, color: "bg-red-100" },
    { id: "staggered", label: `Staggered Issues (${data.highlights.staggeredIssues.length})`, color: "bg-yellow-100" },
    { id: "exact", label: `Exact Match (${data.grouped.exact?.length || 0})`, color: "bg-gray-100" },
    { id: "partial", label: `Partial (${data.grouped.partial?.length || 0})`, color: "bg-blue-100" },
    { id: "wtdOnly", label: `WTD Only (${data.grouped.wtdOnly?.length || 0})`, color: "bg-gray-100" },
    { id: "errors", label: `Errors (${data.grouped.error?.length || 0})`, color: "bg-red-100" },
  ];

  function getActiveVehicles(): EnrichedVehicle[] {
    switch (activeTab) {
      case "enrichment": return data?.highlights.enrichmentCandidates || [];
      case "badRecords": return data?.highlights.likelyBadRecords || [];
      case "staggered": return data?.highlights.staggeredIssues || [];
      case "exact": return data?.grouped.exact || [];
      case "partial": return data?.grouped.partial || [];
      case "wtdOnly": return data?.grouped.wtdOnly || [];
      case "errors": return data?.grouped.error || [];
      default: return [];
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">USAF Fitment Audit Review</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="latest">Latest</option>
            {files.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button
            onClick={exportApproved}
            disabled={exporting}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Approved"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Vehicles</div>
          <div className="text-2xl font-bold">{data.summary.total}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-green-600">Enrichment Candidates</div>
          <div className="text-2xl font-bold text-green-700">{data.summary.recommendations.approve}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-yellow-600">Manual Review</div>
          <div className="text-2xl font-bold text-yellow-700">{data.summary.recommendations.manualReview}</div>
        </div>
        <div className="bg-gray-50 border rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Can Ignore</div>
          <div className="text-2xl font-bold">{data.summary.recommendations.ignore}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white"
                : `${tab.color} text-gray-700 hover:bg-opacity-75`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vehicle List */}
      <div className="space-y-4">
        {getActiveVehicles().map((v, idx) => {
          const key = getVehicleKey(v);
          const decision = decisions[key];
          
          return (
            <div key={key} className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">
                    {v.year} {v.make} {v.model}
                  </h3>
                  <div className="text-sm text-gray-500">
                    Confidence: {Math.round(v.mismatchAnalysis.confidence * 100)}% • {v.mismatchAnalysis.reason}
                  </div>
                  {v.wtd.trims.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Trims: {v.wtd.trims.slice(0, 5).join(", ")}{v.wtd.trims.length > 5 ? "..." : ""}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDecision(key, decision === "approve" ? null : "approve")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      decision === "approve"
                        ? "bg-green-600 text-white"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setDecision(key, decision === "ignore" ? null : "ignore")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      decision === "ignore"
                        ? "bg-gray-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    ✗ Ignore
                  </button>
                  <button
                    onClick={() => setDecision(key, decision === "manual_review" ? null : "manual_review")}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      decision === "manual_review"
                        ? "bg-yellow-600 text-white"
                        : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    }`}
                  >
                    ⚠ Review
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700 mb-1">WTD Sizes ({v.wtd.sizes.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {v.wtd.sizes.map((s, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                        {s}
                      </span>
                    ))}
                    {v.wtd.sizes.length === 0 && (
                      <span className="text-gray-400 italic">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 mb-1">USAF Sizes ({v.usaf.sizes.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {v.usaf.sizes.map((s, i) => (
                      <span key={i} className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                        {s}
                      </span>
                    ))}
                    {v.usaf.sizes.length === 0 && (
                      <span className="text-gray-400 italic">None</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Missing from WTD (potential enrichment) */}
              {v.normalizedComparison.usafOnly.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="font-medium text-green-700 mb-1">
                    ➕ Missing from WTD (add these)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.normalizedComparison.usafOnly.map((s, i) => (
                      <span key={i} className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extra in WTD (potential bad data) */}
              {v.normalizedComparison.wtdOnly.length > 0 && v.usaf.sizes.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="font-medium text-red-700 mb-1">
                    ⚠️ Extra in WTD (not in USAF)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {v.normalizedComparison.wtdOnly.map((s, i) => (
                      <span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Staggered pairs */}
              {v.staggeredPairs.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="font-medium text-orange-700 mb-1">
                    🔀 Inferred Staggered Pairs
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.staggeredPairs.map((p, i) => (
                      <span key={i} className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
                        Front: {p.front} → Rear: {p.rear} ({Math.round(p.confidence * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {getActiveVehicles().length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No vehicles in this category
          </div>
        )}
      </div>

      {/* File info */}
      <div className="mt-8 text-sm text-gray-400">
        File: {data.filename} • Generated: {new Date(data.timestamp).toLocaleString()}
        {data.filters && Object.keys(data.filters).length > 0 && (
          <span> • Filters: {JSON.stringify(data.filters)}</span>
        )}
      </div>
    </div>
  );
}
