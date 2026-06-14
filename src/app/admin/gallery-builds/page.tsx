"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { BUILD_STYLES } from "@/lib/fitment-db/schema-gallery";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface GalleryBuild {
  id: string;
  slug: string;
  title: string | null;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleTrim: string | null;
  buildStyle: string;
  liftLevel: string | null;
  wheelBrand: string;
  wheelModel: string;
  wheelSize: string;
  wheelFinish: string | null;
  wheelOffset: string | null;
  tireBrand: string;
  tireModel: string;
  tireSize: string;
  heroImageUrl: string;
  tags: string[];
  isFeatured: boolean;
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminGalleryBuildsPage() {
  const [builds, setBuilds] = useState<GalleryBuild[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBuild, setSelectedBuild] = useState<GalleryBuild | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Fetch builds
  const fetchBuilds = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/build-gallery?page=${page}&limit=20`);
      const data = await res.json();
      setBuilds(data.builds || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchBuilds();
  }, [fetchBuilds]);
  
  // Toggle featured/popular
  const toggleFlag = async (build: GalleryBuild, flag: "isFeatured" | "isPopular") => {
    try {
      await fetch(`/api/build-gallery/${build.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: !build[flag] }),
      });
      fetchBuilds(pagination?.page || 1);
    } catch (err) {
      console.error(err);
    }
  };
  
  // Delete build
  const deleteBuild = async (build: GalleryBuild) => {
    if (!confirm(`Delete "${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}"?`)) return;
    
    try {
      await fetch(`/api/build-gallery/${build.slug}`, {
        method: "DELETE",
      });
      fetchBuilds(pagination?.page || 1);
    } catch (err) {
      console.error(err);
    }
  };
  
  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Build Gallery</h1>
            <p className="text-sm text-neutral-600">
              Manage curated builds for the inspiration gallery
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-800"
          >
            + Add Build
          </button>
        </div>
        
        {/* Stats */}
        {pagination && (
          <div className="flex gap-4 mb-6">
            <div className="bg-white rounded-xl px-4 py-3 border border-neutral-200">
              <div className="text-2xl font-bold text-neutral-900">{pagination.total}</div>
              <div className="text-xs text-neutral-500">Total Builds</div>
            </div>
            <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">
                {builds.filter(b => b.isFeatured).length}
              </div>
              <div className="text-xs text-amber-600">Featured</div>
            </div>
            <div className="bg-red-50 rounded-xl px-4 py-3 border border-red-200">
              <div className="text-2xl font-bold text-red-600">
                {builds.filter(b => b.isPopular).length}
              </div>
              <div className="text-xs text-red-600">Popular</div>
            </div>
          </div>
        )}
        
        {/* Build List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading...</div>
        ) : builds.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🚗</div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">No builds yet</h3>
            <p className="text-neutral-600 mb-4">Add your first curated build to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800"
            >
              + Add Build
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {builds.map((build) => (
              <div
                key={build.id}
                className="bg-white rounded-2xl border border-neutral-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="relative w-40 h-28 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
                    <Image
                      src={build.heroImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-neutral-900">
                          {build.vehicleYear} {build.vehicleMake} {build.vehicleModel}
                          {build.vehicleTrim && <span className="text-neutral-500 ml-1">{build.vehicleTrim}</span>}
                        </h3>
                        <p className="text-sm text-neutral-600">
                          {build.wheelBrand} {build.wheelModel} ({build.wheelSize})
                          <span className="text-neutral-400 mx-2">•</span>
                          {build.tireBrand} {build.tireModel} ({build.tireSize})
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {build.isFeatured && (
                          <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                            ⭐ Featured
                          </span>
                        )}
                        {build.isPopular && (
                          <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                            🔥 Popular
                          </span>
                        )}
                        {!build.isActive && (
                          <span className="bg-neutral-100 text-neutral-500 text-xs px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
                      <span className="capitalize">{build.buildStyle.replace(/-/g, " ")}</span>
                      {build.liftLevel && <span>• {build.liftLevel} lift</span>}
                      <span>• Order: {build.displayOrder}</span>
                      {build.tags.length > 0 && (
                        <span>• {build.tags.slice(0, 3).join(", ")}</span>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => toggleFlag(build, "isFeatured")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          build.isFeatured
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-600 hover:bg-amber-50"
                        }`}
                      >
                        {build.isFeatured ? "★ Unfeature" : "☆ Feature"}
                      </button>
                      <button
                        onClick={() => toggleFlag(build, "isPopular")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          build.isPopular
                            ? "bg-red-100 text-red-700"
                            : "bg-neutral-100 text-neutral-600 hover:bg-red-50"
                        }`}
                      >
                        {build.isPopular ? "🔥 Remove Popular" : "Add Popular"}
                      </button>
                      <a
                        href={`/build-gallery/${build.slug}`}
                        target="_blank"
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      >
                        View →
                      </a>
                      <button
                        onClick={() => setSelectedBuild(build)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteBuild(build)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-neutral-100 text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchBuilds(p)}
                className={`w-8 h-8 rounded-lg text-sm ${
                  p === pagination.page
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Create/Edit Modal */}
      {(showCreateModal || selectedBuild) && (
        <BuildModal
          build={selectedBuild}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedBuild(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setSelectedBuild(null);
            fetchBuilds(pagination?.page || 1);
          }}
        />
      )}
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILD MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface BuildModalProps {
  build: GalleryBuild | null;
  onClose: () => void;
  onSave: () => void;
}

function BuildModal({ build, onClose, onSave }: BuildModalProps) {
  const [form, setForm] = useState({
    vehicleYear: build?.vehicleYear || new Date().getFullYear(),
    vehicleMake: build?.vehicleMake || "",
    vehicleModel: build?.vehicleModel || "",
    vehicleTrim: build?.vehicleTrim || "",
    buildStyle: build?.buildStyle || "lifted",
    liftLevel: build?.liftLevel || "",
    wheelBrand: build?.wheelBrand || "",
    wheelModel: build?.wheelModel || "",
    wheelSize: build?.wheelSize || "",
    wheelFinish: build?.wheelFinish || "",
    wheelOffset: build?.wheelOffset || "",
    tireBrand: build?.tireBrand || "",
    tireModel: build?.tireModel || "",
    tireSize: build?.tireSize || "",
    heroImageUrl: build?.heroImageUrl || "",
    tags: build?.tags?.join(", ") || "",
    isFeatured: build?.isFeatured || false,
    isPopular: build?.isPopular || false,
    displayOrder: build?.displayOrder || 1000,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      };
      
      if (build) {
        // Update
        const res = await fetch(`/api/build-gallery/${build.slug}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update");
        }
      } else {
        // Create
        const res = await fetch("/api/build-gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create");
        }
      }
      
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            {build ? "Edit Build" : "Add New Build"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
          >
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}
          
          {/* Vehicle */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Vehicle</legend>
            <div className="grid grid-cols-4 gap-3">
              <input
                type="number"
                placeholder="Year"
                value={form.vehicleYear}
                onChange={(e) => setForm({ ...form, vehicleYear: parseInt(e.target.value) })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Make"
                value={form.vehicleMake}
                onChange={(e) => setForm({ ...form, vehicleMake: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Model"
                value={form.vehicleModel}
                onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Trim (optional)"
                value={form.vehicleTrim}
                onChange={(e) => setForm({ ...form, vehicleTrim: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
          
          {/* Build Style */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Build Style</legend>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.buildStyle}
                onChange={(e) => setForm({ ...form, buildStyle: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              >
                {BUILD_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {style.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Lift Level (e.g., 6-inch, leveled)"
                value={form.liftLevel}
                onChange={(e) => setForm({ ...form, liftLevel: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
          
          {/* Wheels */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Wheels</legend>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Brand"
                value={form.wheelBrand}
                onChange={(e) => setForm({ ...form, wheelBrand: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Model"
                value={form.wheelModel}
                onChange={(e) => setForm({ ...form, wheelModel: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Size (e.g., 20x10)"
                value={form.wheelSize}
                onChange={(e) => setForm({ ...form, wheelSize: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Finish (optional)"
                value={form.wheelFinish}
                onChange={(e) => setForm({ ...form, wheelFinish: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Offset (e.g., -18)"
                value={form.wheelOffset}
                onChange={(e) => setForm({ ...form, wheelOffset: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
          
          {/* Tires */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Tires</legend>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Brand"
                value={form.tireBrand}
                onChange={(e) => setForm({ ...form, tireBrand: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Model"
                value={form.tireModel}
                onChange={(e) => setForm({ ...form, tireModel: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Size (e.g., 35x12.50R20)"
                value={form.tireSize}
                onChange={(e) => setForm({ ...form, tireSize: e.target.value })}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </fieldset>
          
          {/* Image */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Hero Image</legend>
            <input
              type="url"
              placeholder="Image URL"
              value={form.heroImageUrl}
              onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              required
            />
            {form.heroImageUrl && (
              <div className="mt-2 relative w-48 h-32 rounded-xl overflow-hidden bg-neutral-100">
                <Image
                  src={form.heroImageUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </fieldset>
          
          {/* Metadata */}
          <fieldset>
            <legend className="text-sm font-bold text-neutral-700 mb-3">Metadata</legend>
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm mb-3"
            />
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-neutral-700">Featured</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isPopular}
                  onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm text-neutral-700">Popular</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-neutral-700">Order:</span>
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) })}
                  className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
            </div>
          </fieldset>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-700 text-sm font-medium hover:bg-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm font-bold hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : (build ? "Update Build" : "Create Build")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
