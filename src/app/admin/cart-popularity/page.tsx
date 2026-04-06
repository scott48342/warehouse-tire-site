"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalEvents: number;
  tireEvents: number;
  wheelEvents: number;
  purchasedEvents: number;
  uniqueProducts: number;
  uniqueCarts: number;
  topBrands: { brand: string; count: number }[];
}

function StatCard({
  label,
  value,
  subtext,
  href,
}: {
  label: string;
  value: number | string;
  subtext?: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-white rounded-xl border border-neutral-200 p-6 ${href ? "hover:border-neutral-300 hover:shadow-sm transition-all" : ""}`}>
      <div className="text-sm font-medium text-neutral-500">{label}</div>
      <div className="text-3xl font-bold text-neutral-900 mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {subtext && (
        <div className="text-xs text-neutral-400 mt-1">{subtext}</div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function CartPopularityDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cart-popularity?action=stats&days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const conversionRate = stats && stats.totalEvents > 0
    ? Math.round((stats.purchasedEvents / stats.totalEvents) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900">
              🛒 Cart Product Popularity
            </h1>
            <p className="text-neutral-500 mt-1">
              Track which products customers are adding to cart
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-neutral-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={loadStats}
              className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm hover:bg-neutral-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && !stats && (
          <div className="text-center py-20 text-neutral-500">
            Loading statistics...
          </div>
        )}

        {/* Stats */}
        {stats && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Add-to-Carts"
                value={stats.totalEvents}
                subtext={`Last ${days} days`}
              />
              <StatCard
                label="Unique Products"
                value={stats.uniqueProducts}
              />
              <StatCard
                label="Unique Carts"
                value={stats.uniqueCarts}
              />
              <StatCard
                label="Conversion Rate"
                value={`${conversionRate}%`}
                subtext={`${stats.purchasedEvents} purchased`}
              />
            </div>

            {/* Category Cards */}
            <h2 className="text-xl font-bold text-neutral-900 mb-4">
              Browse by Category
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Tires Card */}
              <Link
                href="/admin/cart-popularity/tires"
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-red-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl mb-2">🔴</div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      Top Tires
                    </h3>
                    <p className="text-neutral-500 mt-1">
                      {stats.tireEvents.toLocaleString()} add-to-carts
                    </p>
                  </div>
                  <div className="text-4xl text-neutral-300 group-hover:text-red-400 transition-colors">
                    →
                  </div>
                </div>
              </Link>

              {/* Wheels Card */}
              <Link
                href="/admin/cart-popularity/wheels"
                className="bg-white rounded-xl border border-neutral-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl mb-2">⚙️</div>
                    <h3 className="text-xl font-bold text-neutral-900">
                      Top Wheels
                    </h3>
                    <p className="text-neutral-500 mt-1">
                      {stats.wheelEvents.toLocaleString()} add-to-carts
                    </p>
                  </div>
                  <div className="text-4xl text-neutral-300 group-hover:text-blue-400 transition-colors">
                    →
                  </div>
                </div>
              </Link>
            </div>

            {/* Top Brands */}
            {stats.topBrands.length > 0 && (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-200">
                  <h3 className="font-semibold text-neutral-900">
                    🏆 Top Brands (All Products)
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-neutral-600">
                        Rank
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-600">
                        Brand
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-neutral-600">
                        Add-to-Carts
                      </th>
                      <th className="px-4 py-2 text-right font-medium text-neutral-600">
                        % of Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topBrands.map((brand, i) => (
                      <tr key={brand.brand} className="border-t border-neutral-100">
                        <td className="px-4 py-2 text-neutral-500">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-neutral-900">
                          {brand.brand}
                        </td>
                        <td className="px-4 py-2 text-right text-neutral-700">
                          {brand.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-neutral-500">
                          {stats.totalEvents > 0
                            ? `${Math.round((brand.count / stats.totalEvents) * 100)}%`
                            : "0%"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-neutral-200 flex gap-4">
          <Link href="/admin" className="text-neutral-600 hover:underline">
            ← Dashboard
          </Link>
          <Link href="/admin/analytics" className="text-neutral-600 hover:underline">
            Site Analytics
          </Link>
          <Link href="/admin/abandoned-carts" className="text-neutral-600 hover:underline">
            Abandoned Carts
          </Link>
        </div>
      </div>
    </main>
  );
}
