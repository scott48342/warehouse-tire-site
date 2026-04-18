"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AnalyticsData {
  generated: string;
  excludingBots: boolean;
  siteFilter: string;
  availableSites: string[];
  summary: {
    visitsToday: number;
    visitsWeek: number;
    pageViewsToday: number;
    pageViewsWeek: number;
    botsWeek: number;
  };
  topLandingPages: Array<{ page: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  topCampaigns: Array<{
    source: string;
    medium: string;
    campaign: string;
    count: number;
  }>;
  deviceBreakdown: Array<{ device: string; count: number }>;
}

const SITE_LABELS: Record<string, { label: string; icon: string }> = {
  all: { label: "All Sites", icon: "🌐" },
  national: { label: "National", icon: "🏪" },
  local: { label: "Local Shop", icon: "🔧" },
  pos: { label: "POS", icon: "💳" },
};

function StatCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: number | string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-6">
      <div className="text-sm font-medium text-neutral-500">{label}</div>
      <div className="text-3xl font-bold text-neutral-900 mt-1">{value}</div>
      {subtext && (
        <div className="text-xs text-neutral-400 mt-1">{subtext}</div>
      )}
    </div>
  );
}

function TableCard({
  title,
  data,
  columns,
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  columns: Array<{ key: string; label: string; format?: (v: unknown) => string }>;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-200">
        <h3 className="font-semibold text-neutral-900">{title}</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-4 text-neutral-400 text-sm">No data yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2 text-left font-medium text-neutral-600"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-neutral-100">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-neutral-700">
                    {col.format
                      ? col.format(row[col.key])
                      : String(row[col.key] || "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeBots, setIncludeBots] = useState(false);
  const [siteFilter, setSiteFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [includeBots, siteFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeBots) params.set("bots", "include");
      if (siteFilter && siteFilter !== "all") params.set("site", siteFilter);
      const url = `/api/admin/analytics${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-7xl text-center py-20 text-neutral-500">
          Loading analytics...
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-7xl text-center py-20 text-red-500">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900">
              📊 Analytics
            </h1>
            <p className="text-neutral-500 mt-1">
              Last updated: {data?.generated ? new Date(data.generated).toLocaleString() : "-"}
              {siteFilter !== "all" && (
                <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {SITE_LABELS[siteFilter]?.icon} {SITE_LABELS[siteFilter]?.label}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Site Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">Site:</span>
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {Object.entries(SITE_LABELS).map(([key, { label, icon }]) => (
                  <option key={key} value={key}>
                    {icon} {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeBots}
                onChange={(e) => setIncludeBots(e.target.checked)}
                className="rounded"
              />
              Include bots
            </label>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm hover:bg-neutral-700"
            >
              Refresh
            </button>
            <Link
              href="/admin/analytics/pages"
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Pages Report →
            </Link>
          </div>
        </div>

        {data && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Visits Today"
                value={data.summary.visitsToday}
                subtext="Unique sessions"
              />
              <StatCard
                label="Visits (7 days)"
                value={data.summary.visitsWeek}
                subtext="Unique sessions"
              />
              <StatCard
                label="Page Views Today"
                value={data.summary.pageViewsToday}
              />
              <StatCard
                label="Page Views (7 days)"
                value={data.summary.pageViewsWeek}
              />
            </div>

            {/* Site filter notice */}
            {siteFilter !== "all" && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                📍 Showing data for <strong>{SITE_LABELS[siteFilter]?.label}</strong> only.
                {" "}Site tracking started April 18, 2026 — older visits won't have site data.
              </div>
            )}

            {/* Bot count info */}
            {data.summary.botsWeek > 0 && !includeBots && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                📝 {data.summary.botsWeek} bot visits excluded from stats this week.
                <button
                  onClick={() => setIncludeBots(true)}
                  className="ml-2 underline"
                >
                  Show with bots
                </button>
              </div>
            )}

            {/* Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Landing Pages */}
              <TableCard
                title="🚪 Top Landing Pages (7 days)"
                data={data.topLandingPages}
                columns={[
                  { key: "page", label: "Page" },
                  { key: "count", label: "Visits" },
                ]}
              />

              {/* Top Viewed Pages */}
              <TableCard
                title="📄 Most Viewed Pages (7 days)"
                data={data.topPages}
                columns={[
                  { key: "page", label: "Page" },
                  { key: "count", label: "Views" },
                ]}
              />

              {/* Top Referrers */}
              <TableCard
                title="🔗 Top Referrers (7 days)"
                data={data.topReferrers}
                columns={[
                  {
                    key: "referrer",
                    label: "Referrer",
                    format: (v) => {
                      try {
                        return new URL(String(v)).hostname;
                      } catch {
                        return String(v || "-");
                      }
                    },
                  },
                  { key: "count", label: "Visits" },
                ]}
              />

              {/* UTM Campaigns */}
              <TableCard
                title="📣 UTM Campaigns (7 days)"
                data={data.topCampaigns}
                columns={[
                  { key: "source", label: "Source" },
                  { key: "medium", label: "Medium" },
                  { key: "campaign", label: "Campaign" },
                  { key: "count", label: "Visits" },
                ]}
              />

              {/* Device Breakdown */}
              <TableCard
                title="📱 Devices (7 days)"
                data={data.deviceBreakdown}
                columns={[
                  {
                    key: "device",
                    label: "Device",
                    format: (v) =>
                      String(v || "unknown").charAt(0).toUpperCase() +
                      String(v || "unknown").slice(1),
                  },
                  { key: "count", label: "Visits" },
                ]}
              />
            </div>
          </>
        )}

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-neutral-200 flex gap-4">
          <Link href="/admin" className="text-neutral-600 hover:underline">
            ← Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
