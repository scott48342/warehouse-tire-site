"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type TireModelImage = {
  id: number;
  brand: string;
  model_pattern: string;
  image_url: string;
  source: string;
  created_at: string;
};

type TireModel = {
  brand: string;
  fullModel: string;
  variantCount: number;
  wheelprosImage: string | null;
  hasImage: boolean;
  matchType: "exact" | "partial" | "none";
  matchedPattern: string | null;
  imageUrl: string | null;
};

export default function TireImagesAdminPage() {
  const [items, setItems] = useState<TireModelImage[]>([]);
  const [models, setModels] = useState<TireModel[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(true);
  const [activeTab, setActiveTab] = useState<"models" | "images">("models");
  const [stats, setStats] = useState({ total: 0, withImage: 0, missing: 0 });
  
  // New item form
  const [newBrand, setNewBrand] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingUrl, setEditingUrl] = useState("");

  // Fetch tire models from WheelPros database
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (brandFilter) params.set("brand", brandFilter);
      if (showMissingOnly) params.set("missing", "1");
      
      const res = await fetch(`/api/admin/tire-images/models?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      
      let filteredModels = data.models || [];
      if (search) {
        const q = search.toLowerCase();
        filteredModels = filteredModels.filter((m: TireModel) => 
          m.brand.toLowerCase().includes(q) || 
          m.fullModel.toLowerCase().includes(q)
        );
      }
      
      setModels(filteredModels);
      setBrands(data.brands || []);
      setStats(data.stats || { total: 0, withImage: 0, missing: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [brandFilter, showMissingOnly, search]);

  // Fetch existing image mappings
  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (brandFilter) params.set("brand", brandFilter);
      
      const res = await fetch(`/api/admin/tire-images?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      
      setItems(data.items || []);
      setBrands(data.brands || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, brandFilter]);

  useEffect(() => {
    if (activeTab === "models") {
      fetchModels();
    } else {
      fetchImages();
    }
  }, [activeTab, fetchModels, fetchImages]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand || !newPattern || !newImageUrl) return;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const res = await fetch("/api/admin/tire-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newBrand,
          model_pattern: newPattern,
          image_url: newImageUrl,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to add");
      
      setSaveMessage({ type: "success", text: `Added ${newBrand} ${newPattern}` });
      setNewBrand("");
      setNewPattern("");
      setNewImageUrl("");
      fetchModels();
      fetchImages();
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = async (model: TireModel) => {
    if (!model.wheelprosImage) {
      alert("No WheelPros image available for this model");
      return;
    }
    
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tire-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: model.brand,
          model_pattern: model.fullModel,
          image_url: model.wheelprosImage,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      
      setSaveMessage({ type: "success", text: `Added ${model.brand} ${model.fullModel}` });
      fetchModels();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, brand: string, pattern: string) => {
    if (!confirm(`Delete ${brand} ${pattern}?`)) return;
    
    try {
      const res = await fetch(`/api/admin/tire-images?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      
      fetchImages();
      fetchModels();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleStartEdit = (item: TireModelImage) => {
    setEditingId(item.id);
    setEditingUrl(item.image_url);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingUrl("");
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingUrl.trim()) return;
    
    try {
      const res = await fetch("/api/admin/tire-images", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, image_url: editingUrl }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to update");
      
      setEditingId(null);
      setEditingUrl("");
      fetchImages();
      fetchModels();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white border-b border-neutral-200 shadow-md p-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Tire Model Images</h1>
              <div className="text-sm text-neutral-500">
                {stats.withImage} of {stats.total} models have images • 
                <span className="text-red-600 font-semibold"> {stats.missing} missing</span>
              </div>
            </div>
            <Link
              href="/admin"
              className="rounded-lg bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-300"
            >
              ← Back
            </Link>
          </div>
          
          {/* Add Form */}
          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Brand"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Full Model Name"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              className="w-52 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            <input
              type="url"
              placeholder="Image URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            {newImageUrl && (
              <img
                src={newImageUrl}
                alt="Preview"
                className="h-8 w-8 rounded border border-neutral-200 object-contain bg-white"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "..." : "Add"}
            </button>
          </form>
          
          {saveMessage && (
            <div className={`mb-3 rounded-lg px-3 py-1.5 text-sm ${
              saveMessage.type === "success" 
                ? "bg-green-50 text-green-700" 
                : "bg-red-50 text-red-700"
            }`}>
              {saveMessage.text}
            </div>
          )}
          
          {/* Tabs */}
          <div className="flex gap-2 border-b border-neutral-200">
            <button
              onClick={() => setActiveTab("models")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === "models"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              🔍 Missing Models ({stats.missing})
            </button>
            <button
              onClick={() => setActiveTab("images")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === "images"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-neutral-600 hover:text-neutral-900"
              }`}
            >
              🖼️ Existing Images ({items.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-6 pt-52 pb-6">
        {/* Filters */}
        <div className="mb-4 flex gap-3">
          <input
            type="text"
            placeholder="Search brand or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">All Brands ({brands.length})</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          {activeTab === "models" && (
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={showMissingOnly}
                onChange={(e) => setShowMissingOnly(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Missing only
            </label>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">{error}</div>
        ) : activeTab === "models" ? (
          /* Models Tab */
          models.length === 0 ? (
            <div className="text-center py-8 text-green-600 font-medium">
              ✅ All models have images!
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">WP Image</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Brand</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Full Model Name</th>
                    <th className="px-4 py-3 text-center font-medium text-neutral-600">Variants</th>
                    <th className="px-4 py-3 text-center font-medium text-neutral-600">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {models.map((model, idx) => (
                    <tr key={idx} className={`hover:bg-neutral-50 ${!model.hasImage ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        {model.wheelprosImage ? (
                          <img
                            src={model.wheelprosImage}
                            alt={`${model.brand} ${model.fullModel}`}
                            className="h-12 w-12 rounded-lg border border-neutral-200 object-contain bg-white cursor-pointer hover:scale-150 transition-transform"
                            onClick={() => setPreviewUrl(model.wheelprosImage)}
                            onError={(e) => { 
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="50" text-anchor="middle" font-size="40">🛞</text></svg>';
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg border border-neutral-200 bg-neutral-100 flex items-center justify-center text-neutral-400">
                            ?
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{model.brand}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{model.fullModel}</div>
                        {model.matchedPattern && (
                          <div className="text-xs text-neutral-500">
                            matched: "{model.matchedPattern}"
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-600">{model.variantCount}</td>
                      <td className="px-4 py-3 text-center">
                        {model.hasImage ? (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            model.matchType === 'exact' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {model.matchType === 'exact' ? '✓ Exact' : '~ Partial'}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                            ❌ Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!model.hasImage && model.wheelprosImage && (
                          <button
                            onClick={() => handleQuickAdd(model)}
                            disabled={saving}
                            className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            + Add
                          </button>
                        )}
                        {!model.hasImage && !model.wheelprosImage && (
                          <button
                            onClick={() => {
                              setNewBrand(model.brand);
                              setNewPattern(model.fullModel);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            Fill Form
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Images Tab */
          items.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">No model images found</div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Image</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Brand</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Model Pattern</th>
                    <th className="px-4 py-3 text-left font-medium text-neutral-600">Source</th>
                    <th className="px-4 py-3 text-right font-medium text-neutral-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <img
                          src={editingId === item.id ? editingUrl : item.image_url}
                          alt={`${item.brand} ${item.model_pattern}`}
                          className="h-12 w-12 rounded-lg border border-neutral-200 object-contain bg-white cursor-pointer hover:scale-150 transition-transform"
                          onClick={() => setPreviewUrl(editingId === item.id ? editingUrl : item.image_url)}
                          onError={(e) => { 
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" x="50" text-anchor="middle" font-size="40">🛞</text></svg>';
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{item.brand}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {editingId === item.id ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-neutral-500">{item.model_pattern}</span>
                            <input
                              type="url"
                              value={editingUrl}
                              onChange={(e) => setEditingUrl(e.target.value)}
                              className="w-full rounded border border-blue-300 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              placeholder="Image URL"
                              autoFocus
                            />
                          </div>
                        ) : (
                          item.model_pattern
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.source === 'admin' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {item.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.brand, item.model_pattern)}
                              className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        
        <div className="mt-4 text-center text-sm text-neutral-500">
          {activeTab === "models" 
            ? `${models.length} models shown`
            : `${items.length} image mappings`
          }
        </div>
      </div>

      {/* Full image preview modal */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[80vh] max-w-[80vw] rounded-xl bg-white object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
