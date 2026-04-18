"use client";

/**
 * Session History Dashboard
 * View past visitor sessions and their page journeys
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CartData {
  cartId: string;
  itemCount: number;
  total: number;
  vehicle: string | null;
  status: string;
  hasEmail: boolean;
}

interface Session {
  sessionId: string;
  shortId: string;
  isActive: boolean;
  minutesAgo: number;
  timeAgo: string;
  duration: string;
  landingPage: string;
  lastPage: string;
  pageViews: number;
  device: string;
  location: string | null;
  source: string;
  hostname: string | null;
  site: string;
  cart: CartData | null;
}

interface PageTimeline {
  path: string;
  timeDisplay: string;
}

interface SessionsData {
  hours: number;
  totalSessions: number;
  activeSessions: number;
  sessions: Session[];
}

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [minPages, setMinPages] = useState(2);
  const [siteFilter, setSiteFilter] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<PageTimeline[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        minPages: minPages.toString(),
        limit: "100",
      });
      if (siteFilter) params.set("site", siteFilter);
      
      const res = await fetch(`/api/admin/sessions?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    } finally {
      setLoading(false);
    }
  }, [hours, minPages, siteFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTimeline = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setTimeline([]);
      return;
    }
    
    setExpandedSession(sessionId);
    setLoadingTimeline(true);
    try {
      const res = await fetch(`/api/admin/live-visitors/${sessionId}`);
      if (res.ok) {
        const detail = await res.json();
        setTimeline(detail.timeline || []);
      }
    } catch (e) {
      console.error("Failed to fetch timeline:", e);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case "mobile": return "📱";
      case "tablet": return "📱";
      case "desktop": return "💻";
      default: return "🖥️";
    }
  };

  const getSiteBadge = (site: string) => {
    switch (site) {
      case "local":
        return <span className="text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300">Local</span>;
      case "pos":
        return <span className="text-xs px-2 py-0.5 rounded bg-purple-900 text-purple-300">POS</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded bg-green-900 text-green-300">National</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Session History</h1>
          <p className="text-neutral-400 text-sm">
            View past visitor sessions and their page journeys
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={72}>Last 72 hours</option>
          </select>
          
          <select
            value={minPages}
            onChange={(e) => setMinPages(Number(e.target.value))}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value={1}>1+ pages</option>
            <option value={2}>2+ pages</option>
            <option value={3}>3+ pages</option>
            <option value={5}>5+ pages</option>
            <option value={10}>10+ pages</option>
          </select>
          
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="">All sites</option>
            <option value="national">National</option>
            <option value="local">Local</option>
          </select>
          
          <button
            onClick={fetchData}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{data.totalSessions}</div>
            <div className="text-neutral-400 text-sm">Total Sessions</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{data.activeSessions}</div>
            <div className="text-neutral-400 text-sm">Active Now</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">
              {data.sessions.filter(s => s.cart).length}
            </div>
            <div className="text-neutral-400 text-sm">With Cart</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">
              {data.sessions.filter(s => s.pageViews >= 5).length}
            </div>
            <div className="text-neutral-400 text-sm">5+ Pages</div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="bg-neutral-800 rounded-lg p-8 text-center text-neutral-400">
          Loading sessions...
        </div>
      ) : !data || data.sessions.length === 0 ? (
        <div className="bg-neutral-800 rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📭</div>
          <div className="text-xl text-neutral-400">No sessions found</div>
          <div className="text-neutral-500 text-sm mt-2">
            Try adjusting your filters
          </div>
        </div>
      ) : (
        <div className="bg-neutral-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Journey
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Pages
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">
                    Cart
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {data.sessions.map((session) => (
                  <>
                    <tr
                      key={session.sessionId}
                      className={`hover:bg-neutral-700/50 cursor-pointer ${
                        session.isActive ? "bg-green-900/20" : ""
                      }`}
                      onClick={() => fetchTimeline(session.sessionId)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {session.isActive && (
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          )}
                          <span className="text-sm text-white">{session.timeAgo}</span>
                          <span className="text-xs text-neutral-500">
                            {expandedSession === session.sessionId ? "▼" : "▶"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getSiteBadge(session.site)}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={`https://${session.hostname || 'shop.warehousetiredirect.com'}${session.landingPage}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:underline truncate max-w-[200px] block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {session.landingPage === "/" ? "Homepage" : session.landingPage}
                        </a>
                        {session.lastPage !== session.landingPage && (
                          <a 
                            href={`https://${session.hostname || 'shop.warehousetiredirect.com'}${session.lastPage}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-neutral-400 hover:text-blue-400 truncate max-w-[200px] block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            → {session.lastPage === "/" ? "Homepage" : session.lastPage}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-300">
                          {session.location || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-300 truncate max-w-[120px] block">
                          {session.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white">{session.pageViews}</span>
                        <span className="ml-1">{getDeviceIcon(session.device)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-300">{session.duration}</span>
                      </td>
                      <td className="px-4 py-3">
                        {session.cart ? (
                          <div className="text-sm">
                            <span className="text-green-400 font-medium">
                              ${session.cart.total.toLocaleString()}
                            </span>
                            <span className="text-neutral-500 ml-1">
                              ({session.cart.itemCount})
                            </span>
                            {session.cart.hasEmail && (
                              <span className="ml-1">📧</span>
                            )}
                            <Link
                              href={`/admin/abandoned-carts/${session.cart.cartId}`}
                              className="text-blue-400 hover:underline ml-2 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </Link>
                          </div>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded timeline */}
                    {expandedSession === session.sessionId && (
                      <tr key={`${session.sessionId}-timeline`}>
                        <td colSpan={8} className="px-4 py-4 bg-neutral-900">
                          {loadingTimeline ? (
                            <div className="text-neutral-400 text-sm">Loading journey...</div>
                          ) : timeline.length > 0 ? (
                            <div>
                              <div className="text-sm font-medium text-white mb-3">
                                📍 Full Page Journey
                              </div>
                              <div className="flex flex-wrap gap-2 items-center">
                                {timeline.map((page, idx) => (
                                  <div key={idx} className="flex items-center gap-1">
                                    <a
                                      href={`https://${session.hostname || 'shop.warehousetiredirect.com'}${page.path}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-neutral-800 px-2 py-1 rounded text-xs hover:bg-neutral-700"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span className="text-neutral-400">{page.timeDisplay}</span>
                                      <span className="text-blue-400 ml-2 hover:underline">
                                        {page.path === "/" ? "Homepage" : page.path}
                                      </span>
                                    </a>
                                    {idx < timeline.length - 1 && (
                                      <span className="text-neutral-600">→</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-neutral-500 text-sm">No page history available</div>
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

      {/* Link to live */}
      <div className="text-center text-neutral-500 text-sm">
        <Link href="/admin/live" className="text-blue-400 hover:underline">
          ← Back to Live Visitors
        </Link>
      </div>
    </div>
  );
}
