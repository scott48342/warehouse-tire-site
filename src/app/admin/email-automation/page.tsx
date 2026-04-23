"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface AutomationStats {
  totalSubscribers: number;
  exitIntentCaptures: number;
  abandonedCartEmailsSent: number;
  exitIntentEmailsSent: number;
  totalEmailClicks: number;
  totalRecoveredCarts: number;
  totalRecoveredOrders: number;
  estimatedRecoveredRevenue: number;
  
  subscribersBySource: {
    exit_intent: number;
    checkout: number;
    cart_save: number;
    newsletter: number;
    quote: number;
    other: number;
  };
  
  flows: {
    abandonedCart1: FlowStats;
    abandonedCart2: FlowStats;
    abandonedCart3: FlowStats;
    exitIntentImmediate: FlowStats;
    exitIntentFollowup: FlowStats;
  };
  
  recentActivity: RecentActivityItem[];
  
  trends: {
    last7Days: TrendStats;
    last30Days: TrendStats;
  };
}

interface FlowStats {
  name: string;
  sent: number;
  opened: number;
  clicked: number;
  recovered: number;
  openRate: number;
  clickRate: number;
  recoveryRate: number;
}

interface RecentActivityItem {
  id: string;
  email: string | null;
  source: string;
  vehicle: string | null;
  eventType: "subscriber" | "cart_abandoned" | "email_sent" | "email_clicked" | "recovered";
  sentStatus: "pending" | "sent" | "none";
  clickStatus: "clicked" | "opened" | "none";
  createdAt: string;
  cartId?: string;
  cartValue?: number;
}

interface TrendStats {
  subscribersGained: number;
  emailsSent: number;
  clicks: number;
  recoveries: number;
  revenue: number;
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
  title,
  value,
  subValue,
  icon,
  color = "neutral",
  href,
}: {
  title: string;
  value: number | string;
  subValue?: string;
  icon: string;
  color?: "green" | "yellow" | "blue" | "purple" | "red" | "neutral";
  href?: string;
}) {
  const colorClasses = {
    green: "border-green-700 bg-green-900/30",
    yellow: "border-yellow-700 bg-yellow-900/30",
    blue: "border-blue-700 bg-blue-900/30",
    purple: "border-purple-700 bg-purple-900/30",
    red: "border-red-700 bg-red-900/30",
    neutral: "border-neutral-700 bg-neutral-800",
  };

  const content = (
    <div className={`rounded-xl border p-4 ${colorClasses[color]} ${href ? "hover:border-opacity-80 cursor-pointer transition-colors" : ""}`}>
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

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function FlowCard({ flow, isHighlighted = false }: { flow: FlowStats; isHighlighted?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${isHighlighted ? "border-green-700 bg-green-900/20" : "border-neutral-700 bg-neutral-800"}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white">{flow.name}</h4>
        {flow.recoveryRate > 0 && (
          <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full">
            {flow.recoveryRate}% recovery
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-xl font-bold text-white">{flow.sent}</div>
          <div className="text-xs text-neutral-500">Sent</div>
        </div>
        <div>
          <div className="text-xl font-bold text-purple-400">{flow.opened}</div>
          <div className="text-xs text-neutral-500">Opened</div>
          {flow.sent > 0 && <div className="text-[10px] text-purple-400">{flow.openRate}%</div>}
        </div>
        <div>
          <div className="text-xl font-bold text-orange-400">{flow.clicked}</div>
          <div className="text-xs text-neutral-500">Clicked</div>
          {flow.sent > 0 && <div className="text-[10px] text-orange-400">{flow.clickRate}%</div>}
        </div>
        <div>
          <div className="text-xl font-bold text-green-400">{flow.recovered}</div>
          <div className="text-xs text-neutral-500">Recovered</div>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    exit_intent: { label: "Exit Intent", color: "text-purple-300", bg: "bg-purple-900/50" },
    checkout: { label: "Checkout", color: "text-green-300", bg: "bg-green-900/50" },
    cart_save: { label: "Cart Save", color: "text-blue-300", bg: "bg-blue-900/50" },
    newsletter: { label: "Newsletter", color: "text-yellow-300", bg: "bg-yellow-900/50" },
    quote: { label: "Quote", color: "text-orange-300", bg: "bg-orange-900/50" },
    abandoned_cart: { label: "Cart", color: "text-red-300", bg: "bg-red-900/50" },
  };
  const config = configs[source] || { label: source, color: "text-neutral-300", bg: "bg-neutral-700" };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  );
}

function EventBadge({ eventType }: { eventType: RecentActivityItem["eventType"] }) {
  const configs: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    subscriber: { label: "Subscribed", color: "text-blue-300", bg: "bg-blue-900/50", icon: "✉️" },
    cart_abandoned: { label: "Abandoned", color: "text-yellow-300", bg: "bg-yellow-900/50", icon: "🛒" },
    email_sent: { label: "Email Sent", color: "text-purple-300", bg: "bg-purple-900/50", icon: "📧" },
    email_clicked: { label: "Clicked", color: "text-orange-300", bg: "bg-orange-900/50", icon: "🖱️" },
    recovered: { label: "Recovered", color: "text-green-300", bg: "bg-green-900/50", icon: "✅" },
  };
  const config = configs[eventType] || { label: eventType, color: "text-neutral-300", bg: "bg-neutral-700", icon: "•" };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
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

// ============================================================================
// Main Page
// ============================================================================

export default function EmailAutomationPage() {
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<"7" | "30">("7");

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/email-automation/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const currentTrend = stats?.trends[trendPeriod === "7" ? "last7Days" : "last30Days"];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>📧</span>
            Email Automation
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Performance dashboard for automated email recovery
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/subscribers"
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg"
          >
            View Subscribers
          </Link>
          <Link
            href="/admin/abandoned-carts"
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-medium rounded-lg"
          >
            View Carts
          </Link>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300">
          Error: {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="text-center py-12 text-neutral-400">Loading stats...</div>
      ) : stats ? (
        <>
          {/* Top-Level Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Subscribers"
              value={stats.totalSubscribers.toLocaleString()}
              icon="👥"
              color="blue"
              href="/admin/subscribers"
            />
            <StatCard
              title="Exit Intent Captures"
              value={stats.exitIntentCaptures.toLocaleString()}
              icon="🚪"
              color="purple"
            />
            <StatCard
              title="Abandoned Cart Emails"
              value={stats.abandonedCartEmailsSent.toLocaleString()}
              subValue={`+ ${stats.exitIntentEmailsSent} exit intent`}
              icon="📧"
              color="yellow"
            />
            <StatCard
              title="Total Email Clicks"
              value={stats.totalEmailClicks.toLocaleString()}
              icon="🖱️"
              color="neutral"
            />
          </div>

          {/* Recovery Stats - Highlighted */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              title="Recovered Carts"
              value={stats.totalRecoveredCarts.toLocaleString()}
              icon="🛒"
              color="green"
              href="/admin/abandoned-carts?status=recovered"
            />
            <StatCard
              title="Recovered Orders"
              value={stats.totalRecoveredOrders.toLocaleString()}
              icon="📦"
              color="green"
            />
            <StatCard
              title="Recovered Revenue"
              value={formatCurrency(stats.estimatedRecoveredRevenue)}
              subValue="via email automation"
              icon="💰"
              color="green"
            />
          </div>

          {/* Trend Summary */}
          <div className="mb-8 p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">📈 Trends</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setTrendPeriod("7")}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    trendPeriod === "7"
                      ? "bg-red-600 text-white"
                      : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setTrendPeriod("30")}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    trendPeriod === "30"
                      ? "bg-red-600 text-white"
                      : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                  }`}
                >
                  Last 30 Days
                </button>
              </div>
            </div>
            {currentTrend && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">+{currentTrend.subscribersGained}</div>
                  <div className="text-xs text-neutral-500">New Subscribers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{currentTrend.emailsSent}</div>
                  <div className="text-xs text-neutral-500">Emails Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">{currentTrend.clicks}</div>
                  <div className="text-xs text-neutral-500">Email Clicks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{currentTrend.recoveries}</div>
                  <div className="text-xs text-neutral-500">Recoveries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(currentTrend.revenue)}</div>
                  <div className="text-xs text-neutral-500">Revenue Recovered</div>
                </div>
              </div>
            )}
          </div>

          {/* Subscriber Sources Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">📊 Subscriber Sources</h3>
              <div className="space-y-3">
                {Object.entries(stats.subscribersBySource)
                  .filter(([_, count]) => count > 0)
                  .sort(([_, a], [__, b]) => b - a)
                  .map(([source, count]) => {
                    const total = stats.totalSubscribers;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <SourceBadge source={source} />
                        <div className="flex-1 bg-neutral-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-white font-medium w-16 text-right">{count}</span>
                        <span className="text-neutral-500 text-sm w-12">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Quick Links */}
            <div className="p-4 bg-neutral-800 border border-neutral-700 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">🔗 Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/admin/abandoned-carts?engagement=high-intent"
                  className="flex items-center justify-between p-3 bg-orange-900/30 border border-orange-700 rounded-lg hover:bg-orange-900/50 transition-colors"
                >
                  <span className="text-orange-300 font-medium">🔥 High-Intent Leads</span>
                  <span className="text-orange-400">→</span>
                </Link>
                <Link
                  href="/admin/abandoned-carts?status=abandoned"
                  className="flex items-center justify-between p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg hover:bg-yellow-900/50 transition-colors"
                >
                  <span className="text-yellow-300 font-medium">⚠️ Pending Recovery</span>
                  <span className="text-yellow-400">→</span>
                </Link>
                <Link
                  href="/admin/email-campaigns"
                  className="flex items-center justify-between p-3 bg-neutral-700 border border-neutral-600 rounded-lg hover:bg-neutral-600 transition-colors"
                >
                  <span className="text-neutral-300 font-medium">📧 Marketing Campaigns</span>
                  <span className="text-neutral-400">→</span>
                </Link>
                <Link
                  href="/admin/subscribers?source=exit_intent"
                  className="flex items-center justify-between p-3 bg-purple-900/30 border border-purple-700 rounded-lg hover:bg-purple-900/50 transition-colors"
                >
                  <span className="text-purple-300 font-medium">🚪 Exit Intent List</span>
                  <span className="text-purple-400">→</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Email Flow Performance */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-white mb-4">📬 Email Flow Performance</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-neutral-400 mb-2">Abandoned Cart Sequence</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FlowCard flow={stats.flows.abandonedCart1} isHighlighted={stats.flows.abandonedCart1.recovered > 0} />
                  <FlowCard flow={stats.flows.abandonedCart2} />
                  <FlowCard flow={stats.flows.abandonedCart3} />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-neutral-400 mb-2">Exit Intent Sequence</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FlowCard flow={stats.flows.exitIntentImmediate} />
                  <FlowCard flow={stats.flows.exitIntentFollowup} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-neutral-700">
              <h3 className="text-lg font-bold text-white">🕐 Recent Activity</h3>
              <p className="text-sm text-neutral-400">Latest email captures and cart events</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/50">
                  <tr className="text-left text-neutral-400 border-b border-neutral-700">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Vehicle</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Email Status</th>
                    <th className="px-4 py-3 font-medium">Click Status</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                        No recent activity
                      </td>
                    </tr>
                  ) : (
                    stats.recentActivity.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-neutral-700/50 hover:bg-neutral-700/30"
                      >
                        <td className="px-4 py-3 text-white">
                          {item.email || <span className="text-neutral-500">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <SourceBadge source={item.source} />
                        </td>
                        <td className="px-4 py-3 text-neutral-300">
                          {item.vehicle || <span className="text-neutral-500">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <EventBadge eventType={item.eventType} />
                        </td>
                        <td className="px-4 py-3">
                          {item.sentStatus === "sent" && (
                            <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded">✓ Sent</span>
                          )}
                          {item.sentStatus === "pending" && (
                            <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 text-xs rounded">⏳ Pending</span>
                          )}
                          {item.sentStatus === "none" && (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.clickStatus === "clicked" && (
                            <span className="px-2 py-0.5 bg-orange-900/50 text-orange-400 text-xs rounded">🖱️ Clicked</span>
                          )}
                          {item.clickStatus === "opened" && (
                            <span className="px-2 py-0.5 bg-purple-900/50 text-purple-400 text-xs rounded">👀 Opened</span>
                          )}
                          {item.clickStatus === "none" && (
                            <span className="text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-400">
                          {formatTimeAgo(item.createdAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attribution Note */}
          <div className="mt-6 p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-neutral-300 mb-2">📋 Recovery Attribution</h4>
            <p className="text-xs text-neutral-500">
              Recovery is attributed to email automation when:
            </p>
            <ul className="text-xs text-neutral-500 mt-1 ml-4 list-disc space-y-0.5">
              <li>Customer clicks a recovery link in an abandoned cart email</li>
              <li>Cart is recovered within 48 hours of an email being sent</li>
              <li>Order is placed using the same cart ID that received emails</li>
            </ul>
            <p className="text-xs text-neutral-400 mt-2">
              Flow-level stats (opens, clicks, recovery per email stage) are approximated based on overall engagement rates. 
              For exact per-email tracking, individual email events are recorded in the cart data.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
