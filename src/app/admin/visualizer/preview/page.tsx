"use client";

import { useState } from "react";
import { WheelVisualizer, WheelVisualizerWithPicker, VehicleVisualizerConfig } from "@/components/WheelVisualizer";

// Sample vehicle config (same as editor default)
const CAMARO_CONFIG: VehicleVisualizerConfig = {
  vehicle: "1969 Camaro",
  slug: "1969-chevrolet-camaro",
  image: "/visualizer/vehicles/1969-camaro.png",
  frontWheel: { top: 64, left: 64, size: 130 },
  rearWheel: { top: 64, left: 28, size: 130 },
};

// Sample wheels to test with - mix of WheelPros and placeholder URLs
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
  {
    id: "pro2", 
    name: "AR61 Outlaw",
    imageUrl: "https://assets.wheelpros.com/transform/4c5c5c91-1234-4e58-9e5e-a1bcfff4f9b2/AR617-png?size=500",
    price: 269,
  },
];

export default function VisualizerPreviewPage() {
  const [customUrl, setCustomUrl] = useState("");
  const [selectedWheel, setSelectedWheel] = useState(SAMPLE_WHEELS[0]);

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
            🔍 Visualizer Preview
          </h1>
          <p className="text-neutral-600">
            Test how the visualizer looks before going live. Try different wheel images.
          </p>
        </div>

        {/* Section 1: With Picker Component */}
        <section className="p-6 bg-white rounded-2xl border border-neutral-200">
          <h2 className="text-xl font-bold mb-4">Option A: With Wheel Picker</h2>
          <p className="text-sm text-neutral-500 mb-4">
            This is the ready-to-use component with thumbnail selector. Click wheels to swap.
          </p>
          
          <WheelVisualizerWithPicker
            config={CAMARO_CONFIG}
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
            config={CAMARO_CONFIG}
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
                config={CAMARO_CONFIG}
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

        {/* Code Examples */}
        <section className="p-6 bg-neutral-900 rounded-2xl text-green-400 font-mono text-sm">
          <h2 className="text-white font-bold mb-4">Integration Code:</h2>
          <pre className="overflow-auto">{`// On wheel results page:
import { WheelVisualizer } from "@/components/WheelVisualizer";

// Pass the wheel's image URL dynamically
<WheelVisualizer
  configSlug="1969-chevrolet-camaro"  // or config={...}
  wheelImage={selectedWheel.imageUrl}
  width={500}
/>`}</pre>
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
