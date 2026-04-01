"use client";

import { useState, useEffect } from "react";
import { WheelVisualizer, WheelVisualizerWithPicker, VehicleVisualizerConfig } from "@/components/WheelVisualizer";

// Sample wheels to test with
const SAMPLE_WHEELS = [
  {
    id: "iroc",
    name: "IROC-Z Replica",
    imageUrl: "https://assets.wheelpros.com/transform/f8844043-9358-45a2-80d4-e5db25c4e012/PR1483-png?size=500",
    price: 289,
  },
  {
    id: "basic",
    name: "Basic Test",
    imageUrl: "/visualizer/wheels/wheel-basic.png",
    price: 199,
  },
  {
    id: "pro1",
    name: "VN507 Rodder",
    imageUrl: "https://assets.wheelpros.com/transform/5d3d3c91-9e08-4e58-9e5e-b8ccfff4f9a1/VN5077-png?size=500",
    price: 329,
  },
];

interface SavedConfig {
  id: string;
  slug: string;
  vehicle: string;
  image: string;
  frontWheel?: { top: number; left: number; size: number };
  rearWheel?: { top: number; left: number; size: number };
  front_wheel?: { top: number; left: number; size: number };
  rear_wheel?: { top: number; left: number; size: number };
}

export default function VisualizerPreviewPage() {
  const [configs, setConfigs] = useState<VehicleVisualizerConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<VehicleVisualizerConfig | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [selectedWheel, setSelectedWheel] = useState(SAMPLE_WHEELS[0]);
  const [loading, setLoading] = useState(true);

  // Load saved configs from database
  useEffect(() => {
    fetch("/api/admin/visualizer")
      .then((res) => res.json())
      .then((data: SavedConfig[]) => {
        const transformed = data.map((c) => ({
          vehicle: c.vehicle,
          slug: c.slug,
          image: c.image,
          frontWheel: c.front_wheel || c.frontWheel || { top: 60, left: 70, size: 100 },
          rearWheel: c.rear_wheel || c.rearWheel || { top: 60, left: 30, size: 100 },
        }));
        setConfigs(transformed);
        if (transformed.length > 0) {
          setSelectedConfig(transformed[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load configs:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-5xl text-center py-20">
          <div className="text-neutral-500">Loading configurations...</div>
        </div>
      </main>
    );
  }

  if (!selectedConfig) {
    return (
      <main className="min-h-screen bg-neutral-50 p-8">
        <div className="mx-auto max-w-5xl text-center py-20">
          <div className="text-neutral-500 mb-4">No vehicle configurations found.</div>
          <a
            href="/admin/visualizer"
            className="text-red-600 hover:underline font-medium"
          >
            → Go to Editor to create one
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
            🔍 Visualizer Preview
          </h1>
          <p className="text-neutral-600">
            Test how the visualizer looks with your saved configurations.
          </p>
        </div>

        {/* Vehicle Selector */}
        {configs.length > 1 && (
          <div className="p-4 bg-white rounded-xl border border-neutral-200">
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Select Vehicle
            </label>
            <select
              value={selectedConfig.slug}
              onChange={(e) => {
                const found = configs.find((c) => c.slug === e.target.value);
                if (found) setSelectedConfig(found);
              }}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg"
            >
              {configs.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.vehicle}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section 1: With Picker Component */}
        <section className="p-6 bg-white rounded-2xl border border-neutral-200">
          <h2 className="text-xl font-bold mb-4">Option A: With Wheel Picker</h2>
          <p className="text-sm text-neutral-500 mb-4">
            This is the ready-to-use component with thumbnail selector. Click wheels to swap.
          </p>
          
          <WheelVisualizerWithPicker
            config={selectedConfig}
            wheels={SAMPLE_WHEELS}
            width={600}
            onWheelSelect={(w) => console.log("Selected:", w)}
          />
        </section>

        {/* Section 2: Manual URL Test */}
        <section className="p-6 bg-white rounded-2xl border border-neutral-200">
          <h2 className="text-xl font-bold mb-4">Option B: Test Any Wheel URL</h2>
          <p className="text-sm text-neutral-500 mb-4">
            Paste any wheel image URL to see how it looks.
          </p>
          
          <div className="mb-4">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Paste wheel image URL here..."
              className="w-full px-4 py-3 border border-neutral-300 rounded-lg"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Try: https://assets.wheelpros.com/transform/.../xxx-png?size=500
            </p>
          </div>

          <WheelVisualizer
            config={selectedConfig}
            wheelImage={customUrl || "/visualizer/wheels/wheel-basic.png"}
            width={600}
          />
        </section>

        {/* Section 3: Click-to-Select Demo */}
        <section className="p-6 bg-white rounded-2xl border border-neutral-200">
          <h2 className="text-xl font-bold mb-4">Option C: Simulated Results Page</h2>
          <p className="text-sm text-neutral-500 mb-4">
            This simulates how it would work on a wheel search results page.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visualizer */}
            <div>
              <WheelVisualizer
                config={selectedConfig}
                wheelImage={selectedWheel.imageUrl}
                width={450}
              />
              <div className="mt-2 text-center text-sm text-neutral-600">
                Showing: <span className="font-semibold">{selectedWheel.name}</span>
              </div>
            </div>

            {/* Wheel Grid (like results) */}
            <div>
              <h3 className="font-semibold mb-3">Click a wheel to preview:</h3>
              <div className="grid grid-cols-2 gap-3">
                {SAMPLE_WHEELS.map((wheel) => (
                  <button
                    key={wheel.id}
                    onClick={() => setSelectedWheel(wheel)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      wheel.id === selectedWheel.id
                        ? "border-red-600 bg-red-50"
                        : "border-neutral-200 hover:border-neutral-400"
                    }`}
                  >
                    <img
                      src={wheel.imageUrl}
                      alt={wheel.name}
                      className="w-full h-24 object-contain mb-2"
                    />
                    <div className="text-sm font-medium">{wheel.name}</div>
                    <div className="text-red-600 font-bold">${wheel.price}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Current Config Display */}
        <section className="p-6 bg-neutral-900 rounded-2xl text-green-400 font-mono text-sm">
          <h2 className="text-white font-bold mb-4">Current Configuration (from database):</h2>
          <pre className="overflow-auto">{JSON.stringify(selectedConfig, null, 2)}</pre>
        </section>

        {/* Link back */}
        <div className="text-center">
          <a
            href="/admin/visualizer"
            className="text-red-600 hover:underline font-medium"
          >
            ← Back to Editor (adjust wheel positions)
          </a>
        </div>
      </div>
    </main>
  );
}
