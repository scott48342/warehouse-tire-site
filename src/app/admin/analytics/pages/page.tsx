"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PagesData {
  generated: string;
  period: string;
  totals: {
    totalViews: number;
    uniquePaths: number;
    uniqueSessions: number;
  };
  pages: Array<{
    path: string;
    views: number;
    uniqueSessions: number;
    firstViewed: string;
    lastViewed: string;
  }>;
}

export default function PagesReportPage() {
  const [data, setData] = useState<PagesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/pages?days=${days}&limit=100`);
      if (!res.ok) throw new Error("Failed to load pages report");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "-";
    }
  };

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-7xl text-center py-20 text-neutral-500">
          Loading pages report...
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
              📄 Pages Report
            </h1>
            <p className="text-neutral-500 mt-1">{data?.period || ""}</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value={1}>Today</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm hover:bg-neutral-700"
            >
              Refresh
            </button>
            <Link
              href="/admin/analytics"
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {data && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="text-sm font-medium text-neutral-500">
                  Total Page Views
                </div>
                <div className="text-3xl font-bold text-neutral-900 mt-1">
                  {data.totals.totalViews}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="text-sm font-medium text-neutral-500">
                  Unique Pages
                </div>
                <div className="text-3xl font-bold text-neutral-900 mt-1">
                  {data.totals.uniquePaths}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="text-sm font-medium text-neutral-500">
                  Unique Sessions
                </div>
                <div className="text-3xl font-bold text-neutral-900 mt-1">
                  {data.totals.uniqueSessions}
                </div>
              </div>
            </div>

            {/* Pages Table */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">
                      Path
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                      Views
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                      Sessions
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                      First Viewed
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700">
                      Last Viewed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.pages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-neutral-400"
                      >
                        No page views recorded yet
                      </td>
                    </tr>
                  ) : (
                    data.pages.map((page, i) => (
                      <tr
                        key={page.path}
                        className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}
                      >
                        <td className="px-4 py-3 font-mono text-sm text-neutral-700">
                          {page.path}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                          {page.views}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-600">
                          {page.uniqueSessions}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-500">
                          {formatDate(page.firstViewed)}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-500">
                          {formatDate(page.lastViewed)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-neutral-200 flex gap-4">
          <Link href="/admin" className="text-neutral-600 hover:underline">
            ← Admin Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
