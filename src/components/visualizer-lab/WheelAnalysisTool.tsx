"use client";

import React, { useState } from "react";
import type { WheelVisualizerMetadata } from "@/lib/visualizer-lab/wheelImageAnalysis";

interface WheelAnalysisResult {
  sku: string;
  brand?: string;
  style?: string;
  finish?: string;
  totalImages: number;
  analysis: WheelVisualizerMetadata;
  bestVisualizerImage: string | null;
  allImages: string[];
}

interface WheelAnalysisToolProps {
  onSelectImage?: (imageUrl: string) => void;
}

export function WheelAnalysisTool({ onSelectImage }: WheelAnalysisToolProps) {
  const [skuInput, setSkuInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WheelAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    const sku = skuInput.trim();
    if (!sku) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/visualizer-lab/wheel-analysis?sku=${encodeURIComponent(sku)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError("Failed to analyze wheel");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
      <h3 className="text-sm font-semibold text-neutral-300 mb-3">
        🔍 Wheel Compatibility Analyzer
      </h3>

      {/* SKU Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={skuInput}
          onChange={(e) => setSkuInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter wheel SKU (e.g., D10017907536)"
          className="flex-1 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !skuInput.trim()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? "..." : "Analyze"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Wheel Info */}
          <div className="p-3 bg-neutral-700/50 rounded-lg">
            <div className="text-sm font-semibold text-white mb-1">
              {result.brand} {result.style}
            </div>
            <div className="text-xs text-neutral-400">
              SKU: {result.sku} • Finish: {result.finish || "N/A"}
            </div>
          </div>

          {/* Compatibility Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg ${result.analysis.visualizerCompatible ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"}`}>
              <div className="text-xs text-neutral-400 mb-1">Visualizer Compatible</div>
              <div className={`text-lg font-bold ${result.analysis.visualizerCompatible ? "text-green-400" : "text-red-400"}`}>
                {result.analysis.visualizerCompatible ? "✓ YES" : "✗ NO"}
              </div>
            </div>
            <div className="p-3 bg-neutral-700/50 rounded-lg">
              <div className="text-xs text-neutral-400 mb-1">Primary Image Type</div>
              <div className="text-lg font-bold text-white capitalize">
                {result.analysis.imageType}
              </div>
            </div>
          </div>

          {/* Image Type Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={`p-2 rounded ${result.analysis.hasFaceImage ? "bg-green-900/30" : "bg-neutral-700/30"}`}>
              <div className="text-neutral-400">Face</div>
              <div className={result.analysis.hasFaceImage ? "text-green-400" : "text-neutral-500"}>
                {result.analysis.imagesByType.face.length} images
              </div>
            </div>
            <div className={`p-2 rounded ${result.analysis.hasAngledImage ? "bg-green-900/30" : "bg-neutral-700/30"}`}>
              <div className="text-neutral-400">Angled</div>
              <div className={result.analysis.hasAngledImage ? "text-green-400" : "text-neutral-500"}>
                {result.analysis.imagesByType.angled.length} images
              </div>
            </div>
            <div className="p-2 rounded bg-neutral-700/30">
              <div className="text-neutral-400">Other</div>
              <div className="text-neutral-500">
                {result.analysis.imagesByType.other.length} images
              </div>
            </div>
          </div>

          {/* Best Image Preview */}
          {result.bestVisualizerImage && (
            <div className="p-3 bg-neutral-700/50 rounded-lg">
              <div className="text-xs text-neutral-400 mb-2">Best Visualizer Image</div>
              <div className="flex items-start gap-3">
                <img
                  src={result.bestVisualizerImage}
                  alt="Wheel"
                  className="w-24 h-24 object-contain bg-neutral-800 rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-neutral-500 break-all mb-2">
                    {result.bestVisualizerImage}
                  </div>
                  {onSelectImage && (
                    <button
                      onClick={() => onSelectImage(result.bestVisualizerImage!)}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                    >
                      Use in Visualizer
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All Images */}
          {result.allImages.length > 0 && (
            <details className="text-xs">
              <summary className="text-neutral-500 cursor-pointer hover:text-neutral-300">
                View all {result.allImages.length} images
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {result.allImages.map((url, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={url}
                      alt={`View ${i + 1}`}
                      className="w-full aspect-square object-contain bg-neutral-800 rounded-lg cursor-pointer hover:ring-2 hover:ring-red-500"
                      onClick={() => onSelectImage?.(url)}
                    />
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white">
                      {url.includes("-FACE") ? "FACE" : url.includes("-A1") ? "A1" : url.includes("-A2") ? "A2" : "?"}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Help Text */}
      {!result && !error && (
        <div className="text-xs text-neutral-500">
          Enter a wheel SKU to analyze its visualizer compatibility and available image angles.
        </div>
      )}
    </div>
  );
}
