"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  campaignType: string;
  status: string;
  subject: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  complainedCount: number;
  scheduledFor?: string;
  sentAt?: string;
  completedAt?: string;
  createdAt: string;
};

type Stats = {
  totalRecipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
};

type Event = {
  id: string;
  recipientId: string;
  email: string;
  eventType: string;
  metadata?: Record<string, any>;
  occurredAt: string;
};

const EVENT_ICONS: Record<string, string> = {
  sent: "📤",
  delivered: "✅",
  opened: "👁️",
  clicked: "🔗",
  bounced: "❌",
  complained: "⚠️",
  unsubscribed: "🚫",
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function StatCard({
  label,
  value,
  rate,
  color = "neutral",
}: {
  label: string;
  value: number;
  rate?: number;
  color?: "green" | "red" | "blue" | "yellow" | "neutral";
}) {
  const colorClasses = {
    green: "bg-green-900/30 border-green-700",
    red: "bg-red-900/30 border-red-700",
    blue: "bg-blue-900/30 border-blue-700",
    yellow: "bg-yellow-900/30 border-yellow-700",
    neutral: "bg-neutral-700/50 border-neutral-600",
  };

  return (
    <div className={`rounded-lg p-4 border ${colorClasses[color]}`}>
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value.toLocaleString()}</div>
      {rate !== undefined && (
        <div className="text-sm text-neutral-300 mt-1">{formatPercent(rate)}</div>
      )}
    </div>
  );
}

export default function CampaignStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (campaign) {
      fetchEvents();
    }
  }, [campaign, eventFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campaignRes, statsRes] = await Promise.all([
        fetch(`/api/admin/email-campaigns/${id}`),
        fetch(`/api/admin/email-campaigns/${id}/stats`),
      ]);

      const campaignData = await campaignRes.json();
      const statsData = await statsRes.json();

      if (!campaignRes.ok) throw new Error(campaignData.error || "Failed to fetch campaign");
      if (!statsRes.ok) throw new Error(statsData.error || "Failed to fetch stats");

      setCampaign(campaignData.campaign);
      setStats(statsData.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (eventFilter) params.set("eventType", eventFilter);

      const res = await fetch(`/api/admin/email-campaigns/${id}/events?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setEvents(data.events || []);
      }
    } catch {
      // Silently fail for events
    } finally {
      setEventsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-neutral-400">Loading stats...</div>
      </div>
    );
  }

  if (error || !campaign || !stats) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-red-400">{error || "Campaign not found"}</div>
        <Link href="/admin/email-campaigns" className="text-blue-400 hover:underline block text-center">
          ← Back to campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/email-campaigns/${id}`}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ← Back to Campaign
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  campaign.status === "sent"
                    ? "bg-green-600"
                    : campaign.status === "sending"
                    ? "bg-yellow-600"
                    : "bg-neutral-600"
                }`}
              >
                {campaign.status}
              </span>
              <span className="text-neutral-400 text-sm">{campaign.subject}</span>
            </div>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="px-3 py-2 text-sm bg-neutral-700 text-white rounded-lg hover:bg-neutral-600"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Timeline */}
      <div className="bg-neutral-800 rounded-lg p-4 mb-6 border border-neutral-700">
        <div className="flex items-center gap-8 text-sm">
          <div>
            <span className="text-neutral-400">Created:</span>{" "}
            <span className="text-white">{formatDate(campaign.createdAt)}</span>
          </div>
          {campaign.scheduledFor && (
            <div>
              <span className="text-neutral-400">Scheduled:</span>{" "}
              <span className="text-white">{formatDate(campaign.scheduledFor)}</span>
            </div>
          )}
          {campaign.sentAt && (
            <div>
              <span className="text-neutral-400">Started:</span>{" "}
              <span className="text-white">{formatDate(campaign.sentAt)}</span>
            </div>
          )}
          {campaign.completedAt && (
            <div>
              <span className="text-neutral-400">Completed:</span>{" "}
              <span className="text-white">{formatDate(campaign.completedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Recipients" value={stats.totalRecipients} />
        <StatCard label="Sent" value={stats.sent} />
        <StatCard label="Delivered" value={stats.delivered} rate={stats.deliveryRate} color="green" />
        <StatCard label="Opened" value={stats.opened} rate={stats.openRate} color="blue" />
        <StatCard label="Clicked" value={stats.clicked} rate={stats.clickRate} color="blue" />
        <StatCard label="Bounced" value={stats.bounced} rate={stats.bounceRate} color="red" />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Complained" value={stats.complained} color="yellow" />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} rate={stats.unsubscribeRate} color="red" />
        <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
          <div className="text-sm text-neutral-400">Click-to-Open Rate</div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats.opened > 0 ? formatPercent(stats.clicked / stats.opened) : "—"}
          </div>
          <div className="text-sm text-neutral-500 mt-1">clicks / opens</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-4 border border-neutral-700">
          <div className="text-sm text-neutral-400">Failed</div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats.totalRecipients - stats.sent}
          </div>
          <div className="text-sm text-neutral-500 mt-1">not sent</div>
        </div>
      </div>

      {/* Visual Progress Bars */}
      <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700 mb-6">
        <h2 className="text-lg font-bold text-white mb-4">Funnel</h2>
        <div className="space-y-4">
          {/* Sent */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-300">Sent</span>
              <span className="text-white">{stats.sent.toLocaleString()}</span>
            </div>
            <div className="h-4 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-500 rounded-full"
                style={{ width: `${stats.totalRecipients > 0 ? (stats.sent / stats.totalRecipients) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Delivered */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-300">Delivered</span>
              <span className="text-white">{stats.delivered.toLocaleString()} ({formatPercent(stats.deliveryRate)})</span>
            </div>
            <div className="h-4 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 rounded-full"
                style={{ width: `${stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Opened */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-300">Opened</span>
              <span className="text-white">{stats.opened.toLocaleString()} ({formatPercent(stats.openRate)})</span>
            </div>
            <div className="h-4 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0}%` }}
              />
            </div>
          </div>
          {/* Clicked */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-300">Clicked</span>
              <span className="text-white">{stats.clicked.toLocaleString()} ({formatPercent(stats.clickRate)})</span>
            </div>
            <div className="h-4 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-600 rounded-full"
                style={{ width: `${stats.delivered > 0 ? (stats.clicked / stats.delivered) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-bold text-white">Recent Events</h2>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
          >
            <option value="">All Events</option>
            <option value="opened">Opened</option>
            <option value="clicked">Clicked</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
        </div>

        {eventsLoading ? (
          <div className="text-center py-8 text-neutral-400">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No events recorded yet</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-neutral-800">
                <tr className="border-b border-neutral-700">
                  <th className="text-left px-4 py-2 text-sm font-medium text-neutral-400">Event</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-neutral-400">Email</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-neutral-400">Details</th>
                  <th className="text-left px-4 py-2 text-sm font-medium text-neutral-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-neutral-700/50 hover:bg-neutral-700/30">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <span>{EVENT_ICONS[event.eventType] || "📧"}</span>
                        <span className="text-white text-sm capitalize">{event.eventType}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-300 text-sm">{event.email}</td>
                    <td className="px-4 py-2 text-neutral-400 text-sm">
                      {event.metadata?.url && (
                        <span className="truncate block max-w-xs" title={event.metadata.url}>
                          {event.metadata.url}
                        </span>
                      )}
                      {event.metadata?.reason && (
                        <span className="text-red-400">{event.metadata.reason}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-neutral-400 text-sm whitespace-nowrap">
                      {formatDate(event.occurredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
