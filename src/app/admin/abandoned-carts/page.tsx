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
  // Test data
  isTest: boolean;
  testReason: string | null;
  // Product types
  cartType: "package" | "wheels" | "tires" | "accessories" | "mixed" | "empty";
  hasWheels: boolean;
  hasTires: boolean;
  hasAccessories: boolean;
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

const CART_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  package: { label: "Package", icon: "📦", color: "text-purple-300", bgColor: "bg-purple-900/50" },
  wheels: { label: "Wheels", icon: "🛞", color: "text-blue-300", bgColor: "bg-blue-900/50" },
  tires: { label: "Tires", icon: "⭕", color: "text-green-300", bgColor: "bg-green-900/50" },
  accessories: { label: "Acc", icon: "🔧", color: "text-neutral-300", bgColor: "bg-neutral-700" },
  mixed: { label: "Mixed", icon: "🛒", color: "text-neutral-300", bgColor: "bg-neutral-700" },
  empty: { label: "Empty", icon: "❌", color: "text-neutral-500", bgColor: "bg-neutral-800" },
};

// ============================================================================
// Triage Badge Components
// ============================================================================

function ValueBadge({ value }: { value: number }) {
  if (value >= 1000) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-900/50 text-green-300 border border-green-700">
        💰 ${Math.round(value / 1000)}K+
      </span>
    );
  }
  if (value >= 500) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-900/30 text-emerald-400">
        $500+
      </span>
    );
  }
  return null;
}

function EmailBadge({ hasEmail }: { hasEmail: boolean }) {
  if (hasEmail) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-900/30 text-blue-400" title="Email captured">
        ✉️
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-neutral-500" title="No email">
      👤
    </span>
  );
}

function RecencyBadge({ lastActivityAt }: { lastActivityAt: string }) {
  const now = new Date();
  const lastActivity = new Date(lastActivityAt);
  const diffHours = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
  
  if (diffHours < 1) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-900/50 text-red-300 animate-pulse" title="Active now">
        🔴 NOW
      </span>
    );
  }
  if (diffHours < 24) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/30 text-amber-400" title="Last 24h">
        🟡 24H
      </span>
    );
  }
  return null;
}

function CartTypeBadge({ cartType }: { cartType: string }) {
  const config = CART_TYPE_CONFIG[cartType] || CART_TYPE_CONFIG.mixed;
  return (
    <span 
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.bgColor} ${config.color}`}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}

function TestBadge({ isTest, testReason }: { isTest: boolean; testReason: string | null }) {
  if (!isTest) return null;
  return (
    <span 
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-900/50 text-orange-400 border border-orange-700"
      title={testReason || "Test data"}
    >
      🧪
    </span>
  );
}

function TriageBadges({ cart }: { cart: AbandonedCart }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <TestBadge isTest={cart.isTest} testReason={cart.testReason} />
      <ValueBadge value={cart.value} />
      <EmailBadge hasEmail={Boolean(cart.email)} />
      <RecencyBadge lastActivityAt={cart.lastActivityAt} />
      <CartTypeBadge cartType={cart.cartType} />
    </div>
  );
}

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

  // =========================================================================
  // Quick Actions
  // =========================================================================

  const handleCopyRecoveryLink = async (cartId: string) => {
    const link = `https://shop.warehousetiredirect.com/cart/recover/${cartId}`;
    try {
      await navigator.clipboard.writeText(link);
      // Show brief confirmation
      const btn = document.querySelector(`[data-copy-link="${cartId}"]`);
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "✓ Copied!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      }
    } catch {
      // Fallback for older browsers
      prompt("Recovery Link:", link);
    }
  };

  const handleCopyCartSummary = async (cart: AbandonedCart) => {
    const lines: string[] = [];
    lines.push(`Cart ID: ${cart.cartId}`);
    lines.push(`Status: ${cart.status}`);
    lines.push(`Value: ${formatCurrency(cart.value)}`);
    lines.push(`Items: ${cart.itemCount}`);
    if (cart.customer || cart.email) {
      lines.push(`Customer: ${cart.customer || cart.email}`);
    }
    if (cart.vehicle) {
      lines.push(`Vehicle: ${cart.vehicle}`);
    }
    lines.push(`Last Activity: ${formatTimeAgo(cart.lastActivityAt)}`);
    lines.push(`Recovery Link: https://shop.warehousetiredirect.com/cart/recover/${cart.cartId}`);

    const summary = lines.join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      const btn = document.querySelector(`[data-copy-summary="${cart.cartId}"]`);
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "✓ Copied!";
        setTimeout(() => { btn.textContent = original; }, 1500);
      }
    } catch {
      prompt("Cart Summary:", summary);
    }
  };

  const handleQuickSendEmail = async (cartId: string, email: string) => {
    if (!confirm(`Send recovery email to ${email}?`)) return;
    
    try {
      const res = await fetch("/api/admin/abandoned-carts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-email", cartId }),
      });
      const data = await res.json();
      if (data.success) {
        const action = data.result?.action || "sent";
        alert(data.safeMode 
          ? `📝 Logged (safe mode): ${email}` 
          : `✅ Email ${action} to ${email}`);
        fetchData();
      } else {
        alert(`❌ Failed: ${data.error || data.result?.reason || "Unknown error"}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert(`Error: ${msg}`);
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
                  <th className="px-3 py-3 font-medium">Triage</th>
                  <th className="px-3 py-3 font-medium text-right">Value</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Vehicle</th>
                  <th className="px-3 py-3 font-medium text-center">Contents</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Activity</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => {
                  const statusConfig = STATUS_CONFIG[cart.status] || STATUS_CONFIG.active;
                  return (
                    <tr key={cart.id} className={`border-b border-neutral-700/50 hover:bg-neutral-700/30 ${cart.isTest ? "opacity-60" : ""}`}>
                      {/* Triage badges */}
                      <td className="px-3 py-3">
                        <TriageBadges cart={cart} />
                      </td>
                      {/* Value - prominent */}
                      <td className="px-3 py-3 text-right">
                        <span className={`font-bold ${cart.value >= 1000 ? "text-green-400 text-lg" : cart.value >= 500 ? "text-white" : "text-neutral-300"}`}>
                          {formatCurrency(cart.value)}
                        </span>
                      </td>
                      {/* Customer */}
                      <td className="px-3 py-3">
                        {cart.customer || cart.email ? (
                          <div>
                            <div className="text-white text-sm">{cart.customer || "Unknown"}</div>
                            {cart.email && (
                              <div className="text-xs text-neutral-500 truncate max-w-[150px]">{cart.email}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-sm">Anonymous</span>
                        )}
                      </td>
                      {/* Vehicle */}
                      <td className="px-3 py-3">
                        {cart.vehicle ? (
                          <span className="text-neutral-300 text-sm">{cart.vehicle}</span>
                        ) : (
                          <span className="text-neutral-500">-</span>
                        )}
                      </td>
                      {/* Contents */}
                      <td className="px-3 py-3 text-center">
                        <Link 
                          href={`/admin/abandoned-carts/${cart.cartId}`}
                          className="inline-block bg-neutral-700 hover:bg-neutral-600 px-2 py-0.5 rounded text-neutral-300 hover:text-white transition-colors text-xs"
                          title="View cart contents"
                        >
                          {cart.itemCount} →
                        </Link>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                        {cart.recoveredAfterEmail && (
                          <div className="text-[10px] text-green-400 mt-0.5">via email</div>
                        )}
                      </td>
                      {/* Activity */}
                      <td className="px-3 py-3">
                        <div className="text-neutral-300 text-sm">{formatTimeAgo(cart.lastActivityAt)}</div>
                        {cart.emailSentCount > 0 && (
                          <div className="text-[10px] text-purple-400">
                            {cart.emailSentCount}× 📧
                          </div>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {/* Quick action buttons */}
                          <button
                            data-copy-link={cart.cartId}
                            onClick={() => handleCopyRecoveryLink(cart.cartId)}
                            className="px-2 py-1 text-[10px] font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white rounded transition-colors"
                            title="Copy recovery link"
                          >
                            🔗 Link
                          </button>
                          <button
                            data-copy-summary={cart.cartId}
                            onClick={() => handleCopyCartSummary(cart)}
                            className="px-2 py-1 text-[10px] font-medium bg-neutral-700 hover:bg-neutral-600 text-neutral-300 hover:text-white rounded transition-colors"
                            title="Copy cart summary"
                          >
                            📋 Copy
                          </button>
                          {cart.email && cart.status === "abandoned" && (
                            <button
                              onClick={() => handleQuickSendEmail(cart.cartId, cart.email!)}
                              className="px-2 py-1 text-[10px] font-medium bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 hover:text-purple-200 rounded transition-colors"
                              title={`Send recovery email to ${cart.email}`}
                            >
                              ✉️ Email
                            </button>
                          )}
                          <Link
                            href={`/admin/abandoned-carts/${cart.cartId}`}
                            className="px-2 py-1 text-[10px] font-medium bg-blue-900/50 hover:bg-blue-800/50 text-blue-300 hover:text-blue-200 rounded transition-colors"
                            title="View full cart details"
                          >
                            👁️ View
                          </Link>
                          {cart.status === "active" && (
                            <button
                              onClick={() => handleTestAbandon(cart.cartId)}
                              className="px-2 py-1 text-[10px] font-medium bg-yellow-900/50 hover:bg-yellow-800/50 text-yellow-300 hover:text-yellow-200 rounded transition-colors"
                              title="Test: Mark as abandoned"
                            >
                              ⏰ Abandon
                            </button>
                          )}
                          {cart.recoveredOrderId && (
                            <Link
                              href={`/admin/orders/${cart.recoveredOrderId}`}
                              className="px-2 py-1 text-[10px] font-medium bg-green-900/50 hover:bg-green-800/50 text-green-300 hover:text-green-200 rounded transition-colors"
                              title="View recovered order"
                            >
                              ✅ Order
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
