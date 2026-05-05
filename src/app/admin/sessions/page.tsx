"use client";

/**
 * Session History Dashboard
 * Mobile-optimized view of past visitor sessions
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

interface PageEvent {
  path: string;
  time: string;
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
  pages: string[];
  events: PageEvent[];
  device: string;
  location: string | null;
  source: string;
  hostname: string | null;
  site: string;
  cart: CartData | null;
}

interface SessionsData {
  hours: number;
  totalSessions: number;
  activeSessions: number;
  withCart: number;
  deepSessions: number;
  sessions: Session[];
}

function formatPath(path: string): string {
  if (path === "/") return "Homepage";
  // Truncate long paths
  if (path.length > 40) {
    // Try to show the meaningful part
    const parts = path.split("?")[0];
    if (parts.length > 40) {
      return parts.substring(0, 37) + "...";
    }
    return parts + "?...";
  }
  return path;
}

function getDeviceIcon(device: string): string {
  switch (device) {
    case "mobile": return "📱";
    case "tablet": return "📱";
    case "desktop": return "💻";
    default: return "🖥️";
  }
}

function getSiteBadge(site: string) {
  switch (site) {
    case "local":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 border border-blue-800">Local</span>;
    case "pos":
      return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 border border-purple-800">POS</span>;
    default:
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-300 border border-green-800">National</span>;
  }
}

// Format time from ISO string to local time
function formatEventTime(isoTime: string): string {
  try {
    const date = new Date(isoTime);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Mobile card view for a session
function SessionCard({ session, onExpand, isExpanded }: { session: Session; onExpand: () => void; isExpanded: boolean }) {
  return (
    <div 
      className={`bg-neutral-800 rounded-xl p-4 space-y-3 ${session.isActive ? "ring-1 ring-green-500/50" : ""}`}
      onClick={onExpand}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {session.isActive && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
          <span className="text-sm text-neutral-400">{session.timeAgo}</span>
          <span className="text-lg">{getDeviceIcon(session.device)}</span>
          <span className="text-xs text-neutral-500">{isExpanded ? "▼" : "▶"}</span>
        </div>
        {getSiteBadge(session.site)}
      </div>

      {/* Journey */}
      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
        <a 
          href={session.landingPage} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white font-medium truncate block hover:underline"
        >
          {formatPath(session.landingPage)}
        </a>
        {session.lastPage !== session.landingPage && (
          <a 
            href={session.lastPage} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-neutral-400 truncate block hover:underline"
          >
            → {formatPath(session.lastPage)}
          </a>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500">Pages:</span>
          <span className="text-white font-medium">{session.pageViews}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500">Time:</span>
          <span className="text-white">{session.duration}</span>
        </div>
      </div>

      {/* Source */}
      <div className="text-sm text-neutral-400 truncate">
        via {session.source}
      </div>

      {/* Expanded: Page journey */}
      {isExpanded && session.events && session.events.length > 0 && (
        <div className="pt-3 border-t border-neutral-700 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="text-xs font-medium text-neutral-400 uppercase">Pages Visited</div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {session.events.map((event, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-neutral-500 text-xs w-12 flex-shrink-0">
                  {formatEventTime(event.time)}
                </span>
                <a 
                  href={event.path} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate"
                >
                  {formatPath(event.path)}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart badge */}
      {session.cart && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-700">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold">
              ${session.cart.total.toLocaleString()}
            </span>
            <span className="text-neutral-500">
              ({session.cart.itemCount} items)
            </span>
            {session.cart.hasEmail && <span>📧</span>}
          </div>
          <Link
            href={`/admin/abandoned-carts/${session.cart.cartId}`}
            className="text-sm text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View Cart →
          </Link>
        </div>
      )}

      {/* Location if available */}
      {session.location && (
        <div className="text-xs text-neutral-500">
          📍 {session.location}
        </div>
      )}
    </div>
  );
}

// Desktop table row
function SessionRow({ session, onExpand, isExpanded }: { 
  session: Session; 
  onExpand: () => void;
  isExpanded: boolean;
}) {
  return (
    <>
      <tr
        className={`hover:bg-neutral-700/50 cursor-pointer ${
          session.isActive ? "bg-green-900/20" : ""
        }`}
        onClick={onExpand}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {session.isActive && <span className="w-2 h-2 rounded-full bg-green-500" />}
            <span className="text-sm text-white">{session.timeAgo}</span>
            <span className="text-xs text-neutral-500">{isExpanded ? "▼" : "▶"}</span>
          </div>
        </td>
        <td className="px-4 py-3">{getSiteBadge(session.site)}</td>
        <td className="px-4 py-3">
          <a 
            href={session.landingPage} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-400 hover:underline truncate max-w-[200px] block"
            onClick={(e) => e.stopPropagation()}
          >
            {formatPath(session.landingPage)}
          </a>
          {session.lastPage !== session.landingPage && (
            <a 
              href={session.lastPage} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-neutral-400 hover:underline truncate max-w-[200px] block"
              onClick={(e) => e.stopPropagation()}
            >
              → {formatPath(session.lastPage)}
            </a>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-sm text-neutral-300">{session.location || "—"}</span>
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
              <span className="text-neutral-500 ml-1">({session.cart.itemCount})</span>
              {session.cart.hasEmail && <span className="ml-1">📧</span>}
            </div>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </td>
      </tr>
      {/* Expanded row showing page journey */}
      {isExpanded && (
        <tr className="bg-neutral-900/50">
          <td colSpan={8} className="px-4 py-3">
            <div className="pl-4 border-l-2 border-neutral-700">
              <div className="text-xs font-medium text-neutral-400 uppercase mb-2">
                Page Journey ({session.events?.length || session.pages?.length || 0} pages)
              </div>
              {session.events && session.events.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 max-h-40 overflow-y-auto">
                  {session.events.map((event, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <span className="text-neutral-500 text-xs w-12 flex-shrink-0">
                        {formatEventTime(event.time)}
                      </span>
                      <a 
                        href={event.path} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline truncate" 
                        title={event.path}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatPath(event.path)}
                      </a>
                    </div>
                  ))}
                </div>
              ) : session.pages && session.pages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {session.pages.map((page, idx) => (
                    <a 
                      key={idx} 
                      href={page} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline bg-neutral-800 px-2 py-0.5 rounded" 
                      title={page}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {formatPath(page)}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">No page data available</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SessionsPage() {
  const [data, setData] = useState<SessionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [minPages, setMinPages] = useState(2);
  const [siteFilter, setSiteFilter] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

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

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Session History</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Past visitor sessions and journeys
          </p>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="flex-1 min-w-[100px] max-w-[140px] bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value={1}>1 hour</option>
            <option value={6}>6 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>72 hours</option>
          </select>
          
          <select
            value={minPages}
            onChange={(e) => setMinPages(Number(e.target.value))}
            className="flex-1 min-w-[100px] max-w-[140px] bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value={1}>1+ pages</option>
            <option value={2}>2+ pages</option>
            <option value={3}>3+ pages</option>
            <option value={5}>5+ pages</option>
          </select>
          
          <select
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
            className="flex-1 min-w-[100px] max-w-[140px] bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All sites</option>
            <option value="national">National</option>
            <option value="local">Local</option>
          </select>
          
          <button
            onClick={fetchData}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm text-white font-medium"
          >
            {loading ? "..." : "↻"}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{data.totalSessions}</div>
            <div className="text-neutral-400 text-sm">Sessions</div>
          </div>
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400">{data.activeSessions}</div>
            <div className="text-neutral-400 text-sm">Active</div>
          </div>
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{data.withCart}</div>
            <div className="text-neutral-400 text-sm">With Cart</div>
          </div>
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{data.deepSessions}</div>
            <div className="text-neutral-400 text-sm">5+ Pages</div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div className="bg-neutral-800 rounded-xl p-8 text-center text-neutral-400">
          Loading sessions...
        </div>
      ) : !data || data.sessions.length === 0 ? (
        <div className="bg-neutral-800 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📭</div>
          <div className="text-xl text-neutral-400">No sessions found</div>
          <div className="text-neutral-500 text-sm mt-2">
            Try adjusting your filters
          </div>
        </div>
      ) : (
        <>
          {/* Mobile: Card layout */}
          <div className="lg:hidden space-y-3">
            {data.sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                isExpanded={expandedSession === session.sessionId}
                onExpand={() => setExpandedSession(
                  expandedSession === session.sessionId ? null : session.sessionId
                )}
              />
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden lg:block bg-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Site</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Journey</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Pages</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Cart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-700">
                  {data.sessions.map((session) => (
                    <SessionRow
                      key={session.sessionId}
                      session={session}
                      isExpanded={expandedSession === session.sessionId}
                      onExpand={() => setExpandedSession(
                        expandedSession === session.sessionId ? null : session.sessionId
                      )}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Quick nav */}
      <div className="text-center text-neutral-500 text-sm pt-4">
        <Link href="/admin/live" className="text-blue-400 hover:underline">
          ← Live Visitors
        </Link>
      </div>
    </div>
  );
}
