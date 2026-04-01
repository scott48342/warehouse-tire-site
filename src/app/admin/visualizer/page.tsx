"use client";

import { useState } from "react";
import { WheelVisualizerEditor, type VehicleVisualizerConfig } from "@/components/WheelVisualizer";

const DEFAULT_CONFIG: VehicleVisualizerConfig = {
  vehicle: "1969 Camaro",
  slug: "1969-chevrolet-camaro",
  image: "/visualizer/vehicles/1969-camaro.png",
  frontWheel: {
    top: 64,
    left: 64,
    size: 130,
  },
  rearWheel: {
    top: 64,
    left: 28,
    size: 130,
  },
};

export default function VisualizerEditorPage() {
  const [wheelUrl, setWheelUrl] = useState("/visualizer/wheels/wheel-basic.png");

  return (
    <main className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">
          🛞 Wheel Visualizer Editor
        </h1>
        <p className="text-neutral-600 mb-6">
          Adjust wheel positions until they sit perfectly in the wheel wells. 
          Copy the JSON output to save your config.
        </p>

        {/* Wheel Image URL Input */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-neutral-200">
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Wheel Image URL
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
        <WheelVisualizerEditor config={DEFAULT_CONFIG} wheelImage={wheelUrl} />

        {/* Instructions */}
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-bold text-amber-900 mb-2">📋 Setup Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-amber-800">
            <li>
              Add your vehicle image to: <code className="bg-amber-100 px-1 rounded">/public/visualizer/vehicles/1969-camaro.png</code>
            </li>
            <li>
              Add a wheel image to: <code className="bg-amber-100 px-1 rounded">/public/visualizer/wheels/wheel-basic.png</code>
            </li>
            <li>
              Use the sliders to position wheels in the wheel wells
            </li>
            <li>
              Copy the JSON output and save to the config file
            </li>
          </ol>
        </div>
      </div>
    </main>
  );
}
