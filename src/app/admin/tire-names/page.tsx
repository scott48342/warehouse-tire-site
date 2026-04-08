"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type NameOverride = {
  id: number;
  brand: string;
  model_pattern: string;
  display_name: string;
  source: string;
  created_at: string;
};

export default function TireNamesAdminPage() {
  const [items, setItems] = useState<NameOverride[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  
  // New item form
  const [newBrand, setNewBrand] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (brandFilter) params.set("brand", brandFilter);
      
      const res = await fetch(`/api/admin/tire-names?${params.toString()}`);
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
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrand || !newPattern || !newDisplayName) return;
    
    setSaving(true);
    setSaveMessage(null);
    
    try {
      const res = await fetch("/api/admin/tire-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newBrand,
          model_pattern: newPattern,
          display_name: newDisplayName,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to add");
      
      setSaveMessage({ type: "success", text: `Added ${newBrand} ${newPattern} → ${newDisplayName}` });
      setNewBrand("");
      setNewPattern("");
      setNewDisplayName("");
      fetchItems();
    } catch (err: any) {
      setSaveMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, brand: string, pattern: string) => {
    if (!confirm(`Delete override for ${brand} ${pattern}?`)) return;
    
    try {
      const res = await fetch(`/api/admin/tire-names?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      
      fetchItems();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleStartEdit = (item: NameOverride) => {
    setEditingId(item.id);
    setEditingName(item.display_name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) return;
    
    try {
      const res = await fetch("/api/admin/tire-names", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, display_name: editingName }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to update");
      
      setEditingId(null);
      setEditingName("");
      fetchItems();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white border-b border-neutral-200 shadow-md p-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Tire Name Overrides</h1>
              <div className="text-sm text-neutral-500">
                Fix abbreviated/malformed product names from suppliers
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
              placeholder="Brand (e.g., Venom)"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              className="w-32 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Pattern to match (e.g., Terra Hunter)"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              className="w-48 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Clean display name (e.g., Terra Hunter MT)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "..." : "Add Override"}
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
          
          {/* Filters */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">All brands</option>
              {brands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-56 px-4 pb-8">
        <div className="mx-auto max-w-6xl">
          {loading && <div className="text-center py-8 text-neutral-500">Loading...</div>}
          {error && <div className="text-center py-8 text-red-600">{error}</div>}
          
          {!loading && !error && (
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Brand</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Match Pattern</th>
                    <th className="px-4 py-3 text-left font-semibold text-neutral-700">Display Name</th>
                    <th className="px-4 py-3 text-right font-semibold text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                        No name overrides yet. Add one above.
                      </td>
                    </tr>
                  )}
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium text-neutral-900">{item.brand}</td>
                      <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{item.model_pattern}</td>
                      <td className="px-4 py-3">
                        {editingId === item.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full rounded border border-blue-300 px-2 py-1 text-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="text-neutral-900">{item.display_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === item.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              className="text-xs font-semibold text-green-600 hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-xs font-semibold text-neutral-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="text-xs font-semibold text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.brand, item.model_pattern)}
                              className="text-xs font-semibold text-red-600 hover:underline"
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
          )}
          
          {/* Instructions */}
          <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            <div className="font-bold mb-2">How it works:</div>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Brand</strong>: Must match exactly (e.g., "Venom")</li>
              <li><strong>Match Pattern</strong>: Text that appears in the raw product name (case-insensitive)</li>
              <li><strong>Display Name</strong>: The clean name to show customers</li>
            </ul>
            <div className="mt-3 text-xs text-blue-600">
              Note: After adding overrides, clear the search cache for affected tire sizes to see changes immediately.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
