"use client";

import { useState, useEffect, useCallback } from "react";

interface ProductRow {
  sku: string;
  productName: string;
  brand: string;
  latestPrice: number;
  addToCartCount: number;
  uniqueCarts: number;
  purchasedCount: number;
  conversionRate: number;
  lastAddedAt: string;
}

interface PopularityReport {
  productType: "tire" | "wheel";
  period: string;
  products: ProductRow[];
  total: number;
}

interface PopularityStats {
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
}: {
  label: string;
  value: number | string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="text-sm font-medium text-neutral-500">{label}</div>
      <div className="text-2xl font-bold text-neutral-900 mt-1">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {subtext && (
        <div className="text-xs text-neutral-400 mt-1">{subtext}</div>
      )}
    </div>
  );
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PopularityTable({
  productType,
  title,
  emoji,
}: {
  productType: "tire" | "wheel";
  title: string;
  emoji: string;
}) {
  const [data, setData] = useState<PopularityReport | null>(null);
  const [stats, setStats] = useState<PopularityStats | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [days, setDays] = useState(30);
  const [brand, setBrand] = useState<string>("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [includeTest, setIncludeTest] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build URL
      const params = new URLSearchParams({
        type: productType,
        days: String(days),
        limit: String(limit),
        offset: String(offset),
      });
      if (brand) params.set("brand", brand);
      if (includeTest) params.set("includeTest", "true");

      const res = await fetch(`/api/admin/cart-popularity?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load data");
      }
      const report = await res.json();
      setData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [productType, days, brand, limit, offset, includeTest]);

  const loadStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        action: "stats",
        days: String(days),
      });
      if (includeTest) params.set("includeTest", "true");

      const res = await fetch(`/api/admin/cart-popularity?${params}`);
      if (res.ok) {
        const statsData = await res.json();
        setStats(statsData);
      }
    } catch (err) {
      console.warn("Failed to load stats:", err);
    }
  }, [days, includeTest]);

  const loadBrands = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/cart-popularity?action=brands&type=${productType}`
      );
      if (res.ok) {
        const { brands: brandList } = await res.json();
        setBrands(brandList);
      }
    } catch (err) {
      console.warn("Failed to load brands:", err);
    }
  }, [productType]);

  useEffect(() => {
    loadData();
    loadStats();
    loadBrands();
  }, [loadData, loadStats, loadBrands]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [days, brand, limit, includeTest]);

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    if (data && offset + limit < data.total) {
      setOffset(offset + limit);
    }
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard
            label="Total Add-to-Carts"
            value={productType === "tire" ? stats.tireEvents : stats.wheelEvents}
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
            label="Converted to Purchase"
            value={stats.purchasedEvents}
          />
          <StatCard
            label="Overall Conversion"
            value={
              stats.totalEvents > 0
                ? `${Math.round((stats.purchasedEvents / stats.totalEvents) * 100)}%`
                : "0%"
            }
          />
          <StatCard
            label="Top Brand"
            value={stats.topBrands[0]?.brand || "-"}
            subtext={stats.topBrands[0] ? `${stats.topBrands[0].count} adds` : undefined}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-600">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-600">Brand:</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm min-w-[150px]"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-600">Show:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="rounded"
            />
            Include test data
          </label>

          <button
            onClick={loadData}
            className="ml-auto px-4 py-1.5 bg-neutral-800 text-white rounded-lg text-sm hover:bg-neutral-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !data && (
        <div className="text-center py-12 text-neutral-500">
          Loading {title.toLowerCase()}...
        </div>
      )}

      {/* Data Table */}
      {data && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200 flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900">
              {emoji} {title} ({data.total} products)
            </h3>
            <div className="text-sm text-neutral-500">
              {data.period}
            </div>
          </div>

          {data.products.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">
              No add-to-cart events found for the selected period.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-neutral-600">
                        Brand
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Add-to-Cart
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Unique Carts
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Purchased
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Conv. Rate
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-neutral-600">
                        Last Added
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product, i) => (
                      <tr
                        key={product.sku}
                        className={`border-t border-neutral-100 ${
                          i % 2 === 0 ? "bg-white" : "bg-neutral-25"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                          {product.sku}
                        </td>
                        <td className="px-4 py-3 text-neutral-900 max-w-xs truncate">
                          {product.productName}
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {product.brand}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-700">
                          {formatPrice(product.latestPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                          {product.addToCartCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-700">
                          {product.uniqueCarts.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600">
                          {product.purchasedCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              product.conversionRate >= 20
                                ? "bg-green-100 text-green-800"
                                : product.conversionRate >= 10
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            {product.conversionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-500 text-xs">
                          {formatDate(product.lastAddedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-between">
                  <div className="text-sm text-neutral-500">
                    Showing {offset + 1} - {Math.min(offset + limit, data.total)} of{" "}
                    {data.total}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={offset === 0}
                      className="px-3 py-1.5 border border-neutral-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-neutral-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={offset + limit >= data.total}
                      className="px-3 py-1.5 border border-neutral-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
