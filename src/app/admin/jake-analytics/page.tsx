"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Jake Analytics Dashboard
 * 
 * Tracks Jake's impact on engagement, product discovery, carts, and revenue.
 * 
 * @created 2026-05-14
 */

interface JakeAnalytics {
  kpis: {
    opens: number;
    conversations: number;
    carts: number;
    checkouts: number;
    productClicks: number;
    recommendations: number;
    cartValue: number;
    orderValue: number;
    conversionRates: {
      conversationToCart: string;
      cartToCheckout: string;
      openToConversation: string;
    };
  };
  funnel: {
    steps: string[];
    counts: Record<string, number>;
  };
  intents: {
    top: Array<{ intent: string; count: number }>;
    recentPrompts: Array<{ prompt: string; intent: string | null; createdAt: string }>;
  };
  vehicles: Array<{ year: string; make: string; model: string; count: number }>;
  products: Array<{
    sku: string;
    brand: string;
    model: string;
    type: string;
    recommended: number;
    clicks: number;
    clickRate: string;
  }>;
  packages: {
    total: number;
    byType: Array<{ type: string; count: number; avgValue: string }>;
  };
  errors: {
    recent: Array<{
      id: string;
      errorType: string;
      errorMessage: string;
      requestId: string;
      prompt: string;
      createdAt: string;
    }>;
    byType: Array<{ type: string; count: number }>;
  };
  dailyTrend: Array<{
    date: string;
    opens: number;
    conversations: number;
    carts: number;
    checkouts: number;
  }>;
  meta: {
    range: string;
    startDate: string;
    includeTest: boolean;
    hostname: string | null;
    generatedAt: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function KPICard({ 
  title, 
  value, 
  subtitle,
  trend,
  icon,
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  trend?: string;
  icon: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && <p className="text-xs text-green-600 mt-1">{trend}</p>}
        </div>
        <div className="text-2xl">{icon}</div>
      </div>
    </div>
  );
}

function FunnelChart({ funnel }: { funnel: JakeAnalytics["funnel"] }) {
  const maxCount = Math.max(...Object.values(funnel.counts), 1);
  
  const stepLabels: Record<string, string> = {
    jake_opened: "Jake Opened",
    conversation_started: "Conversation Started",
    product_recommended: "Products Shown",
    product_clicked: "Product Clicked",
    cart_created: "Cart Created",
    checkout_started: "Checkout Started",
    purchase_completed: "Purchase Completed",
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
      <div className="space-y-3">
        {funnel.steps.map((step, idx) => {
          const count = funnel.counts[step] || 0;
          const prevCount = idx > 0 ? funnel.counts[funnel.steps[idx - 1]] || 0 : count;
          const dropoff = prevCount > 0 ? ((1 - count / prevCount) * 100).toFixed(0) : "0";
          const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
          
          return (
            <div key={step} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {stepLabels[step] || step}
                </span>
                <span className="text-sm text-gray-500">
                  {count.toLocaleString()}
                  {idx > 0 && prevCount > 0 && count < prevCount && (
                    <span className="text-red-500 ml-2 text-xs">
                      -{dropoff}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IntentsTable({ intents }: { intents: JakeAnalytics["intents"] }) {
  const intentLabels: Record<string, string> = {
    budget: "💰 Budget/Cheap",
    all_terrain: "🏔️ All-Terrain",
    mud_terrain: "🪨 Mud-Terrain",
    highway: "🛣️ Highway/Quiet",
    towing: "🚛 Towing",
    lifted_truck: "📏 Lifted/35s",
    package: "📦 Wheel+Tire Package",
    wheels: "🔘 Wheels Only",
    black_wheels: "⚫ Black Wheels",
    fitment_question: "❓ Fitment Question",
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Intents</h3>
      {intents.top.length === 0 ? (
        <p className="text-gray-500 text-sm">No intent data yet</p>
      ) : (
        <div className="space-y-2">
          {intents.top.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">
                {intentLabels[item.intent] || item.intent}
              </span>
              <span className="text-sm font-medium text-gray-900">{item.count}</span>
            </div>
          ))}
        </div>
      )}
      
      {intents.recentPrompts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Prompts</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {intents.recentPrompts.map((item, idx) => (
              <div key={idx} className="text-xs text-gray-600 py-1 border-b border-gray-50">
                <p className="truncate">{item.prompt}</p>
                <p className="text-gray-400 text-[10px]">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VehiclesTable({ vehicles }: { vehicles: JakeAnalytics["vehicles"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Vehicles</h3>
      {vehicles.length === 0 ? (
        <p className="text-gray-500 text-sm">No vehicle data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Vehicle</th>
                <th className="text-right py-2 text-gray-500 font-medium">Searches</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2 text-gray-700">
                    {v.year} {v.make} {v.model}
                  </td>
                  <td className="py-2 text-right font-medium text-gray-900">{v.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductsTable({ products }: { products: JakeAnalytics["products"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Performance</h3>
      {products.length === 0 ? (
        <p className="text-gray-500 text-sm">No product data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                <th className="text-center py-2 text-gray-500 font-medium">Type</th>
                <th className="text-right py-2 text-gray-500 font-medium">Shown</th>
                <th className="text-right py-2 text-gray-500 font-medium">Clicks</th>
                <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2">
                    <div className="text-gray-700 font-medium">{p.brand} {p.model}</div>
                    <div className="text-gray-400 text-xs">{p.sku}</div>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      p.type === "wheel" ? "bg-blue-100 text-blue-700" :
                      p.type === "tire" ? "bg-green-100 text-green-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>
                      {p.type || "unknown"}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-700">{p.recommended}</td>
                  <td className="py-2 text-right text-gray-700">{p.clicks}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{p.clickRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PackagesCard({ packages }: { packages: JakeAnalytics["packages"] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Cart Breakdown</h3>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {packages.byType.map((item, idx) => (
          <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">{item.count}</p>
            <p className="text-xs text-gray-500 capitalize">{item.type || "unknown"}</p>
            <p className="text-xs text-green-600">${item.avgValue} avg</p>
          </div>
        ))}
      </div>
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Package Carts (wheel+tire)</span>
          <span className="text-lg font-bold text-gray-900">{packages.total}</span>
        </div>
      </div>
    </div>
  );
}

function ErrorsLog({ errors }: { errors: JakeAnalytics["errors"] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? errors.recent : errors.recent.slice(0, 5);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Errors & Failures</h3>
        {errors.byType.length > 0 && (
          <div className="flex gap-2">
            {errors.byType.slice(0, 3).map((e, idx) => (
              <span key={idx} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                {e.type}: {e.count}
              </span>
            ))}
          </div>
        )}
      </div>
      
      {errors.recent.length === 0 ? (
        <p className="text-gray-500 text-sm">No errors recorded 🎉</p>
      ) : (
        <>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {displayed.map((error, idx) => (
              <div key={idx} className="p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-red-700">{error.errorType}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(error.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">{error.errorMessage}</p>
                {error.prompt && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    Prompt: {error.prompt}
                  </p>
                )}
                {error.requestId && (
                  <p className="text-xs text-gray-400 mt-1">
                    Request: {error.requestId}
                  </p>
                )}
              </div>
            ))}
          </div>
          {errors.recent.length > 5 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-3 text-sm text-red-600 hover:text-red-700"
            >
              {showAll ? "Show less" : `Show all ${errors.recent.length} errors`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DailyTrendChart({ trend }: { trend: JakeAnalytics["dailyTrend"] }) {
  if (trend.length === 0) return null;
  
  const maxVal = Math.max(
    ...trend.map(d => Math.max(d.opens || 0, d.conversations || 0, d.carts || 0))
  );
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Trend</h3>
      <div className="flex gap-1 items-end h-32">
        {[...trend].reverse().map((day, idx) => {
          const height = maxVal > 0 ? ((day.conversations || 0) / maxVal) * 100 : 0;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-red-500 rounded-t transition-all"
                style={{ height: `${height}%`, minHeight: day.conversations ? 4 : 0 }}
                title={`${day.date}: ${day.conversations} conversations, ${day.carts} carts`}
              />
              <span className="text-[9px] text-gray-400 mt-1 rotate-[-45deg] origin-left">
                {new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-4 justify-center text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded" /> Conversations
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JakeAnalyticsPage() {
  const [data, setData] = useState<JakeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("7d");
  const [includeTest, setIncludeTest] = useState(false);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (includeTest) params.set("includeTest", "1");
      
      const res = await fetch(`/api/admin/jake-analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range, includeTest]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">🤖</span> Jake Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            AI assistant performance and conversion tracking
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          
          {/* Include Test Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="rounded border-gray-300"
            />
            Include test
          </label>
          
          {/* Refresh */}
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <KPICard
              title="Jake Opens"
              value={data.kpis.opens.toLocaleString()}
              icon="👀"
            />
            <KPICard
              title="Conversations"
              value={data.kpis.conversations.toLocaleString()}
              subtitle={`${data.kpis.conversionRates.openToConversation}% of opens`}
              icon="💬"
            />
            <KPICard
              title="Carts Created"
              value={data.kpis.carts.toLocaleString()}
              subtitle={`${data.kpis.conversionRates.conversationToCart}% conv rate`}
              icon="🛒"
            />
            <KPICard
              title="Checkouts"
              value={data.kpis.checkouts.toLocaleString()}
              subtitle={`${data.kpis.conversionRates.cartToCheckout}% of carts`}
              icon="💳"
            />
            <KPICard
              title="Cart Value"
              value={`$${data.kpis.cartValue.toLocaleString()}`}
              subtitle="Total assisted"
              icon="💰"
            />
            <KPICard
              title="Product Clicks"
              value={data.kpis.productClicks.toLocaleString()}
              icon="👆"
            />
          </div>
          
          {/* Funnel + Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FunnelChart funnel={data.funnel} />
            <DailyTrendChart trend={data.dailyTrend} />
          </div>
          
          {/* Intents + Vehicles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <IntentsTable intents={data.intents} />
            <VehiclesTable vehicles={data.vehicles} />
          </div>
          
          {/* Products */}
          <ProductsTable products={data.products} />
          
          {/* Packages + Errors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PackagesCard packages={data.packages} />
            <ErrorsLog errors={data.errors} />
          </div>
          
          {/* Meta Info */}
          <div className="text-xs text-gray-400 text-right">
            Data from {new Date(data.meta.startDate).toLocaleDateString()} • 
            Generated {new Date(data.meta.generatedAt).toLocaleTimeString()}
            {data.meta.includeTest && " • Including test data"}
          </div>
        </div>
      )}
    </div>
  );
}
