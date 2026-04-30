"use client";

/**
 * Live Visitors Dashboard
 * Mobile-optimized real-time view of who's on the site
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CartData {
  cartId: string;
  itemCount: number;
  total: number;
  vehicle: string | null;
  hasEmail: boolean;
  summary: string;
}

interface Visitor {
  id: string;
  sessionId: string;
  currentPage: string;
  landingPage: string;
  pageViews: number;
  device: string;
  location: string | null;
  source: string;
  secondsAgo: number;
  lastSeenAgo: string;
  hostname: string | null;
  site: string;
  sessionDuration: string;
  cart: CartData | null;
}

interface LiveData {
  generated: string;
  activeMinutes: number;
  totalActive: number;
  summary: {
    total: number;
    withCart: number;
    byDevice: { mobile: number; desktop: number; tablet: number };
    topPages: { page: string; count: number }[];
  };
  visitors: Visitor[];
}

function getDeviceIcon(device: string): string {
  switch (device) {
    case "mobile": return "📱";
    case "tablet": return "📱";
    case "desktop": return "💻";
    default: return "🖥️";
  }
}

function getActivityColor(secondsAgo: number): string {
  if (secondsAgo < 30) return "bg-green-500";
  if (secondsAgo < 120) return "bg-yellow-500";
  return "bg-neutral-400";
}

function formatPage(page: string): string {
  if (page === "/") return "Homepage";
  if (page.length > 35) {
    const base = page.split("?")[0];
    if (base.length > 35) return base.substring(0, 32) + "...";
    return base + "?...";
  }
  return page;
}

function getSiteBadge(site: string) {
  switch (site) {
    case "local":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">Local</span>;
    case "pos":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300">POS</span>;
    default:
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300">National</span>;
  }
}

// Mobile visitor card
function VisitorCard({ visitor }: { visitor: Visitor }) {
  return (
    <div className="bg-neutral-800 rounded-xl p-4 space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getActivityColor(visitor.secondsAgo)} ${visitor.secondsAgo < 30 ? "animate-pulse" : ""}`} />
          <span className="text-sm text-neutral-400">{visitor.lastSeenAgo}</span>
          <span className="text-lg">{getDeviceIcon(visitor.device)}</span>
        </div>
        {getSiteBadge(visitor.site)}
      </div>

      {/* Current page */}
      <div className="text-white font-medium truncate">
        {formatPage(visitor.currentPage)}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-neutral-500">Pages: </span>
          <span className="text-white font-medium">{visitor.pageViews}</span>
        </div>
        <div>
          <span className="text-neutral-500">Time: </span>
          <span className="text-white">{visitor.sessionDuration}</span>
        </div>
      </div>

      {/* Source */}
      <div className="text-sm text-neutral-400 truncate">
        via {visitor.source}
      </div>

      {/* Location */}
      {visitor.location && (
        <div className="text-xs text-neutral-500">
          📍 {visitor.location}
        </div>
      )}

      {/* Cart */}
      {visitor.cart && (
        <div className="pt-3 border-t border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-green-400 font-bold text-lg">
                ${visitor.cart.total.toLocaleString()}
              </span>
              <span className="text-neutral-500 ml-2">
                ({visitor.cart.itemCount} items)
              </span>
            </div>
            {visitor.cart.hasEmail && <span>📧</span>}
          </div>
          {visitor.cart.vehicle && (
            <div className="text-sm text-neutral-400 mt-1">
              🚗 {visitor.cart.vehicle}
            </div>
          )}
          <Link
            href={`/admin/abandoned-carts/${visitor.cart.cartId}`}
            className="text-sm text-blue-400 hover:underline mt-2 inline-block"
          >
            View Cart →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function LiveVisitorsPage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/live-visitors?minutes=5");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError("Failed to load live data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-bold text-white">Live Visitors</h1>
              {data && (
                <span className="text-3xl font-bold text-green-400">
                  {data.totalActive}
                </span>
              )}
            </div>
            <p className="text-neutral-400 text-sm mt-1">
              Active in last 5 min
              {lastRefresh && (
                <span className="hidden sm:inline"> • {lastRefresh.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded bg-neutral-700 border-neutral-600"
              />
              <span className="hidden sm:inline">Auto</span>
            </label>
            <button
              onClick={fetchData}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-xl p-4">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-2xl lg:text-3xl font-bold text-green-400">{data.summary.total}</div>
              <div className="text-neutral-400 text-sm">Active</div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-2xl lg:text-3xl font-bold text-white">
                📱 {data.summary.byDevice.mobile}
              </div>
              <div className="text-neutral-400 text-sm">Mobile</div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-2xl lg:text-3xl font-bold text-white">
                💻 {data.summary.byDevice.desktop}
              </div>
              <div className="text-neutral-400 text-sm">Desktop</div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-2xl lg:text-3xl font-bold text-green-400">
                {data.summary.withCart || data.visitors.filter(v => v.cart).length}
              </div>
              <div className="text-neutral-400 text-sm">With Cart</div>
            </div>
          </div>

          {/* Visitors */}
          {data.visitors.length === 0 ? (
            <div className="bg-neutral-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">😴</div>
              <div className="text-xl text-neutral-400">No active visitors</div>
              <div className="text-neutral-500 text-sm mt-2">
                Check back in a minute
              </div>
            </div>
          ) : (
            <>
              {/* Mobile: Card layout */}
              <div className="lg:hidden space-y-3">
                {data.visitors.map((visitor) => (
                  <VisitorCard key={visitor.id} visitor={visitor} />
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden lg:block bg-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Site</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Page</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Device</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Pages</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Cart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {data.visitors.map((visitor) => (
                        <tr key={visitor.id} className="hover:bg-neutral-700/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getActivityColor(visitor.secondsAgo)}`} />
                              <span className="text-sm text-neutral-400">{visitor.lastSeenAgo}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getSiteBadge(visitor.site)}</td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-white truncate max-w-[200px]">
                              {formatPage(visitor.currentPage)}
                            </div>
                            {visitor.currentPage !== visitor.landingPage && (
                              <div className="text-xs text-neutral-500 truncate max-w-[200px]">
                                from {formatPage(visitor.landingPage)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-300">
                            {visitor.location || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-neutral-300 truncate block max-w-[120px]">
                              {visitor.source}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-lg">{getDeviceIcon(visitor.device)}</td>
                          <td className="px-4 py-3 text-sm text-white">{visitor.pageViews}</td>
                          <td className="px-4 py-3 text-sm text-neutral-300">{visitor.sessionDuration}</td>
                          <td className="px-4 py-3">
                            {visitor.cart ? (
                              <div className="text-sm">
                                <span className="text-green-400 font-medium">
                                  ${visitor.cart.total.toLocaleString()}
                                </span>
                                <span className="text-neutral-500 ml-1">({visitor.cart.itemCount})</span>
                                {visitor.cart.hasEmail && <span className="ml-1">📧</span>}
                                <Link
                                  href={`/admin/abandoned-carts/${visitor.cart.cartId}`}
                                  className="text-blue-400 hover:underline ml-2 text-xs"
                                >
                                  View
                                </Link>
                              </div>
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Quick nav */}
          <div className="text-center text-neutral-500 text-sm pt-4">
            <Link href="/admin/sessions" className="text-blue-400 hover:underline">
              Session History →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
