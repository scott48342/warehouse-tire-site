"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AbandonedCart {
  id: string;
  cartId: string;
  customer: string | null;
  email: string | null;
  phone: string | null;
  vehicle: string | null;
  itemCount: number;
  value: number;
  status: "active" | "abandoned" | "recovered" | "expired";
  recoveredOrderId: string | null;
  createdAt: string;
  lastActivityAt: string;
  abandonedAt: string | null;
  recoveredAt: string | null;
  // Email tracking
  firstEmailSentAt: string | null;
  secondEmailSentAt: string | null;
  emailSentCount: number;
  recoveredAfterEmail: boolean;
}

interface Stats {
  active: number;
  abandoned: number;
  recovered: number;
  expired: number;
  abandonedValue: number;
  recoveredValue: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  active: { label: "Active", color: "text-green-400", bgColor: "bg-green-900/50" },
  abandoned: { label: "Abandoned", color: "text-yellow-400", bgColor: "bg-yellow-900/50" },
  recovered: { label: "Recovered", color: "text-blue-400", bgColor: "bg-blue-900/50" },
  expired: { label: "Expired", color: "text-neutral-400", bgColor: "bg-neutral-700" },
};

function StatCard({ 
  title, 
  value, 
  subValue,
  icon,
  color = "neutral"
}: { 
  title: string; 
  value: number | string; 
  subValue?: string;
  icon: string;
  color?: "green" | "yellow" | "blue" | "red" | "neutral";
}) {
  const colorClasses = {
    green: "border-green-700 bg-green-900/30",
    yellow: "border-yellow-700 bg-yellow-900/30",
    blue: "border-blue-700 bg-blue-900/30",
    red: "border-red-700 bg-red-900/30",
    neutral: "border-neutral-700 bg-neutral-800",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-neutral-400">{title}</div>
          <div className="mt-1 text-2xl font-bold text-white">{value}</div>
          {subValue && <div className="mt-0.5 text-xs text-neutral-500">{subValue}</div>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [processing, setProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        stats: "1",
        limit: "100",
      });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const res = await fetch(`/api/admin/abandoned-carts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setCarts(data.carts || []);
      setStats(data.stats || null);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProcessAbandoned = async () => {
    try {
      setProcessing(true);
      const res = await fetch("/api/admin/abandoned-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Processed: ${data.abandonedCount} carts marked as abandoned`);
        fetchData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleTestAbandon = async (cartId: string) => {
    if (!confirm("Mark this cart as abandoned for testing?")) return;
    
    try {
      const res = await fetch("/api/admin/abandoned-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-abandon", cartId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleSendTestEmail = async (cartId: string) => {
    if (!confirm("Send recovery email to this cart?")) return;
    
    try {
      const res = await fetch("/api/admin/abandoned-carts/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", cartId }),
      });
      const data = await res.json();
      if (data.success) {
        const action = data.result?.action || "processed";
        alert(`Email ${action}${data.safeMode ? " (SAFE MODE - logged only)" : ""}`);
        fetchData();
      } else {
        alert(`Error: ${data.error || data.result?.reason || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleProcessEmails = async () => {
    if (!confirm("Process all pending abandoned cart emails?")) return;
    
    try {
      setProcessing(true);
      const res = await fetch("/api/admin/abandoned-carts/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.safeMode
          ? `Safe Mode: ${data.logged} emails logged (not sent)`
          : `Sent: ${data.sent}, Skipped: ${data.skipped}`;
        alert(`Processed ${data.processed} carts. ${msg}`);
        fetchData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🛒</span>
            Abandoned Carts
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Track and recover abandoned shopping carts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleProcessEmails}
            disabled={processing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {processing ? "Processing..." : "📧 Process Emails"}
          </button>
          <button
            onClick={handleProcessAbandoned}
            disabled={processing}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {processing ? "Processing..." : "Process Abandoned"}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300">
          Error: {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Active Carts"
            value={stats.active}
            icon="🟢"
            color="green"
          />
          <StatCard
            title="Abandoned"
            value={stats.abandoned}
            icon="⚠️"
            color="yellow"
          />
          <StatCard
            title="Recovered"
            value={stats.recovered}
            icon="✅"
            color="blue"
          />
          <StatCard
            title="Expired"
            value={stats.expired}
            icon="⏰"
            color="neutral"
          />
          <StatCard
            title="Abandoned Value"
            value={formatCurrency(stats.abandonedValue)}
            icon="💰"
            color="yellow"
          />
          <StatCard
            title="Recovered Revenue"
            value={formatCurrency(stats.recoveredValue)}
            icon="💵"
            color="blue"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm text-neutral-400">Filter by status:</span>
        <div className="flex gap-2">
          {["all", "active", "abandoned", "recovered", "expired"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === status
                  ? "bg-red-600 text-white"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Carts Table */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
        {loading && !carts.length ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : carts.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No carts found
            <div className="text-xs mt-2">
              Carts are tracked when users add items and visit checkout
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900/50">
                <tr className="text-left text-neutral-400 border-b border-neutral-700">
                  <th className="px-4 py-3 font-medium">Cart ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium text-center">Items</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Activity</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => {
                  const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.active;
                  return (
                    <tr key={cart.id} className="border-b border-neutral-700/50 hover:bg-neutral-700/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-neutral-400">
                          {cart.cartId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {cart.customer || cart.email ? (
                          <div>
                            <div className="text-white">{cart.customer || "Unknown"}</div>
                            {cart.email && (
                              <div className="text-xs text-neutral-500">{cart.email}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-500">Anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cart.vehicle ? (
                          <span className="text-neutral-300">{cart.vehicle}</span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-neutral-700 px-2 py-0.5 rounded text-neutral-300">
                          {cart.itemCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-white">
                          {formatCurrency(cart.value)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {cart.recoveredOrderId && (
                          <div className="text-xs text-blue-400 mt-1">
                            Order: {cart.recoveredOrderId.slice(0, 8)}...
                          </div>
                        )}
                        {cart.recoveredAfterEmail && (
                          <div className="text-xs text-green-400 mt-1">
                            ✉️ Recovered via email
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-neutral-300">{formatTimeAgo(cart.lastActivityAt)}</div>
                        {cart.abandonedAt && (
                          <div className="text-xs text-yellow-500">
                            Abandoned {formatTimeAgo(cart.abandonedAt)}
                          </div>
                        )}
                        {/* Email status */}
                        {cart.emailSentCount > 0 && (
                          <div className="text-xs text-purple-400 mt-1">
                            📧 {cart.emailSentCount} email{cart.emailSentCount > 1 ? "s" : ""} sent
                            {cart.firstEmailSentAt && (
                              <span className="text-neutral-500"> • {formatTimeAgo(cart.firstEmailSentAt)}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {cart.status === "active" && (
                            <button
                              onClick={() => handleTestAbandon(cart.cartId)}
                              className="text-xs text-yellow-400 hover:text-yellow-300"
                              title="Test: Mark as abandoned"
                            >
                              Test Abandon
                            </button>
                          )}
                          {cart.status === "abandoned" && cart.email && cart.emailSentCount === 0 && (
                            <button
                              onClick={() => handleSendTestEmail(cart.cartId)}
                              className="text-xs text-purple-400 hover:text-purple-300"
                              title="Send recovery email"
                            >
                              Send Email
                            </button>
                          )}
                          {cart.recoveredOrderId && (
                            <Link
                              href={`/admin/orders/${cart.recoveredOrderId}`}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              View Order
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-4 text-center text-xs text-neutral-500">
        Carts become abandoned after 1 hour of inactivity • Expired after 30 days
      </div>
    </div>
  );
}
