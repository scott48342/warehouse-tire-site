"use client";

/**
 * Live Visitors Dashboard
 * Real-time view of who's on the site
 * 
 * @created 2026-04-18
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
  items: { type: string; brand: string; model: string; qty: number; price: number }[];
}

interface Visitor {
  id: string;
  sessionId: string;
  currentPage: string;
  landingPage: string;
  pageViews: number;
  device: string;
  location: string | null;
  country: string | null;
  city: string | null;
  source: string;
  secondsAgo: number;
  lastSeenAgo: string;
  hostname: string | null;
  sessionDuration: string;
  cart: CartData | null;
}

interface LiveData {
  generated: string;
  activeMinutes: number;
  totalActive: number;
  summary: {
    total: number;
    byDevice: { mobile: number; desktop: number; tablet: number };
    topPages: { page: string; count: number }[];
  };
  visitors: Visitor[];
}

interface PageTimeline {
  path: string;
  time: string;
  timeDisplay: string;
  durationOnPage: number | null;
}

interface SessionDetail {
  sessionId: string;
  timeline: PageTimeline[];
  pageCount: number;
}

export default function LiveVisitorsPage() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSessionDetail = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setSessionDetail(null);
      return;
    }
    
    setExpandedSession(sessionId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/live-visitors/${sessionId}`);
      if (res.ok) {
        const detail = await res.json();
        setSessionDetail(detail);
      }
    } catch (e) {
      console.error("Failed to fetch session detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

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
    const interval = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "mobile": return "📱";
      case "tablet": return "📱";
      case "desktop": return "💻";
      default: return "🖥️";
    }
  };

  const getPageLabel = (page: string) => {
    if (page === "/") return "Homepage";
    if (page.startsWith("/wheels")) return "🛞 " + page;
    if (page.startsWith("/tires")) return "🔘 " + page;
    if (page.startsWith("/suspension")) return "⬆️ " + page;
    if (page.startsWith("/checkout")) return "🛒 Checkout";
    if (page.startsWith("/cart")) return "🛒 Cart";
    return page;
  };

  const getActivityColor = (secondsAgo: number) => {
    if (secondsAgo < 30) return "bg-green-500"; // Very active
    if (secondsAgo < 120) return "bg-yellow-500"; // Active
    return "bg-gray-400"; // Idle
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🟢 Live Visitors
              {data && (
                <span className="text-4xl font-bold text-green-400 ml-2">
                  {data.totalActive}
                </span>
              )}
            </h1>
            <p className="text-gray-400 text-sm">
              Active in the last 5 minutes
              {lastRefresh && (
                <span className="ml-2">
                  • Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="bg-gray-800 rounded px-2 py-1 text-sm"
              disabled={!autoRefresh}
            >
              <option value={5}>5s</option>
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
            <button
              onClick={fetchData}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-4 mb-6">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">{data.summary.total}</div>
                <div className="text-gray-400 text-sm">Active Now</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-3xl font-bold">📱 {data.summary.byDevice.mobile}</div>
                <div className="text-gray-400 text-sm">Mobile</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-3xl font-bold">💻 {data.summary.byDevice.desktop}</div>
                <div className="text-gray-400 text-sm">Desktop</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-1">Top Pages</div>
                {data.summary.topPages.slice(0, 3).map((p, i) => (
                  <div key={i} className="text-sm truncate">
                    <span className="text-white">{p.count}</span>
                    <span className="text-gray-500 ml-1">{p.page === "/" ? "Homepage" : p.page}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visitors Table */}
            {data.visitors.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <div className="text-4xl mb-4">😴</div>
                <div className="text-xl text-gray-400">No active visitors right now</div>
                <div className="text-gray-500 text-sm mt-2">
                  Check back later or verify tracking is working
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Site
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Current Page
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Device
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Pages
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Cart
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {data.visitors.map((visitor) => (
                        <>
                        <tr 
                          key={visitor.id} 
                          className="hover:bg-gray-700/50 cursor-pointer"
                          onClick={() => fetchSessionDetail(visitor.sessionId)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div 
                                className={`w-2 h-2 rounded-full ${getActivityColor(visitor.secondsAgo)}`}
                                title={visitor.lastSeenAgo}
                              />
                              <span className="text-xs text-gray-500">{visitor.lastSeenAgo}</span>
                              <span className="text-xs text-gray-600">
                                {expandedSession === visitor.sessionId ? "▼" : "▶"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {visitor.hostname?.includes("warehousetire.net") ? (
                              <span className="text-xs px-2 py-1 rounded bg-blue-900 text-blue-300">Local</span>
                            ) : visitor.hostname?.includes("pos.") ? (
                              <span className="text-xs px-2 py-1 rounded bg-purple-900 text-purple-300">POS</span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded bg-green-900 text-green-300">National</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-white truncate max-w-xs" title={visitor.currentPage}>
                              {getPageLabel(visitor.currentPage)}
                            </div>
                            {visitor.currentPage !== visitor.landingPage && (
                              <div className="text-xs text-gray-500 truncate max-w-xs" title={`Landed on: ${visitor.landingPage}`}>
                                from {visitor.landingPage}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-300">
                              {visitor.location || (
                                <span className="text-gray-500">Unknown</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-300 truncate max-w-[150px]" title={visitor.source}>
                              {visitor.source}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span title={visitor.device}>
                              {getDeviceIcon(visitor.device)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-300">{visitor.pageViews}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-300">{visitor.sessionDuration}</span>
                          </td>
                          <td className="px-4 py-3">
                            {visitor.cart ? (
                              <div className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-green-400 font-medium">
                                    ${visitor.cart.total.toLocaleString()}
                                  </span>
                                  <span className="text-gray-500">
                                    ({visitor.cart.itemCount} items)
                                  </span>
                                </div>
                                {visitor.cart.vehicle && (
                                  <div className="text-xs text-gray-400 truncate max-w-[200px]">
                                    🚗 {visitor.cart.vehicle}
                                  </div>
                                )}
                                <div className="text-xs text-gray-500">
                                  {visitor.cart.summary}
                                </div>
                                {visitor.cart.hasEmail && (
                                  <span className="text-xs text-blue-400">📧 Has email</span>
                                )}
                                <Link 
                                  href={`/admin/abandoned-carts/${visitor.cart.cartId}`}
                                  className="text-xs text-blue-400 hover:underline ml-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View →
                                </Link>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                        {/* Expanded row showing page journey */}
                        {expandedSession === visitor.sessionId && (
                          <tr key={`${visitor.id}-detail`}>
                            <td colSpan={9} className="px-4 py-4 bg-gray-900">
                              {loadingDetail ? (
                                <div className="text-gray-400 text-sm">Loading page history...</div>
                              ) : sessionDetail ? (
                                <div>
                                  <div className="text-sm font-medium text-white mb-3">
                                    📍 Page Journey ({sessionDetail.pageCount} pages)
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {sessionDetail.timeline.map((page, idx) => (
                                      <div 
                                        key={idx}
                                        className="flex items-center gap-1 text-xs"
                                      >
                                        <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">
                                          {page.path === "/" ? "Homepage" : page.path}
                                        </span>
                                        {idx < sessionDetail.timeline.length - 1 && (
                                          <span className="text-gray-600">→</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    Click row again to collapse
                                  </div>
                                </div>
                              ) : (
                                <div className="text-gray-500 text-sm">No page history available</div>
                              )}
                            </td>
                          </tr>
                        )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 text-center text-gray-500 text-sm">
              <Link href="/admin/analytics" className="text-blue-400 hover:underline">
                View Full Analytics →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
