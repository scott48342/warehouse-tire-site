"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface VisualizerConfig {
  id: string;
  slug: string;
  vehicle: string;
  image: string;
  status: string;
  version: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export default function DraftsListPage() {
  const [configs, setConfigs] = useState<VisualizerConfig[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "approved" | "rejected">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigs();
  }, [filter]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const url = filter === "all" 
        ? "/api/admin/visualizer"
        : `/api/admin/visualizer?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setConfigs(data);
    } catch (err) {
      console.error("Failed to load configs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, vehicle: string) => {
    if (!confirm(`Delete "${vehicle}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/visualizer/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadConfigs();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
        {status}
      </span>
    );
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
              📋 Visualizer Assets
            </h1>
            <p className="text-neutral-600">
              Review, adjust, and approve vehicle assets for the wheel visualizer.
            </p>
          </div>
          <Link
            href="/admin/visualizer/generate"
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
          >
            + Generate New
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(["all", "draft", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === f
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading...</div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-lg mb-4">No vehicles found</div>
            <Link
              href="/admin/visualizer/generate"
              className="text-red-600 hover:underline font-medium"
            >
              Generate your first vehicle →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <div
                key={config.id}
                className="bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-lg transition"
              >
                {/* Image */}
                <div className="aspect-video bg-neutral-100 relative">
                  <img
                    src={config.image}
                    alt={config.vehicle}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2">
                    {statusBadge(config.status)}
                  </div>
                  {config.source === "ai_generated" && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                      AI Generated
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-neutral-900">
                    {config.vehicle}
                  </h3>
                  <p className="text-sm text-neutral-500 mb-3">
                    v{config.version} · {config.slug}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/visualizer/drafts/${config.id}`}
                      className="flex-1 text-center px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-200 transition"
                    >
                      Review
                    </Link>
                    <button
                      onClick={() => handleDelete(config.id, config.vehicle)}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Links */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/admin/visualizer"
            className="text-neutral-600 hover:underline"
          >
            ← Back to Editor
          </Link>
          <Link
            href="/admin/visualizer/preview"
            className="text-neutral-600 hover:underline"
          >
            Preview Mode
          </Link>
        </div>
      </div>
    </main>
  );
}
