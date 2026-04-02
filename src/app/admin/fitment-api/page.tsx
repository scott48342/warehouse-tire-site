"use client";

import { useState, useEffect, useCallback } from "react";

export const runtime = "nodejs";

type Tab = "requests" | "keys" | "customers" | "usage";

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  company: string;
  website: string | null;
  use_case: string;
  use_case_details: string | null;
  expected_usage: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  email: string;
  company: string | null;
  plan: string;
  monthly_limit: number;
  request_count: number;
  monthly_request_count: number;
  last_request_at: string | null;
  first_call_at: string | null;
  active: boolean;
  suspended_at: string | null;
  suspend_reason: string | null;
  created_at: string;
}

interface Customer {
  email: string;
  name: string;
  company: string | null;
  plan: string | null;
  total_requests: number;
  keys_count: number;
  requests_count: number;
  first_request_at: string | null;
  last_activity_at: string | null;
}

interface UsageStats {
  total_keys: number;
  active_keys: number;
  total_requests_today: number;
  total_requests_month: number;
  pending_requests: number;
  recent_activity: Array<{
    id: string;
    key_prefix: string;
    endpoint: string;
    status_code: number;
    response_time_ms: number;
    created_at: string;
  }>;
  top_endpoints: Array<{
    endpoint: string;
    count: number;
  }>;
}

export default function FitmentApiAdminPage() {
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("starter");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/admin/fitment-api?tab=${tab}`);
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      
      if (tab === "requests") setRequests(data.requests || []);
      else if (tab === "keys") setKeys(data.keys || []);
      else if (tab === "customers") setCustomers(data.customers || []);
      else if (tab === "usage") setUsage(data.usage || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (action: string, payload: Record<string, any>) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/fitment-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      
      // Show success message if key was generated
      if (data.apiKey) {
        alert(`API Key Generated!\n\nKey: ${data.apiKey}\n\nThis will only be shown once. Make sure to copy it.`);
      }
      
      // Refresh data
      await fetchData();
      setSelectedRequest(null);
      setSelectedKey(null);
      setInternalNotes("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Fitment API Management</h1>
        <p className="text-neutral-400 mt-1">Manage API access requests, keys, and monitor usage</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-700 pb-2">
        {[
          { id: "requests", label: "Access Requests", badge: pendingCount > 0 ? pendingCount : undefined },
          { id: "keys", label: "API Keys" },
          { id: "customers", label: "Customers" },
          { id: "usage", label: "Usage & Flags" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors relative ${
              tab === t.id
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            {t.label}
            {t.badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-neutral-400">Loading...</div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {tab === "requests" && (
            <RequestsTab
              requests={requests}
              onSelect={(r) => {
                setSelectedRequest(r);
                setInternalNotes(r.review_notes || "");
                setSelectedPlan("starter");
              }}
            />
          )}
          {tab === "keys" && (
            <KeysTab
              keys={keys}
              onSelect={setSelectedKey}
              onAction={handleAction}
            />
          )}
          {tab === "customers" && <CustomersTab customers={customers} />}
          {tab === "usage" && <UsageTab usage={usage} />}
        </>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <Modal onClose={() => setSelectedRequest(null)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Request Details</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name" value={selectedRequest.name} />
              <Field label="Email" value={selectedRequest.email} />
              <Field label="Company" value={selectedRequest.company} />
              <Field label="Website" value={selectedRequest.website || "—"} />
              <Field label="Use Case" value={formatUseCase(selectedRequest.use_case)} />
              <Field label="Expected Usage" value={selectedRequest.expected_usage || "—"} />
              <Field label="Status" value={<StatusBadge status={selectedRequest.status} />} />
              <Field label="Submitted" value={formatDate(selectedRequest.created_at)} />
            </div>
            
            {selectedRequest.use_case_details && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Use Case Details</div>
                <div className="bg-neutral-700 rounded-lg p-3 text-sm text-white">
                  {selectedRequest.use_case_details}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Internal Notes</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="w-full h-24 bg-neutral-700 border border-neutral-600 rounded-lg p-3 text-white text-sm resize-none"
                placeholder="Add internal notes..."
              />
            </div>

            {selectedRequest.status === "pending" && (
              <>
                <div>
                  <label className="text-xs text-neutral-400 mb-1 block">Plan/Tier</label>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="w-full h-10 bg-neutral-700 border border-neutral-600 rounded-lg px-3 text-white text-sm"
                  >
                    <option value="starter">Starter (10k/mo)</option>
                    <option value="growth">Growth (50k/mo)</option>
                    <option value="pro">Pro (200k/mo)</option>
                    <option value="enterprise">Enterprise (Custom)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleAction("approve", { 
                      requestId: selectedRequest.id, 
                      plan: selectedPlan,
                      notes: internalNotes 
                    })}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "✓ Approve & Generate Key"}
                  </button>
                  <button
                    onClick={() => handleAction("reject", { 
                      requestId: selectedRequest.id,
                      notes: internalNotes 
                    })}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "✗ Reject"}
                  </button>
                </div>
              </>
            )}

            {selectedRequest.status !== "pending" && (
              <div className="bg-neutral-700/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400">
                  {selectedRequest.status === "approved" ? "Approved" : "Rejected"} by {selectedRequest.reviewed_by || "Admin"} on {formatDate(selectedRequest.reviewed_at)}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Key Detail Modal */}
      {selectedKey && (
        <Modal onClose={() => setSelectedKey(null)}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">API Key Details</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <Field label="Key" value={<code className="text-blue-400">{selectedKey.key_prefix}...</code>} />
              <Field label="Status" value={selectedKey.active ? <span className="text-green-400">Active</span> : <span className="text-red-400">Disabled</span>} />
              <Field label="Owner" value={selectedKey.name} />
              <Field label="Email" value={selectedKey.email} />
              <Field label="Company" value={selectedKey.company || "—"} />
              <Field label="Plan" value={<PlanBadge plan={selectedKey.plan} />} />
              <Field label="Monthly Limit" value={selectedKey.monthly_limit.toLocaleString()} />
              <Field label="This Month" value={selectedKey.monthly_request_count.toLocaleString()} />
              <Field label="Total Requests" value={selectedKey.request_count.toLocaleString()} />
              <Field label="Last Used" value={selectedKey.last_request_at ? formatDate(selectedKey.last_request_at) : "Never"} />
              <Field label="Created" value={formatDate(selectedKey.created_at)} />
              <Field label="First Call" value={selectedKey.first_call_at ? formatDate(selectedKey.first_call_at) : "—"} />
            </div>

            {selectedKey.suspend_reason && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                <div className="text-xs text-red-400 mb-1">Suspension Reason</div>
                <div className="text-sm text-white">{selectedKey.suspend_reason}</div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {selectedKey.active ? (
                <button
                  onClick={() => {
                    const reason = prompt("Reason for disabling (optional):");
                    handleAction("disable_key", { keyId: selectedKey.id, reason });
                  }}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  Disable Key
                </button>
              ) : (
                <button
                  onClick={() => handleAction("enable_key", { keyId: selectedKey.id })}
                  disabled={actionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  Reactivate Key
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm("Generate a new key? The old key will stop working immediately.")) {
                    handleAction("regenerate_key", { keyId: selectedKey.id });
                  }
                }}
                disabled={actionLoading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50"
              >
                Regenerate Key
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

function RequestsTab({ 
  requests, 
  onSelect 
}: { 
  requests: AccessRequest[]; 
  onSelect: (r: AccessRequest) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  
  const filtered = requests.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {["all", "pending", "approved", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? "bg-neutral-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && requests.filter(r => r.status === "pending").length > 0 && (
              <span className="ml-1 text-red-400">
                ({requests.filter(r => r.status === "pending").length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Use Case</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Expected</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No requests found
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-700/30">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{r.name}</div>
                    <div className="text-xs text-neutral-400">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{r.company}</td>
                  <td className="px-4 py-3 text-neutral-300">{formatUseCase(r.use_case)}</td>
                  <td className="px-4 py-3 text-neutral-300">{r.expected_usage || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-neutral-400 text-sm">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onSelect(r)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeysTab({ 
  keys, 
  onSelect,
  onAction,
}: { 
  keys: ApiKey[];
  onSelect: (k: ApiKey) => void;
  onAction: (action: string, payload: Record<string, any>) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "disabled">("all");
  
  const filtered = keys.filter(k => {
    if (filter === "active") return k.active;
    if (filter === "disabled") return !k.active;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Keys" value={keys.length} />
        <StatCard label="Active" value={keys.filter(k => k.active).length} color="green" />
        <StatCard label="Disabled" value={keys.filter(k => !k.active).length} color="red" />
        <StatCard label="This Month" value={keys.reduce((sum, k) => sum + k.monthly_request_count, 0).toLocaleString()} />
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "active", "disabled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as typeof filter)}
            className={`px-3 py-1 rounded text-sm ${
              filter === f
                ? "bg-neutral-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Key</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Usage (Month)</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Last Used</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                  No API keys found
                </td>
              </tr>
            ) : (
              filtered.map((k) => (
                <tr key={k.id} className="hover:bg-neutral-700/30">
                  <td className="px-4 py-3">
                    <code className="text-blue-400 text-sm">{k.key_prefix}...</code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white">{k.name}</div>
                    <div className="text-xs text-neutral-400">{k.company || k.email}</div>
                  </td>
                  <td className="px-4 py-3"><PlanBadge plan={k.plan} /></td>
                  <td className="px-4 py-3">
                    <div className="text-white">{k.monthly_request_count.toLocaleString()}</div>
                    <div className="text-xs text-neutral-400">/ {k.monthly_limit.toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-400 text-sm">
                    {k.last_request_at ? formatDate(k.last_request_at) : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    {k.active ? (
                      <span className="text-green-400 text-sm">Active</span>
                    ) : (
                      <span className="text-red-400 text-sm">Disabled</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onSelect(k)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Manage →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTab({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-4">
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700/50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Keys</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Total Requests</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-neutral-400 uppercase">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No customers yet
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.email} className="hover:bg-neutral-700/30">
                  <td className="px-4 py-3">
                    <div className="text-white">{c.name}</div>
                    <div className="text-xs text-neutral-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{c.company || "—"}</td>
                  <td className="px-4 py-3">{c.plan ? <PlanBadge plan={c.plan} /> : "—"}</td>
                  <td className="px-4 py-3 text-white">{c.keys_count}</td>
                  <td className="px-4 py-3 text-white">{c.total_requests.toLocaleString()}</td>
                  <td className="px-4 py-3 text-neutral-400 text-sm">
                    {c.last_activity_at ? formatDate(c.last_activity_at) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsageTab({ usage }: { usage: UsageStats | null }) {
  if (!usage) return <div className="text-neutral-500">No usage data</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Keys" value={usage.total_keys} />
        <StatCard label="Active Keys" value={usage.active_keys} color="green" />
        <StatCard label="Requests Today" value={usage.total_requests_today.toLocaleString()} />
        <StatCard label="Requests This Month" value={usage.total_requests_month.toLocaleString()} />
        <StatCard label="Pending Requests" value={usage.pending_requests} color={usage.pending_requests > 0 ? "amber" : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Endpoints */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4">
          <h3 className="text-lg font-bold text-white mb-4">Top Endpoints (24h)</h3>
          {usage.top_endpoints.length === 0 ? (
            <div className="text-neutral-500 text-sm">No activity</div>
          ) : (
            <div className="space-y-2">
              {usage.top_endpoints.map((e, i) => (
                <div key={i} className="flex items-center justify-between">
                  <code className="text-sm text-blue-400">{e.endpoint}</code>
                  <span className="text-white font-medium">{e.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4">
          <h3 className="text-lg font-bold text-white mb-4">Recent Activity</h3>
          {usage.recent_activity.length === 0 ? (
            <div className="text-neutral-500 text-sm">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {usage.recent_activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <code className="text-neutral-400">{a.key_prefix}...</code>
                    <span className="text-neutral-300">{a.endpoint}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={a.status_code < 400 ? "text-green-400" : "text-red-400"}>
                      {a.status_code}
                    </span>
                    <span className="text-neutral-500">{a.response_time_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{label}</div>
      <div className="text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded border text-xs font-medium ${colors[status] || "bg-neutral-700 text-neutral-300"}`}>
      {status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    starter: "bg-neutral-600 text-neutral-200",
    growth: "bg-blue-500/20 text-blue-400",
    pro: "bg-purple-500/20 text-purple-400",
    enterprise: "bg-amber-500/20 text-amber-400",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[plan] || "bg-neutral-600 text-neutral-200"}`}>
      {plan}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: "green" | "red" | "amber" }) {
  const colorClasses = {
    green: "text-green-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };
  
  return (
    <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color ? colorClasses[color] : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUseCase(useCase: string): string {
  const labels: Record<string, string> = {
    ecommerce: "Ecommerce",
    marketplace: "Marketplace",
    dealership: "Dealership",
    developer: "Developer",
    other: "Other",
  };
  return labels[useCase] || useCase;
}
