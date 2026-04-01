"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { WheelVisualizer } from "@/components/WheelVisualizer";

interface WheelPosition {
  top: number;
  left: number;
  size: number;
}

interface VisualizerConfig {
  id: string;
  slug: string;
  vehicle: string;
  year: number;
  make: string;
  model: string;
  category: string;
  image: string;
  frontWheel: WheelPosition;
  rearWheel: WheelPosition;
  front_wheel?: WheelPosition;
  rear_wheel?: WheelPosition;
  status: string;
  version: number;
  source: string;
  generationPrompt: string;
  reviewNotes: string | null;
  createdAt: string;
}

// Sample wheel for preview
const SAMPLE_WHEEL = "https://assets.wheelpros.com/transform/f8844043-9358-45a2-80d4-e5db25c4e012/PR1483-png?size=500";

export default function DraftReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [config, setConfig] = useState<VisualizerConfig | null>(null);
  const [frontWheel, setFrontWheel] = useState<WheelPosition>({ top: 70, left: 75, size: 90 });
  const [rearWheel, setRearWheel] = useState<WheelPosition>({ top: 70, left: 25, size: 90 });
  const [wheelUrl, setWheelUrl] = useState(SAMPLE_WHEEL);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [id]);

  const loadConfig = async () => {
    try {
      const res = await fetch(`/api/admin/visualizer/${id}`);
      if (!res.ok) throw new Error("Config not found");
      
      const data = await res.json();
      setConfig(data);
      
      // Handle both camelCase and snake_case from DB
      const front = data.frontWheel || data.front_wheel;
      const rear = data.rearWheel || data.rear_wheel;
      
      setFrontWheel(front);
      setRearWheel(rear);
      setReviewNotes(data.reviewNotes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePositions = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/visualizer/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frontWheel,
          rearWheel,
          reviewNotes,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      // Save positions first
      await fetch(`/api/admin/visualizer/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frontWheel, rearWheel, reviewNotes }),
      });

      // Then approve
      const res = await fetch(`/api/admin/visualizer/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          reviewedBy: "admin",
          setActive: true,
        }),
      });
      if (!res.ok) throw new Error("Approve failed");
      
      router.push("/admin/visualizer/drafts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!confirm("Reject this vehicle? You can regenerate or delete it later.")) return;
    
    setActionLoading("reject");
    try {
      const res = await fetch(`/api/admin/visualizer/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reviewedBy: "admin",
          reviewNotes,
        }),
      });
      if (!res.ok) throw new Error("Reject failed");
      
      router.push("/admin/visualizer/drafts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async () => {
    if (!confirm("Generate a new image? This will create a new version as draft.")) return;
    
    setActionLoading("regenerate");
    try {
      const res = await fetch(`/api/admin/visualizer/${id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Regenerate failed");
      
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8 flex items-center justify-center">
        <div className="text-neutral-500">Loading...</div>
      </main>
    );
  }

  if (error && !config) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </main>
    );
  }

  if (!config) return null;

  const visualizerConfig = {
    vehicle: config.vehicle,
    slug: config.slug,
    image: config.image,
    frontWheel,
    rearWheel,
  };

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-neutral-900">
                {config.vehicle}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                config.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                config.status === "approved" ? "bg-green-100 text-green-800" :
                "bg-red-100 text-red-800"
              }`}>
                {config.status}
              </span>
              {config.source === "ai_generated" && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                  AI Generated
                </span>
              )}
            </div>
            <p className="text-neutral-500">
              v{config.version} · {config.slug} · {config.category}
            </p>
          </div>
          <a
            href="/admin/visualizer/drafts"
            className="text-neutral-600 hover:underline"
          >
            ← Back to list
          </a>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visualizer Preview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <h2 className="font-bold mb-4">Preview with Sample Wheel</h2>
              <WheelVisualizer
                config={visualizerConfig}
                wheelImage={wheelUrl}
                width={650}
                showGuides
              />
            </div>

            {/* Wheel URL Input */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Test Wheel Image
              </label>
              <input
                type="text"
                value={wheelUrl}
                onChange={(e) => setWheelUrl(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                placeholder="Wheel image URL..."
              />
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Position Sliders */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <h3 className="font-bold mb-4">Front Wheel</h3>
              <label className="block text-sm mb-2">
                Top: {frontWheel.top}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={frontWheel.top}
                  onChange={(e) => setFrontWheel({ ...frontWheel, top: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-sm mb-2">
                Left: {frontWheel.left}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={frontWheel.left}
                  onChange={(e) => setFrontWheel({ ...frontWheel, left: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-sm">
                Size: {frontWheel.size}px
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={frontWheel.size}
                  onChange={(e) => setFrontWheel({ ...frontWheel, size: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <h3 className="font-bold mb-4">Rear Wheel</h3>
              <label className="block text-sm mb-2">
                Top: {rearWheel.top}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rearWheel.top}
                  onChange={(e) => setRearWheel({ ...rearWheel, top: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-sm mb-2">
                Left: {rearWheel.left}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rearWheel.left}
                  onChange={(e) => setRearWheel({ ...rearWheel, left: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-sm">
                Size: {rearWheel.size}px
                <input
                  type="range"
                  min={50}
                  max={200}
                  value={rearWheel.size}
                  onChange={(e) => setRearWheel({ ...rearWheel, size: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            </div>

            {/* Review Notes */}
            <div className="bg-white rounded-xl border border-neutral-200 p-4">
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Review Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                placeholder="Any notes about this vehicle..."
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSavePositions}
              disabled={saving}
              className="w-full py-3 bg-neutral-800 text-white rounded-lg font-semibold hover:bg-neutral-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "💾 Save Positions"}
            </button>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {actionLoading === "approve" ? "..." : "✓ Approve"}
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {actionLoading === "reject" ? "..." : "✗ Reject"}
              </button>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={!!actionLoading}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
            >
              {actionLoading === "regenerate" ? "Generating..." : "🔄 Regenerate Image"}
            </button>
          </div>
        </div>

        {/* Generation Prompt (if AI generated) */}
        {config.generationPrompt && (
          <div className="mt-6 p-4 bg-neutral-100 rounded-xl">
            <h3 className="font-bold text-sm text-neutral-600 mb-2">Generation Prompt</h3>
            <p className="text-xs text-neutral-500 font-mono">
              {config.generationPrompt}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
