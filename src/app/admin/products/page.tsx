"use client";

import { useState, useEffect, useCallback } from "react";

type ProductFlag = {
  id: string;
  product_type: string;
  sku: string;
  hidden: boolean;
  flagged: boolean;
  flag_reason: string | null;
  image_url: string | null;
  supplier: string | null;
  brand: string | null;
  created_at: string;
  updated_at: string;
};

type SearchResult = {
  sku: string;
  upc?: string;
  name: string;
  brand: string;
  finish?: string;
  size?: string;
  boltPattern?: string;
  offset?: number;
  imageUrl: string | null;
  supplier: string;
  flagId: string | null;
  hidden: boolean;
  flagged: boolean;
  flagReason: string | null;
};

type Counts = {
  hidden_count: string;
  flagged_count: string;
  total_count: string;
  missing_image_count: string;
};

type ViewMode = "flagged" | "search";

export default function ProductsPage() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("flagged");
  
  // Flagged products state
  const [products, setProducts] = useState<ProductFlag[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "flagged" | "hidden" | "missing_image">("all");
  const [productType, setProductType] = useState<"wheel" | "tire">("wheel");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searchFilters, setSearchFilters] = useState<{ brands: string[]; suppliers: string[] }>({ brands: [], suppliers: [] });
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");

  // Selection state for bulk actions
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkImageUrl, setBulkImageUrl] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Image edit state
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");

  // Fetch flagged products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", productType);
      if (filter !== "all") params.set("filter", filter);

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const data = await res.json();

      setProducts(data.products || []);
      setCounts(data.counts || null);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, productType]);

  // Search products
  const searchProducts = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchMessage(null);
      return;
    }

    setSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", searchQuery);
      params.set("type", productType);
      if (selectedSupplier) params.set("supplier", selectedSupplier);
      if (selectedBrand) params.set("brand", selectedBrand);

      const res = await fetch(`/api/admin/products/search?${params.toString()}`);
      const data = await res.json();

      setSearchResults(data.products || []);
      setSearchMessage(data.message || null);
      if (data.filters) setSearchFilters(data.filters);
    } catch (err) {
      console.error("Failed to search products:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, productType, selectedSupplier, selectedBrand]);

  useEffect(() => {
    if (viewMode === "flagged") {
      fetchProducts();
    }
  }, [viewMode, fetchProducts]);

  useEffect(() => {
    if (viewMode === "search") {
      const timer = setTimeout(searchProducts, 300);
      return () => clearTimeout(timer);
    }
  }, [viewMode, searchQuery, selectedBrand, selectedSupplier, searchProducts]);

  // Toggle selection
  const toggleSelection = (sku: string) => {
    const newSet = new Set(selectedSkus);
    if (newSet.has(sku)) {
      newSet.delete(sku);
    } else {
      newSet.add(sku);
    }
    setSelectedSkus(newSet);
  };

  // Select all visible
  const selectAll = () => {
    const items = viewMode === "flagged" ? products : searchResults;
    const skus = items.map(p => "sku" in p ? p.sku : (p as ProductFlag).sku);
    setSelectedSkus(new Set(skus));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSkus(new Set());
  };

  // Execute bulk action
  const executeBulkAction = async () => {
    if (!bulkAction || selectedSkus.size === 0) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction,
          productType,
          skus: Array.from(selectedSkus),
          imageUrl: bulkAction === "setImage" ? bulkImageUrl : undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        alert(data.message);
        setSelectedSkus(new Set());
        setBulkAction("");
        setBulkImageUrl("");
        if (viewMode === "flagged") fetchProducts();
        else searchProducts();
      } else {
        alert(data.error || "Bulk action failed");
      }
    } catch (err) {
      alert("Failed to execute bulk action");
    } finally {
      setBulkLoading(false);
    }
  };

  // Single product toggle
  const handleToggle = async (sku: string, field: "hidden" | "flagged", currentValue: boolean) => {
    try {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          sku,
          hidden: field === "hidden" ? !currentValue : undefined,
          flagged: field === "flagged" ? !currentValue : undefined,
        }),
      });
      if (viewMode === "flagged") fetchProducts();
      else searchProducts();
    } catch (err) {
      alert("Failed to update");
    }
  };

  // Save image for single product
  const handleSaveImage = async (sku: string) => {
    try {
      await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productType,
          sku,
          imageUrl: imageUrl || null,
        }),
      });
      setEditingImage(null);
      setImageUrl("");
      if (viewMode === "flagged") fetchProducts();
      else searchProducts();
    } catch (err) {
      alert("Failed to save image URL");
    }
  };

  const currentItems = viewMode === "flagged" ? products : searchResults;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Product Controls</h1>
          <p className="text-neutral-400 mt-1">
            Search, flag, hide, or fix images for products
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-neutral-600">
          <button
            onClick={() => setViewMode("flagged")}
            className={`px-4 py-2 text-sm font-medium ${
              viewMode === "flagged"
                ? "bg-red-600 text-white"
                : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
            }`}
          >
            📋 Flagged
          </button>
          <button
            onClick={() => setViewMode("search")}
            className={`px-4 py-2 text-sm font-medium ${
              viewMode === "search"
                ? "bg-red-600 text-white"
                : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
            }`}
          >
            🔍 Search Catalog
          </button>
        </div>
      </div>

      {/* Stats (flagged view only) */}
      {viewMode === "flagged" && counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Flagged" value={parseInt(counts.flagged_count)} color="amber" />
          <StatCard label="Hidden" value={parseInt(counts.hidden_count)} color="red" />
          <StatCard label="Missing Images" value={parseInt(counts.missing_image_count || "0")} color="orange" />
          <StatCard label="Total Tracked" value={parseInt(counts.total_count)} color="neutral" />
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
              <option value="wheel">🛞 Wheels</option>
              <option value="tire">⚫ Tires</option>
            </select>
          </div>

          {viewMode === "flagged" && (
            /* Filter for flagged view */
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Filter:</span>
              <div className="flex rounded-lg overflow-hidden border border-neutral-600">
                {(["all", "flagged", "hidden", "missing_image"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                      filter === f
                        ? "bg-red-600 text-white"
                        : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"
                    }`}
                  >
                    {f === "missing_image" ? "No Image" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {viewMode === "search" && (
            /* Search input and filters */
            <>
              <div className="flex-1 min-w-[250px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by SKU, name, or brand..."
                  className="w-full h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                  autoFocus
                />
              </div>
              
              {searchFilters.suppliers.length > 0 && (
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm"
                >
                  <option value="">All Suppliers</option>
                  {searchFilters.suppliers.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {searchFilters.brands.length > 0 && (
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="h-9 rounded-lg bg-neutral-700 border border-neutral-600 px-3 text-white text-sm max-w-[150px]"
                >
                  <option value="">All Brands</option>
                  {searchFilters.brands.slice(0, 50).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedSkus.size > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-700 flex flex-wrap items-center gap-3">
            <span className="text-sm text-white font-medium">
              {selectedSkus.size} selected
            </span>
            <button onClick={clearSelection} className="text-xs text-neutral-400 hover:text-white">
              Clear
            </button>
            <div className="h-4 w-px bg-neutral-600" />
            
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="h-8 rounded bg-neutral-700 border border-neutral-600 px-2 text-white text-sm"
            >
              <option value="">Bulk action...</option>
              <option value="hide">🚫 Hide from search</option>
              <option value="unhide">✅ Unhide</option>
              <option value="flag">🚩 Flag for review</option>
              <option value="unflag">✓ Unflag</option>
              <option value="setImage">🖼️ Set image URL</option>
            </select>

            {bulkAction === "setImage" && (
              <input
                type="text"
                value={bulkImageUrl}
                onChange={(e) => setBulkImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 w-64 rounded bg-neutral-700 border border-neutral-600 px-2 text-white text-sm"
              />
            )}

            <button
              onClick={executeBulkAction}
              disabled={!bulkAction || bulkLoading || (bulkAction === "setImage" && !bulkImageUrl)}
              className="h-8 px-4 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {bulkLoading ? "..." : "Apply"}
            </button>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        {(viewMode === "flagged" && loading) || (viewMode === "search" && searchLoading) ? (
          <div className="p-8 text-center text-neutral-500">Loading...</div>
        ) : currentItems.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {viewMode === "search" 
              ? (searchQuery.length < 2 
                  ? "Enter at least 2 characters to search" 
                  : searchMessage || "No products found")
              : "No flagged products yet"}
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="px-4 py-2 bg-neutral-700/50 border-b border-neutral-700 flex items-center gap-3">
              <button
                onClick={selectAll}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Select all ({currentItems.length})
              </button>
              {selectedSkus.size > 0 && (
                <button onClick={clearSelection} className="text-xs text-neutral-400 hover:text-white">
                  Clear selection
                </button>
              )}
            </div>
            
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-700 text-left text-sm text-neutral-400">
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Image</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {viewMode === "search" && <th className="px-4 py-3 font-medium">Details</th>}
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {viewMode === "flagged" 
                  ? products.map((p) => (
                      <FlaggedRow
                        key={p.id}
                        product={p}
                        selected={selectedSkus.has(p.sku)}
                        onToggleSelect={() => toggleSelection(p.sku)}
                        onToggle={handleToggle}
                        editingImage={editingImage}
                        imageUrl={imageUrl}
                        setEditingImage={setEditingImage}
                        setImageUrl={setImageUrl}
                        onSaveImage={handleSaveImage}
                      />
                    ))
                  : searchResults.map((p) => (
                      <SearchRow
                        key={p.sku}
                        product={p}
                        selected={selectedSkus.has(p.sku)}
                        onToggleSelect={() => toggleSelection(p.sku)}
                        onToggle={handleToggle}
                        editingImage={editingImage}
                        imageUrl={imageUrl}
                        setEditingImage={setEditingImage}
                        setImageUrl={setImageUrl}
                        onSaveImage={handleSaveImage}
                      />
                    ))
                }
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function FlaggedRow({
  product,
  selected,
  onToggleSelect,
  onToggle,
  editingImage,
  imageUrl,
  setEditingImage,
  setImageUrl,
  onSaveImage,
}: {
  product: ProductFlag;
  selected: boolean;
  onToggleSelect: () => void;
  onToggle: (sku: string, field: "hidden" | "flagged", current: boolean) => void;
  editingImage: string | null;
  imageUrl: string;
  setEditingImage: (id: string | null) => void;
  setImageUrl: (url: string) => void;
  onSaveImage: (sku: string) => void;
}) {
  return (
    <tr className={`hover:bg-neutral-700/50 ${selected ? "bg-neutral-700/30" : ""}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded bg-neutral-600 border-neutral-500"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{product.product_type === "wheel" ? "🛞" : "⚫"}</span>
          <div>
            <code className="text-sm text-white bg-neutral-700 px-2 py-0.5 rounded">
              {product.sku}
            </code>
            {product.brand && (
              <div className="text-xs text-neutral-500 mt-0.5">{product.brand}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <ImageCell
          sku={product.sku}
          imageUrl={product.image_url}
          editing={editingImage === product.id}
          editValue={imageUrl}
          onEdit={() => { setEditingImage(product.id); setImageUrl(product.image_url || ""); }}
          onCancel={() => { setEditingImage(null); setImageUrl(""); }}
          onChange={setImageUrl}
          onSave={() => onSaveImage(product.sku)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusToggle
            label="Hidden"
            active={product.hidden}
            color="red"
            onClick={() => onToggle(product.sku, "hidden", product.hidden)}
          />
          <StatusToggle
            label="Flagged"
            active={product.flagged}
            color="amber"
            onClick={() => onToggle(product.sku, "flagged", product.flagged)}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500">
        {new Date(product.updated_at).toLocaleDateString()}
      </td>
    </tr>
  );
}

function SearchRow({
  product,
  selected,
  onToggleSelect,
  onToggle,
  editingImage,
  imageUrl,
  setEditingImage,
  setImageUrl,
  onSaveImage,
}: {
  product: SearchResult;
  selected: boolean;
  onToggleSelect: () => void;
  onToggle: (sku: string, field: "hidden" | "flagged", current: boolean) => void;
  editingImage: string | null;
  imageUrl: string;
  setEditingImage: (id: string | null) => void;
  setImageUrl: (url: string) => void;
  onSaveImage: (sku: string) => void;
}) {
  return (
    <tr className={`hover:bg-neutral-700/50 ${selected ? "bg-neutral-700/30" : ""}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded bg-neutral-600 border-neutral-500"
        />
      </td>
      <td className="px-4 py-3">
        <div>
          <code className="text-sm text-white bg-neutral-700 px-2 py-0.5 rounded">
            {product.sku}
          </code>
          <div className="text-sm text-neutral-300 mt-1 max-w-[300px] truncate">
            {product.name}
          </div>
          <div className="text-xs text-neutral-500">{product.brand}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <ImageCell
          sku={product.sku}
          imageUrl={product.imageUrl}
          editing={editingImage === product.sku}
          editValue={imageUrl}
          onEdit={() => { setEditingImage(product.sku); setImageUrl(product.imageUrl || ""); }}
          onCancel={() => { setEditingImage(null); setImageUrl(""); }}
          onChange={setImageUrl}
          onSave={() => onSaveImage(product.sku)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusToggle
            label="Hidden"
            active={product.hidden}
            color="red"
            onClick={() => onToggle(product.sku, "hidden", product.hidden)}
          />
          <StatusToggle
            label="Flagged"
            active={product.flagged}
            color="amber"
            onClick={() => onToggle(product.sku, "flagged", product.flagged)}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-neutral-400">
        <div>{product.size}</div>
        <div>{product.supplier}</div>
      </td>
      <td className="px-4 py-3"></td>
    </tr>
  );
}

function ImageCell({
  sku,
  imageUrl,
  editing,
  editValue,
  onEdit,
  onCancel,
  onChange,
  onSave,
}: {
  sku: string;
  imageUrl: string | null;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="w-40 h-7 rounded bg-neutral-700 border border-neutral-600 px-2 text-white text-xs"
          autoFocus
        />
        <button onClick={onSave} className="text-xs text-green-400 hover:text-green-300">✓</button>
        <button onClick={onCancel} className="text-xs text-neutral-400 hover:text-white">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            className="w-8 h-8 object-contain bg-neutral-700 rounded"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button onClick={onEdit} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
        </>
      ) : (
        <button onClick={onEdit} className="text-xs text-orange-400 hover:text-orange-300">
          📷 Add
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "amber" | "red" | "orange" | "neutral" }) {
  const colors = {
    amber: "border-amber-600 text-amber-400",
    red: "border-red-600 text-red-400",
    orange: "border-orange-600 text-orange-400",
    neutral: "border-neutral-600 text-neutral-400",
  };
  return (
    <div className={`bg-neutral-800 rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function StatusToggle({ label, active, color, onClick }: { label: string; active: boolean; color: "red" | "amber"; onClick: () => void }) {
  const activeColors = { red: "bg-red-600 text-white", amber: "bg-amber-600 text-white" };
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
