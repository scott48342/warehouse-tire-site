"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ============================================================================
// Types
// ============================================================================

interface TrimMapping {
  id: string;
  year: number;
  make: string;
  model: string;
  ourTrim: string;
  ourModificationId: string | null;
  vehicleFitmentId: string | null;
  wsSlug: string;
  wsGeneration: string | null;
  wsModificationName: string | null;
  wsTrim: string | null;
  wsEngine: string | null;
  wsBody: string | null;
  matchMethod: string;
  matchConfidence: string;
  matchScore: string | null;
  configCount: number;
  hasSingleConfig: boolean;
  defaultConfigId: string | null;
  defaultWheelDiameter: number | null;
  defaultTireSize: string | null;
  allWheelDiameters: number[];
  allTireSizes: string[];
  needsReview: boolean;
  reviewReason: string | null;
  reviewPriority: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  warnings: string[];
}

interface ApiResponse {
  mappings: TrimMapping[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    byStatus: Record<string, number>;
    byConfidence: Record<string, number>;
    needsReview: number;
  };
}

// ============================================================================
// Component
// ============================================================================

export function TrimMappingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Filters from URL
  const status = searchParams.get("status") || "";
  const confidence = searchParams.get("confidence") || "";
  const needsReview = searchParams.get("needsReview") === "true";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  
  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (confidence) params.set("confidence", confidence);
      if (needsReview) params.set("needsReview", "true");
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "50");
      
      const res = await fetch(`/api/admin/fitment/trim-mappings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [status, confidence, needsReview, search, page]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Update URL params
  const updateFilters = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    params.delete("page"); // Reset page on filter change
    router.push(`?${params.toString()}`);
  };
  
  // Actions
  const handleAction = async (action: string, id: string, extraData?: Record<string, string>) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/fitment/trim-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          reviewedBy: "admin", // TODO: Get from auth
          ...extraData,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }
      
      // Refresh data
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };
  
  // Render
  if (loading && !data) {
    return <div className="text-center py-12 text-neutral-500">Loading...</div>;
  }
  
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-700">
        Error: {error}
        <button onClick={fetchData} className="ml-4 underline">Retry</button>
      </div>
    );
  }
  
  if (!data) return null;
  
  const { mappings, pagination, stats } = data;
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Needs Review"
          value={stats.needsReview}
          color="amber"
          onClick={() => updateFilters({ needsReview: "true", status: null })}
          active={needsReview}
        />
        <StatCard
          label="Pending"
          value={stats.byStatus.pending || 0}
          color="blue"
          onClick={() => updateFilters({ status: "pending", needsReview: null })}
          active={status === "pending"}
        />
        <StatCard
          label="Approved"
          value={stats.byStatus.approved || 0}
          color="green"
          onClick={() => updateFilters({ status: "approved", needsReview: null })}
          active={status === "approved"}
        />
        <StatCard
          label="Rejected"
          value={stats.byStatus.rejected || 0}
          color="red"
          onClick={() => updateFilters({ status: "rejected", needsReview: null })}
          active={status === "rejected"}
        />
        <StatCard
          label="Low Confidence"
          value={stats.byConfidence.low || 0}
          color="orange"
          onClick={() => updateFilters({ confidence: "low", status: null, needsReview: null })}
          active={confidence === "low"}
        />
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <input
          type="text"
          placeholder="Search make, model, trim..."
          value={search}
          onChange={(e) => updateFilters({ search: e.target.value || null })}
          className="flex-1 min-w-[200px] rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        
        <select
          value={status}
          onChange={(e) => updateFilters({ status: e.target.value || null })}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="needs_manual">Needs Manual</option>
        </select>
        
        <select
          value={confidence}
          onChange={(e) => updateFilters({ confidence: e.target.value || null })}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">All Confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        
        <button
          onClick={() => router.push("/admin/fitment/trim-mappings")}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Clear Filters
        </button>
      </div>
      
      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Our Trim</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">WS Match</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Confidence</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Configs</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {mappings.map((m) => (
                <MappingRow
                  key={m.id}
                  mapping={m}
                  expanded={expandedId === m.id}
                  onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  onAction={handleAction}
                  actionLoading={actionLoading === m.id}
                />
              ))}
              {mappings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    No mappings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page - 1));
                router.push(`?${params.toString()}`);
              }}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("page", String(pagination.page + 1));
                router.push(`?${params.toString()}`);
              }}
              className="rounded-md border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: "amber" | "blue" | "green" | "red" | "orange";
  onClick: () => void;
  active: boolean;
}) {
  const colors = {
    amber: "border-amber-300 bg-amber-50 text-amber-700",
    blue: "border-blue-300 bg-blue-50 text-blue-700",
    green: "border-green-300 bg-green-50 text-green-700",
    red: "border-red-300 bg-red-50 text-red-700",
    orange: "border-orange-300 bg-orange-50 text-orange-700",
  };
  
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-all ${colors[color]} ${active ? "ring-2 ring-offset-2 ring-current" : "hover:opacity-80"}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide">{label}</p>
    </button>
  );
}

function MappingRow({
  mapping,
  expanded,
  onToggle,
  onAction,
  actionLoading,
}: {
  mapping: TrimMapping;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: string, id: string, extra?: Record<string, string>) => void;
  actionLoading: boolean;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  
  const confidenceColors = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-red-100 text-red-700",
  };
  
  const statusColors = {
    pending: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    needs_manual: "bg-amber-100 text-amber-700",
  };
  
  return (
    <>
      <tr className={`hover:bg-neutral-50 ${expanded ? "bg-neutral-50" : ""}`}>
        {/* Vehicle */}
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-left">
            <span className="font-medium">{mapping.year} {mapping.make}</span>
            <br />
            <span className="text-sm text-neutral-600">{mapping.model}</span>
          </button>
        </td>
        
        {/* Our Trim */}
        <td className="px-4 py-3">
          <span className="font-medium">{mapping.ourTrim}</span>
          {mapping.ourModificationId && (
            <span className="block text-xs text-neutral-500">ID: {mapping.ourModificationId}</span>
          )}
        </td>
        
        {/* WS Match */}
        <td className="px-4 py-3">
          <span className="text-sm">{mapping.wsTrim || mapping.wsModificationName || "-"}</span>
          {mapping.wsEngine && mapping.wsTrim !== mapping.wsEngine && (
            <span className="block text-xs text-neutral-500">{mapping.wsEngine}</span>
          )}
        </td>
        
        {/* Confidence */}
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${confidenceColors[mapping.matchConfidence as keyof typeof confidenceColors] || "bg-neutral-100"}`}>
            {mapping.matchConfidence}
          </span>
          <span className="block text-xs text-neutral-500">{mapping.matchMethod}</span>
        </td>
        
        {/* Configs */}
        <td className="px-4 py-3">
          <span className="font-medium">{mapping.configCount || 0}</span>
          {mapping.hasSingleConfig && (
            <span className="ml-1 text-xs text-green-600">✓ auto</span>
          )}
          {mapping.allWheelDiameters?.length > 0 && (
            <span className="block text-xs text-neutral-500">
              {(mapping.allWheelDiameters as number[]).join(", ")}"
            </span>
          )}
        </td>
        
        {/* Status */}
        <td className="px-4 py-3">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[mapping.status as keyof typeof statusColors] || "bg-neutral-100"}`}>
            {mapping.status}
          </span>
          {mapping.needsReview && (
            <span className="ml-1 text-amber-500">⚠️</span>
          )}
        </td>
        
        {/* Actions */}
        <td className="px-4 py-3">
          <div className="flex gap-2">
            {mapping.status !== "approved" && (
              <button
                onClick={() => onAction("approve", mapping.id)}
                disabled={actionLoading}
                className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600 disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {mapping.status !== "rejected" && (
              <button
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={actionLoading}
                className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            <button
              onClick={onToggle}
              className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          </div>
        </td>
      </tr>
      
      {/* Expanded Details */}
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-neutral-50 px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {/* Warnings */}
              {mapping.warnings.length > 0 && (
                <div className="col-span-full rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <h4 className="font-semibold text-amber-800">⚠️ Warnings</h4>
                  <ul className="mt-1 space-y-1 text-amber-700">
                    {mapping.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* WS Details */}
              <div>
                <h4 className="font-semibold text-neutral-700">Wheel-Size Match</h4>
                <dl className="mt-1 space-y-1">
                  <div><dt className="inline text-neutral-500">Slug:</dt> <dd className="inline">{mapping.wsSlug}</dd></div>
                  <div><dt className="inline text-neutral-500">Generation:</dt> <dd className="inline">{mapping.wsGeneration || "-"}</dd></div>
                  <div><dt className="inline text-neutral-500">Body:</dt> <dd className="inline">{mapping.wsBody || "-"}</dd></div>
                  <div><dt className="inline text-neutral-500">Score:</dt> <dd className="inline">{mapping.matchScore || "-"}</dd></div>
                </dl>
              </div>
              
              {/* Config Details */}
              <div>
                <h4 className="font-semibold text-neutral-700">Configurations</h4>
                <dl className="mt-1 space-y-1">
                  <div><dt className="inline text-neutral-500">Count:</dt> <dd className="inline">{mapping.configCount}</dd></div>
                  <div><dt className="inline text-neutral-500">Auto-select:</dt> <dd className="inline">{mapping.hasSingleConfig ? "Yes" : "No"}</dd></div>
                  <div><dt className="inline text-neutral-500">Default:</dt> <dd className="inline">{mapping.defaultWheelDiameter}" / {mapping.defaultTireSize || "-"}</dd></div>
                  <div><dt className="inline text-neutral-500">All Sizes:</dt> <dd className="inline">{(mapping.allTireSizes as string[])?.join(", ") || "-"}</dd></div>
                </dl>
              </div>
              
              {/* Review Details */}
              <div>
                <h4 className="font-semibold text-neutral-700">Review</h4>
                <dl className="mt-1 space-y-1">
                  <div><dt className="inline text-neutral-500">By:</dt> <dd className="inline">{mapping.reviewedBy || "-"}</dd></div>
                  <div><dt className="inline text-neutral-500">At:</dt> <dd className="inline">{mapping.reviewedAt ? new Date(mapping.reviewedAt).toLocaleDateString() : "-"}</dd></div>
                  <div><dt className="inline text-neutral-500">Reason:</dt> <dd className="inline">{mapping.reviewReason || "-"}</dd></div>
                </dl>
              </div>
              
              {/* Notes */}
              <div>
                <h4 className="font-semibold text-neutral-700">Notes</h4>
                <p className="mt-1 text-neutral-600">{mapping.reviewNotes || "No notes"}</p>
              </div>
            </div>
            
            {/* Reject Form */}
            {showRejectForm && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <h4 className="font-semibold text-red-800">Reject Mapping</h4>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (required)"
                  className="mt-2 w-full rounded border border-red-300 p-2 text-sm"
                  rows={2}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      if (!rejectReason.trim()) {
                        alert("Rejection reason is required");
                        return;
                      }
                      onAction("reject", mapping.id, { reason: rejectReason });
                      setShowRejectForm(false);
                      setRejectReason("");
                    }}
                    disabled={actionLoading || !rejectReason.trim()}
                    className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Reject
                  </button>
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectReason("");
                    }}
                    className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
