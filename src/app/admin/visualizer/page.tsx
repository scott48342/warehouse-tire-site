"use client";

import { useState, useEffect } from "react";
import { WheelVisualizerEditor, type VehicleVisualizerConfig } from "@/components/WheelVisualizer";

const NEW_CONFIG: VehicleVisualizerConfig = {
  vehicle: "New Vehicle",
  slug: "new-vehicle",
  image: "/visualizer/vehicles/",
  frontWheel: { top: 60, left: 70, size: 100 },
  rearWheel: { top: 60, left: 30, size: 100 },
};

interface SavedConfig {
  id: string;
  slug: string;
  vehicle: string;
  image: string;
  frontWheel: { top: number; left: number; size: number };
  rearWheel: { top: number; left: number; size: number };
  front_wheel?: { top: number; left: number; size: number };
  rear_wheel?: { top: number; left: number; size: number };
}

export default function VisualizerEditorPage() {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [config, setConfig] = useState<VehicleVisualizerConfig | null>(null);
  const [wheelUrl, setWheelUrl] = useState("/visualizer/wheels/wheel-basic.png");
  const [loading, setLoading] = useState(true);

  // Load saved configs on mount
  useEffect(() => {
    fetch("/api/admin/visualizer")
      .then((res) => res.json())
      .then((data) => {
        setConfigs(data);
        if (data.length > 0) {
          // Load first config
          const first = data[0];
          setSelectedSlug(first.slug);
          setConfig(transformConfig(first));
        } else {
          setConfig(NEW_CONFIG);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load configs:", err);
        setConfig(NEW_CONFIG);
        setLoading(false);
      });
  }, []);

  // Transform DB format to component format
  const transformConfig = (saved: SavedConfig): VehicleVisualizerConfig => ({
    vehicle: saved.vehicle,
    slug: saved.slug,
    image: saved.image,
    frontWheel: saved.front_wheel || saved.frontWheel,
    rearWheel: saved.rear_wheel || saved.rearWheel,
  });

  const handleSelectConfig = (slug: string) => {
    if (slug === "__new__") {
      setSelectedSlug(null);
      setConfig(NEW_CONFIG);
    } else {
      const found = configs.find((c) => c.slug === slug);
      if (found) {
        setSelectedSlug(slug);
        setConfig(transformConfig(found));
      }
    }
  };

  const handleSaveSuccess = async () => {
    // Refresh configs list
    const res = await fetch("/api/admin/visualizer");
    const data = await res.json();
    setConfigs(data);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-4xl text-center py-20">
          <div className="text-neutral-500">Loading saved configurations...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
          🛞 Wheel Visualizer Editor
        </h1>
        <p className="text-neutral-600 mb-6">
          Adjust wheel positions until they sit perfectly in the wheel wells.
        </p>

        {/* Config Selector */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-neutral-200">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Select Vehicle Configuration
          </label>
          <select
            value={selectedSlug || "__new__"}
            onChange={(e) => handleSelectConfig(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          >
            {configs.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.vehicle} ({c.slug})
              </option>
            ))}
            <option value="__new__">+ Create New Vehicle</option>
          </select>
        </div>

        {/* Wheel Image URL Input */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-neutral-200">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Test Wheel Image URL
          </label>
          <input
            type="text"
            value={wheelUrl}
            onChange={(e) => setWheelUrl(e.target.value)}
            placeholder="/visualizer/wheels/wheel-basic.png"
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Try a wheel image URL from your site (e.g., WheelPros CDN)
          </p>
        </div>

        {/* Editor */}
        {config && (
          <WheelVisualizerEditor
            key={config.slug} // Force re-mount when switching configs
            config={config}
            wheelImage={wheelUrl}
            onSave={async (cfg) => {
              const res = await fetch("/api/admin/visualizer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cfg),
              });
              if (!res.ok) throw new Error("Save failed");
              await handleSaveSuccess();
            }}
          />
        )}

        {/* Instructions */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-bold text-amber-900 mb-2">📋 Setup Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-amber-800">
            <li>
              Add your vehicle image to: <code className="bg-amber-100 px-1 rounded">/public/visualizer/vehicles/your-vehicle.png</code>
            </li>
            <li>
              Use the sliders to position wheels in the wheel wells
            </li>
            <li>
              Click <strong>Save Configuration</strong> to persist to database
            </li>
            <li>
              <a href="/admin/visualizer/preview" className="underline">Preview page</a> to test with different wheels
            </li>
          </ol>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex gap-4">
          <a
            href="/admin/visualizer/preview"
            className="px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition"
          >
            🔍 Preview Mode
          </a>
        </div>
      </div>
    </main>
  );
}
