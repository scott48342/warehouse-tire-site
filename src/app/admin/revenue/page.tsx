"use client";

/**
 * Revenue Dashboard
 * 
 * URL: /admin/revenue
 * 
 * Comprehensive revenue analytics:
 * - Revenue by period (today, 7d, 30d)
 * - Orders and AOV
 * - Attribution (Jake, Garage, Quick View, Package)
 * - Top performers
 */

import { useState, useEffect, useCallback } from "react";

interface RevenueData {
  ok: boolean;
  generatedAt: string;
  revenue: { today: number; days7: number; days30: number };
  orders: { today: number; days7: number; days30: number };
  aov: { days7: number; days30: number };
  packages: { orders: number; revenue: number };
  attribution: {
    jake: { orders: number; revenue: number };
    garage: { orders: number; revenue: number };
    quickView: { orders: number; revenue: number };
  };
  topVehicles: Array<{ vehicle: string; orders: number; revenue: number }>;
  topPackages: Array<{ wheel: string; tire: string; orders: number; revenue: number }>;
  topTireSizes: Array<{ size: string; orders: number; revenue: number }>;
  dailyTrend: Array<{ date: string; orders: number; revenue: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function RevenueCard({
  title,
  value,
  subtitle,
  icon,
  color = "gray",
  large = false,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color?: "gray" | "green" | "blue" | "red" | "purple" | "orange" | "amber";
  large?: boolean;
}) {
  const colorClasses = {
    gray: "bg-gray-50 border-gray-200",
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
    purple: "bg-purple-50 border-purple-200",
    orange: "bg-orange-50 border-orange-200",
    amber: "bg-amber-50 border-amber-200",
  };

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`mt-1 font-bold text-gray-900 ${large ? 'text-4xl' : 'text-2xl'}`}>
            {typeof value === 'number' ? formatCurrency(value) : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <span className={large ? "text-3xl" : "text-2xl"}>{icon}</span>
      </div>
    </div>
  );
}

function AttributionCard({
  title,
  orders,
  revenue,
  icon,
  color,
}: {
  title: string;
  orders: number;
  revenue: number;
  icon: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue)}</p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{orders}</p>
          <p className="text-xs text-gray-500">Orders</p>
        </div>
      </div>
    </div>
  );
}

function TopList({
  title,
  items,
  icon,
  renderItem,
}: {
  title: string;
  items: any[];
  icon: string;
  renderItem: (item: any, idx: number) => React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No data yet</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item, idx) => (
            <div key={idx}>{renderItem(item, idx)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendChart({ data }: { data: RevenueData["dailyTrend"] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-400">
        No trend data
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {data.map((day, idx) => {
          const height = (day.revenue / maxRevenue) * 100;
          return (
            <div
              key={idx}
              className="flex-1 bg-green-500 hover:bg-green-600 rounded-t transition-all cursor-pointer group relative"
              style={{ height: `${Math.max(height, 4)}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {formatCurrency(day.revenue)} • {day.orders} orders
                <div className="text-gray-400">{new Date(day.date).toLocaleDateString()}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue");
      if (!res.ok) throw new Error("Failed to fetch data");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      } else {
        setError(json.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            💰 Revenue Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Sales performance and attribution
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      )}

      {/* Dashboard */}
      {data && (
        <div className="space-y-6">
          {/* Revenue Row */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              💵 Revenue
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RevenueCard
                title="Revenue Today"
                value={data.revenue.today}
                subtitle={`${data.orders.today} orders`}
                icon="📅"
                color="green"
                large
              />
              <RevenueCard
                title="Revenue 7 Days"
                value={data.revenue.days7}
                subtitle={`${data.orders.days7} orders • ${formatCurrency(data.aov.days7)} AOV`}
                icon="📆"
                color="blue"
              />
              <RevenueCard
                title="Revenue 30 Days"
                value={data.revenue.days30}
                subtitle={`${data.orders.days30} orders • ${formatCurrency(data.aov.days30)} AOV`}
                icon="🗓️"
                color="purple"
              />
            </div>
          </div>

          {/* Orders & AOV Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <RevenueCard
              title="Orders (30d)"
              value={data.orders.days30.toString()}
              icon="📦"
            />
            <RevenueCard
              title="AOV (30d)"
              value={data.aov.days30}
              icon="💳"
            />
            <RevenueCard
              title="Package Orders"
              value={data.packages.orders.toString()}
              subtitle={formatCurrency(data.packages.revenue)}
              icon="📦"
              color="amber"
            />
            <RevenueCard
              title="Package Revenue"
              value={data.packages.revenue}
              icon="🎁"
              color="amber"
            />
          </div>

          {/* Attribution Row */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              🎯 Revenue Attribution (30 Days)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AttributionCard
                title="Jake Assisted"
                orders={data.attribution.jake.orders}
                revenue={data.attribution.jake.revenue}
                icon="🤖"
                color="bg-red-50 border-red-200"
              />
              <AttributionCard
                title="Garage Users"
                orders={data.attribution.garage.orders}
                revenue={data.attribution.garage.revenue}
                icon="🏠"
                color="bg-blue-50 border-blue-200"
              />
              <AttributionCard
                title="Quick View"
                orders={data.attribution.quickView.orders}
                revenue={data.attribution.quickView.revenue}
                icon="👁️"
                color="bg-purple-50 border-purple-200"
              />
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              📈 Daily Revenue (30 Days)
            </h3>
            <TrendChart data={data.dailyTrend} />
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Vehicles */}
            <TopList
              title="Top Vehicles"
              items={data.topVehicles}
              icon="🚗"
              renderItem={(item, idx) => (
                <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-4">{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-900">{item.vehicle}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(item.revenue)}</p>
                    <p className="text-xs text-gray-500">{item.orders} orders</p>
                  </div>
                </div>
              )}
            />

            {/* Top Packages */}
            <TopList
              title="Top Packages"
              items={data.topPackages}
              icon="📦"
              renderItem={(item, idx) => (
                <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-4">{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.wheel}</p>
                      <p className="text-xs text-gray-500">+ {item.tire}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(item.revenue)}</p>
                    <p className="text-xs text-gray-500">{item.orders} orders</p>
                  </div>
                </div>
              )}
            />

            {/* Top Tire Sizes */}
            <TopList
              title="Top Tire Sizes"
              items={data.topTireSizes}
              icon="🛞"
              renderItem={(item, idx) => (
                <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-4">{idx + 1}</span>
                    <span className="text-sm font-medium text-gray-900">{item.size}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(item.revenue)}</p>
                    <p className="text-xs text-gray-500">{item.orders} orders</p>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 text-right">
            Last updated: {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
