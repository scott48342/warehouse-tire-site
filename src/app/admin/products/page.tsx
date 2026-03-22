"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ProductFlag = {
  id: string;
  product_type: string;
  sku: string;
  hidden: boolean;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  updated_at: string;
};

type Counts = {
  hidden_count: string;
  flagged_count: string;
  total_count: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductFlag[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flagged" | "hidden">("all");
  const [productType, setProductType] = useState<"wheel" | "tire" | "">("");
  const [search, setSearch] = useState("");
  const [addingSku, setAddingSku] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (productType) params.set("type", productType);
      if (filter !== "all") params.set("filter", filter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json();

      setProducts(data.products || []);
      setCounts(data.counts || null);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [filter, productType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleAddSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingSku || !productType) return;

    try {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          sku: addingSku,
          flagged: true,
          flagReason: "Manually flagged",
        }),
      });
      setAddingSku("");
      fetchProducts();
    } catch (err) {
      alert("Failed to add SKU");
    }
  };

  const handleToggle = async (product: ProductFlag, field: "hidden" | "flagged") => {
    try {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType: product.product_type,
          sku: product.sku,
          hidden: field === "hidden" ? !product.hidden : product.hidden,
          flagged: field === "flagged" ? !product.flagged : product.flagged,
          flagReason: product.flag_reason,
        }),
      });
      fetchProducts();
    } catch (err) {
      alert("Failed to update");
    }
  };

  const handleDelete = async (product: ProductFlag) => {
    if (!confirm("Remove this product flag? It will appear normally in search.")) return;

    try {
      await fetch(`/api/admin/products?type=${product.product_type}&sku=${product.sku}`, {
        method: "DELETE",
      });
      fetchProducts();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Product Controls</h1>
        <p className="text-neutral-400 mt-1">
          Hide or flag products from search results
        </p>
      </div>

      {/* Stats */}
      {counts && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Flagged"
            value={parseInt(counts.flagged_count)}
            color="amber"
          />
          <StatCard
            label="Hidden"
            value={parseInt(counts.hidden_count)}
            color="red"
          />
          <StatCard
            label="Total Tracked"
            value={parseInt(counts.total_count)}
            color="neutral"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Product Type */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Type:</span>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as any)}
              className="h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
            >
              <option value="">All</option>
              <option value="wheel">Wheels</option>
              <option value="tire">Tires</option>
            </select>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Filter:</span>
            <div className="flex rounded-lg overflow-hidden border border-neutral-600">
              {(["all", "flagged", "hidden"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    filter === f
                      ? "bg-red-600 text-white"
                      : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU..."
              className="flex-1 h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm min-w-[200px]"
            />
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-neutral-600 text-white text-sm font-medium hover:bg-neutral-500"
            >
              Search
            </button>
          </form>
        </div>

        {/* Add SKU */}
        {productType && (
          <form onSubmit={handleAddSku} className="mt-4 pt-4 border-t border-neutral-700 flex items-center gap-2">
            <input
              type="text"
              value={addingSku}
              onChange={(e) => setAddingSku(e.target.value)}
              placeholder={`Add ${productType} SKU to flag...`}
              className="flex-1 h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
            />
            <button
              type="submit"
              disabled={!addingSku}
              className="h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              Flag SKU
            </button>
          </form>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {filter === "all" && !search
              ? "No products have been flagged or hidden yet. Use the form above to flag a SKU."
              : "No products match your filter."}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-700 text-left text-sm text-neutral-400">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-neutral-700/50">
                  <td className="px-4 py-3">
                    <span className="text-lg">
                      {product.product_type === "wheel" ? "🛞" : "⚫"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm text-white bg-neutral-700 px-2 py-0.5 rounded">
                      {product.sku}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusToggle
                        label="Hidden"
                        active={product.hidden}
                        color="red"
                        onClick={() => handleToggle(product, "hidden")}
                      />
                      <StatusToggle
                        label="Flagged"
                        active={product.flagged}
                        color="amber"
                        onClick={() => handleToggle(product, "flagged")}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400 max-w-[200px] truncate">
                    {product.flag_reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {new Date(product.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(product)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "amber" | "red" | "neutral";
}) {
  const colors = {
    amber: "border-amber-600 text-amber-400",
    red: "border-red-600 text-red-400",
    neutral: "border-neutral-600 text-neutral-400",
  };

  return (
    <div className={`bg-neutral-800 rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function StatusToggle({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: "red" | "amber";
  onClick: () => void;
}) {
  const activeColors = {
    red: "bg-red-600 text-white",
    amber: "bg-amber-600 text-white",
  };

  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active ? activeColors[color] : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
      }`}
    >
      {label}
    </button>
  );
}
