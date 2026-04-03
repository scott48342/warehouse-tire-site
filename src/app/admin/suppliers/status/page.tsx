"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * Supplier Status Dashboard
 * 
 * Source-of-truth view for all supplier health.
 * Shows real-time status, last success/error times, and whether
 * each supplier is actively used in live searches.
 */

interface SupplierStatus {
  id: string;
  canonicalName: string;
  provider: string;
  enabled: boolean;
  credentialsConfigured: boolean;
  credentialSource: "env" | "db" | "none";
  usedInLiveSearch: boolean;
  lastSuccessAt: string | null;
  lastSuccessCount: number | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  recentSearches: number;
  recentResults: number;
  status: "active" | "degraded" | "error" | "disabled" | "unconfigured";
  statusMessage: string;
}

interface StatusResponse {
  ok: boolean;
  timestamp: string;
  summary: {
    total: number;
    active: number;
    degraded: number;
    error: number;
    disabled: number;
    usedInSearch: number;
  };
  suppliers: SupplierStatus[];
}

function StatusBadge({ status }: { status: SupplierStatus["status"] }) {
  const styles = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    degraded: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    disabled: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
    unconfigured: "bg-neutral-700/50 text-neutral-500 border-neutral-600/30",
  };

  const labels = {
    active: "● Active",
    degraded: "◐ Degraded",
    error: "✗ Error",
    disabled: "○ Disabled",
    unconfigured: "○ Not Configured",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
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

function SupplierCard({ supplier }: { supplier: SupplierStatus }) {
  const icons: Record<string, string> = {
    wheelpros: "🛞",
    tireweb_atd: "🚚",
    tireweb_ntw: "📦",
    tireweb_usautoforce: "⚡",
    km: "🔑",
  };

  return (
    <div className={`bg-neutral-800 rounded-xl border p-5 ${
      supplier.status === "active" ? "border-green-600/40" :
      supplier.status === "degraded" ? "border-amber-600/40" :
      supplier.status === "error" ? "border-red-600/40" :
      "border-neutral-700"
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icons[supplier.id] || "📦"}</span>
          <div>
            <h3 className="text-white font-bold text-lg">{supplier.canonicalName}</h3>
            <code className="text-xs text-neutral-500 font-mono">{supplier.provider}</code>
          </div>
        </div>
        <StatusBadge status={supplier.status} />
      </div>

      {/* Status Message */}
      <p className={`text-sm mb-4 ${
        supplier.status === "active" ? "text-green-400" :
        supplier.status === "degraded" ? "text-amber-400" :
        supplier.status === "error" ? "text-red-400" :
        "text-neutral-400"
      }`}>
        {supplier.statusMessage}
      </p>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Enabled</div>
          <div className={supplier.enabled ? "text-green-400" : "text-neutral-500"}>
            {supplier.enabled ? "Yes" : "No"}
          </div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">In Live Search</div>
          <div className={supplier.usedInLiveSearch ? "text-green-400" : "text-neutral-500"}>
            {supplier.usedInLiveSearch ? "Yes" : "No"}
          </div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Credentials</div>
          <div className={supplier.credentialsConfigured ? "text-green-400" : "text-red-400"}>
            {supplier.credentialsConfigured ? `✓ ${supplier.credentialSource.toUpperCase()}` : "✗ Missing"}
          </div>
        </div>
        <div>
          <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Last Success</div>
          <div className={supplier.lastSuccessAt ? "text-green-400" : "text-neutral-500"}>
            {formatTime(supplier.lastSuccessAt)}
          </div>
        </div>
      </div>

      {/* Error Info */}
      {supplier.lastErrorAt && (
        <div className="mt-4 pt-4 border-t border-neutral-700">
          <div className="text-neutral-500 text-xs uppercase tracking-wide mb-1">Last Error</div>
          <div className="text-red-400 text-xs">{formatTime(supplier.lastErrorAt)}</div>
          {supplier.lastErrorMessage && (
            <div className="mt-1 text-xs text-red-400/70 font-mono bg-red-900/20 px-2 py-1 rounded break-all">
              {supplier.lastErrorMessage.slice(0, 200)}
              {supplier.lastErrorMessage.length > 200 && "..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupplierStatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/suppliers/status");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to fetch status");
      setData(json);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-neutral-500">Loading supplier status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-6">
        <h2 className="text-red-400 font-bold mb-2">Error Loading Status</h2>
        <p className="text-red-400/70 text-sm">{error}</p>
        <button
          onClick={fetchStatus}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Supplier Status</h1>
          <p className="text-neutral-400 mt-1">
            Real-time health dashboard for all suppliers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/suppliers"
            className="px-4 py-2 bg-neutral-700 text-white rounded-lg text-sm font-medium hover:bg-neutral-600"
          >
            Configure Suppliers
          </Link>
          <button
            onClick={fetchStatus}
            className="px-4 py-2 bg-neutral-700 text-white rounded-lg text-sm font-medium hover:bg-neutral-600"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Last Refresh */}
      <div className="text-xs text-neutral-500">
        Last updated: {lastRefresh?.toLocaleTimeString()} • Auto-refreshes every 30s
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4 text-center">
          <div className="text-3xl font-bold text-white">{data.summary.total}</div>
          <div className="text-xs text-neutral-400 uppercase tracking-wide mt-1">Total</div>
        </div>
        <div className="bg-green-900/20 rounded-xl border border-green-600/30 p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{data.summary.active}</div>
          <div className="text-xs text-green-400/70 uppercase tracking-wide mt-1">Active</div>
        </div>
        <div className="bg-amber-900/20 rounded-xl border border-amber-600/30 p-4 text-center">
          <div className="text-3xl font-bold text-amber-400">{data.summary.degraded}</div>
          <div className="text-xs text-amber-400/70 uppercase tracking-wide mt-1">Degraded</div>
        </div>
        <div className="bg-red-900/20 rounded-xl border border-red-600/30 p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{data.summary.error}</div>
          <div className="text-xs text-red-400/70 uppercase tracking-wide mt-1">Error</div>
        </div>
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4 text-center">
          <div className="text-3xl font-bold text-neutral-400">{data.summary.disabled}</div>
          <div className="text-xs text-neutral-500 uppercase tracking-wide mt-1">Disabled</div>
        </div>
      </div>

      {/* Active in Search */}
      <div className="bg-neutral-800/50 rounded-xl border border-neutral-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🔍</span>
          <span className="font-bold text-white">Used in Live Search</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.suppliers.filter(s => s.usedInLiveSearch).map(s => (
            <span key={s.id} className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm font-medium border border-green-600/30">
              {s.canonicalName}
            </span>
          ))}
          {data.suppliers.filter(s => s.usedInLiveSearch).length === 0 && (
            <span className="text-red-400 text-sm">⚠️ No suppliers active - searches will return no results!</span>
          )}
        </div>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.suppliers.map(supplier => (
          <SupplierCard key={supplier.id} supplier={supplier} />
        ))}
      </div>

      {/* Source of Truth Note */}
      <div className="bg-blue-900/20 rounded-xl border border-blue-600/30 p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">ℹ️</span>
          <div>
            <h3 className="font-bold text-blue-400 mb-1">Source of Truth</h3>
            <p className="text-sm text-blue-300/70">
              This dashboard shows the current state of all suppliers as seen by the search system.
              Suppliers marked as "Used in Live Search" will be queried when customers search for products.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-blue-300/60">
              <div>
                <strong className="text-blue-300">TireWeb Suppliers:</strong> ATD, NTW, US AutoForce
                <br />
                <em>API: ws.tirewire.com • Product: TireWeb</em>
              </div>
              <div>
                <strong className="text-blue-300">Source Tags:</strong>
                <br />
                <code className="font-mono">wheelpros</code>, <code className="font-mono">tireweb:atd</code>, <code className="font-mono">tireweb:ntw</code>, <code className="font-mono">tireweb:usautoforce</code>, <code className="font-mono">km</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
