"use client";

/**
 * Conversion Dashboard
 * 
 * URL: /admin/conversions
 * 
 * Tracks key conversion metrics:
 * - Vehicle Saves / Restores / Garage Users
 * - Quick View Opens
 * - Jake Conversations
 * - Package Builder Entries
 * - Cart Adds → Checkout → Orders
 */

import { useState, useEffect, useCallback } from "react";

interface ConversionData {
  ok: boolean;
  period: string;
  startDate: string;
  endDate: string;
  metrics: {
    vehicleSaves: number;
    vehicleRestores: number;
    garageUsers: number;
    quickViewOpens: number;
    jakeConversations: number;
    packageBuilderEntries: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    orderValue: number;
  };
  conversionRates: {
    garageToCart: string;
    quickViewToCart: string;
    packageBuilderToCart: string;
    cartToCheckout: string;
    checkoutToOrder: string;
  };
  dailyTrend: Array<{
    date: string;
    vehicleSaves: number;
    quickViews: number;
    packageBuilder: number;
    cartAdds: number;
    orders: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function MetricCard({
  title,
  value,
  icon,
  subtitle,
  color = "gray",
}: {
  title: string;
  value: number | string;
  icon: string;
  subtitle?: string;
  color?: "gray" | "green" | "blue" | "red" | "purple" | "orange";
}) {
  const colorClasses = {
    gray: "bg-gray-50 border-gray-200",
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    red: "bg-red-50 border-red-200",
    purple: "bg-purple-50 border-purple-200",
    orange: "bg-orange-50 border-orange-200",
  };

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function ConversionRate({
  label,
  rate,
  from,
  to,
}: {
  label: string;
  rate: string;
  from: number;
  to: number;
}) {
  const rateNum = parseFloat(rate);
  const color = rateNum >= 50 ? "text-green-600" : rateNum >= 20 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">
          {from.toLocaleString()} → {to.toLocaleString()}
        </p>
      </div>
      <span className={`text-xl font-bold ${color}`}>{rate}%</span>
    </div>
  );
}

function TrendChart({ data }: { data: ConversionData["dailyTrend"] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-400">
        No trend data available
      </div>
    );
  }

  const maxOrders = Math.max(...data.map(d => d.orders), 1);
  const maxCarts = Math.max(...data.map(d => d.cartAdds), 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-2">Orders per day</p>
        <div className="flex items-end gap-1 h-16">
          {data.map((day, idx) => {
            const height = (day.orders / maxOrders) * 100;
            return (
              <div
                key={idx}
                className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-600"
                style={{ height: `${Math.max(height, 4)}%` }}
                title={`${day.date}: ${day.orders} orders`}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-2">Cart Adds per day</p>
        <div className="flex items-end gap-1 h-16">
          {data.map((day, idx) => {
            const height = (day.cartAdds / maxCarts) * 100;
            return (
              <div
                key={idx}
                className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                style={{ height: `${Math.max(height, 4)}%` }}
                title={`${day.date}: ${day.cartAdds} cart adds`}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConversionDashboard() {
  const [data, setData] = useState<ConversionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d">("7d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/conversions?period=${period}`);
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
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📊 Conversion Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Track engagement and conversion metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as "7d" | "30d")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
          <p className="text-sm text-red-500 mt-1">
            Make sure the funnel_events table exists and has data.
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
        </div>
      )}

      {/* Dashboard Content */}
      {data && (
        <div className="space-y-6">
          {/* Top Row: Key Engagement Metrics */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              🚗 Engagement
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Vehicle Saves"
                value={data.metrics.vehicleSaves}
                icon="🚘"
                subtitle="Saved to garage"
                color="blue"
              />
              <MetricCard
                title="Vehicle Restores"
                value={data.metrics.vehicleRestores}
                icon="🔄"
                subtitle="Switched to saved"
              />
              <MetricCard
                title="Garage Users"
                value={data.metrics.garageUsers}
                icon="🏠"
                subtitle="Unique users"
              />
              <MetricCard
                title="Quick View Opens"
                value={data.metrics.quickViewOpens}
                icon="👁️"
                color="purple"
              />
              <MetricCard
                title="Jake Conversations"
                value={data.metrics.jakeConversations}
                icon="🤖"
                subtitle="AI assistant chats"
                color="orange"
              />
            </div>
          </div>

          {/* Middle Row: Funnel Metrics */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              🛒 Purchase Funnel
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Package Builder Entries"
                value={data.metrics.packageBuilderEntries}
                icon="📦"
                color="blue"
              />
              <MetricCard
                title="Cart Adds"
                value={data.metrics.cartAdds}
                icon="🛒"
                color="blue"
              />
              <MetricCard
                title="Checkout Starts"
                value={data.metrics.checkoutStarts}
                icon="💳"
                color="purple"
              />
              <MetricCard
                title="Orders"
                value={data.metrics.orders}
                icon="✅"
                subtitle={`$${data.metrics.orderValue.toLocaleString()} revenue`}
                color="green"
              />
            </div>
          </div>

          {/* Conversion Rates + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Rates */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📈 Conversion Rates
              </h3>
              <div className="space-y-1">
                <ConversionRate
                  label="Garage → Cart"
                  rate={data.conversionRates.garageToCart}
                  from={data.metrics.vehicleSaves}
                  to={data.metrics.cartAdds}
                />
                <ConversionRate
                  label="Quick View → Cart"
                  rate={data.conversionRates.quickViewToCart}
                  from={data.metrics.quickViewOpens}
                  to={data.metrics.cartAdds}
                />
                <ConversionRate
                  label="Package Builder → Cart"
                  rate={data.conversionRates.packageBuilderToCart}
                  from={data.metrics.packageBuilderEntries}
                  to={data.metrics.cartAdds}
                />
                <ConversionRate
                  label="Cart → Checkout"
                  rate={data.conversionRates.cartToCheckout}
                  from={data.metrics.cartAdds}
                  to={data.metrics.checkoutStarts}
                />
                <ConversionRate
                  label="Checkout → Order"
                  rate={data.conversionRates.checkoutToOrder}
                  from={data.metrics.checkoutStarts}
                  to={data.metrics.orders}
                />
              </div>
            </div>

            {/* Daily Trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📅 Daily Trend
              </h3>
              <TrendChart data={data.dailyTrend} />
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-gray-400 text-right">
            Period: {new Date(data.startDate).toLocaleDateString()} - {new Date(data.endDate).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
