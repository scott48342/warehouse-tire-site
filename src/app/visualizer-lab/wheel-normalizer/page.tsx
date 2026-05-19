"use client";

/**
 * Wheel Normalizer Lab
 * 
 * Tool for managing wheel image assets for the visualizer.
 * Handles: comparing original vs normalized, storing status, preview on Tundra.
 * 
 * Statuses:
 * - usable_direct: Supplier image is already front-facing and transparent
 * - manual_upload_normalized: We manually uploaded a normalized asset
 * - needs_ai_cleanup: Supplier image is angled, marked for future AI processing
 * - rejected: Image is too poor to use
 * 
 * NO REGRESSION: This is an isolated lab tool. Does not affect any production flows.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

type WheelStatus = "usable_direct" | "manual_upload_normalized" | "needs_ai_cleanup" | "rejected" | "pending";

interface WheelAssetConfig {
  // Identification
  sku: string;
  name: string;
  brand: string;
  
  // Source (original supplier image)
  originalUrl: string;
  
  // Normalized asset (manually uploaded/created)
  normalizedUrl: string;
  
  // Status
  status: WheelStatus;
  
  // Metadata
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface QualityChecklist {
  transparentBg: boolean;
  squareCanvas: boolean;
  centered: boolean;
  frontFacing: boolean;
  noTire: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: WheelAssetConfig = {
  sku: "",
  name: "",
  brand: "",
  originalUrl: "",
  normalizedUrl: "",
  status: "pending",
  notes: "",
  createdAt: "",
  updatedAt: "",
};

const DEFAULT_CHECKLIST: QualityChecklist = {
  transparentBg: false,
  squareCanvas: false,
  centered: false,
  frontFacing: false,
  noTire: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getStatusColor(status: WheelStatus): string {
  switch (status) {
    case "usable_direct": return "text-green-400 bg-green-900/30 border-green-700";
    case "manual_upload_normalized": return "text-cyan-400 bg-cyan-900/30 border-cyan-700";
    case "needs_ai_cleanup": return "text-orange-400 bg-orange-900/30 border-orange-700";
    case "rejected": return "text-red-400 bg-red-900/30 border-red-700";
    default: return "text-gray-400 bg-zinc-800 border-zinc-700";
  }
}

function getStatusLabel(status: WheelStatus): string {
  switch (status) {
    case "usable_direct": return "✅ Usable Direct";
    case "manual_upload_normalized": return "📤 Manual Upload (Normalized)";
    case "needs_ai_cleanup": return "🤖 Needs AI Cleanup";
    case "rejected": return "❌ Rejected";
    default: return "⏳ Pending Review";
  }
}

function getStatusDescription(status: WheelStatus): string {
  switch (status) {
    case "usable_direct": return "Supplier image is front-facing and transparent. Ready for visualizer.";
    case "manual_upload_normalized": return "Using manually uploaded normalized asset.";
    case "needs_ai_cleanup": return "Supplier image is angled. Marked for future AI processing.";
    case "rejected": return "Image quality too poor. Cannot be used.";
    default: return "Review the image and select a status.";
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WheelNormalizerPage() {
  const [config, setConfig] = useState<WheelAssetConfig>(DEFAULT_CONFIG);
  const [checklist, setChecklist] = useState<QualityChecklist>(DEFAULT_CHECKLIST);
  
  // URL inputs
  const [originalUrlInput, setOriginalUrlInput] = useState("");
  const [normalizedUrlInput, setNormalizedUrlInput] = useState("");
  
  // Image states
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [normalizedImage, setNormalizedImage] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [normalizedSize, setNormalizedSize] = useState({ width: 0, height: 0 });
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Refs for measuring
  const originalImgRef = useRef<HTMLImageElement>(null);
  const normalizedImgRef = useRef<HTMLImageElement>(null);
  
  // Load original image
  const loadOriginalImage = useCallback(async () => {
    const url = originalUrlInput.trim();
    if (!url) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Use proxy for external URLs
      const proxyUrl = url.startsWith("http") 
        ? `/api/image-proxy?url=${encodeURIComponent(url)}` 
        : url;
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load original image"));
        img.src = proxyUrl;
      });
      
      setOriginalImage(proxyUrl);
      setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setConfig(prev => ({ 
        ...prev, 
        originalUrl: url,
        createdAt: prev.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      // Auto-detect some checklist items
      const isSquare = Math.abs(img.naturalWidth - img.naturalHeight) < 10;
      setChecklist(prev => ({ ...prev, squareCanvas: isSquare }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image");
      setOriginalImage(null);
    } finally {
      setLoading(false);
    }
  }, [originalUrlInput]);
  
  // Load normalized image
  const loadNormalizedImage = useCallback(async () => {
    const url = normalizedUrlInput.trim();
    if (!url) return;
    
    setLoading(true);
    setError("");
    
    try {
      const proxyUrl = url.startsWith("http") 
        ? `/api/image-proxy?url=${encodeURIComponent(url)}` 
        : url;
      
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load normalized image"));
        img.src = proxyUrl;
      });
      
      setNormalizedImage(proxyUrl);
      setNormalizedSize({ width: img.naturalWidth, height: img.naturalHeight });
      setConfig(prev => ({ 
        ...prev, 
        normalizedUrl: url,
        status: "manual_upload_normalized",
        updatedAt: new Date().toISOString(),
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load normalized image");
      setNormalizedImage(null);
    } finally {
      setLoading(false);
    }
  }, [normalizedUrlInput]);
  
  // Preview on Tundra (uses normalized if available, else original)
  const previewOnTundra = useCallback(() => {
    const imageToUse = normalizedImage || originalImage;
    if (!imageToUse) return;
    
    sessionStorage.setItem("normalizer-preview-wheel", imageToUse);
    window.open("/visualizer-lab/tundra-test", "_blank");
  }, [normalizedImage, originalImage]);
  
  // Copy config JSON
  const copyConfig = useCallback(() => {
    const exportConfig = {
      ...config,
      checklist,
      exportedAt: new Date().toISOString(),
    };
    
    navigator.clipboard.writeText(JSON.stringify(exportConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [config, checklist]);
  
  // Set status
  const setStatus = (status: WheelStatus) => {
    setConfig(prev => ({ 
      ...prev, 
      status,
      updatedAt: new Date().toISOString(),
    }));
  };
  
  // Mark as usable direct (original is good)
  const markUsableDirect = () => {
    setConfig(prev => ({
      ...prev,
      status: "usable_direct",
      normalizedUrl: prev.originalUrl, // Use original as the asset
      updatedAt: new Date().toISOString(),
    }));
    setNormalizedImage(originalImage);
    setNormalizedUrlInput(originalUrlInput);
  };
  
  // Get the active wheel URL for visualizer
  const getActiveWheelUrl = (): string => {
    if (config.status === "usable_direct") return config.originalUrl;
    if (config.status === "manual_upload_normalized") return config.normalizedUrl;
    return "";
  };
  
  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🔧 Wheel Asset Manager</h1>
          <p className="text-zinc-400">
            Manage wheel images for the visualizer. Compare original supplier images with normalized assets.
          </p>
          
          {/* Status Legend */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
              <div className="font-semibold text-green-400">✅ Usable Direct</div>
              <p className="text-green-300/70 text-xs">Front-facing, transparent. Ready to use.</p>
            </div>
            <div className="bg-cyan-900/30 border border-cyan-700 rounded-lg p-3">
              <div className="font-semibold text-cyan-400">📤 Manual Upload</div>
              <p className="text-cyan-300/70 text-xs">Using manually created normalized asset.</p>
            </div>
            <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-3">
              <div className="font-semibold text-orange-400">🤖 Needs AI Cleanup</div>
              <p className="text-orange-300/70 text-xs">Angled image. Marked for future processing.</p>
            </div>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <div className="font-semibold text-red-400">❌ Rejected</div>
              <p className="text-red-300/70 text-xs">Quality too poor. Cannot be used.</p>
            </div>
          </div>
        </div>
        
        {/* Identification */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">🏷️ Wheel Identification</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">SKU</label>
              <input
                type="text"
                value={config.sku}
                onChange={(e) => setConfig(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="e.g., MO9862090018"
                className="w-full bg-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Brand</label>
              <input
                type="text"
                value={config.brand}
                onChange={(e) => setConfig(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="e.g., Moto Metal"
                className="w-full bg-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name/Model</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., MO986 Siege"
                className="w-full bg-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        
        {/* Image URLs */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">🖼️ Image Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Original URL */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Original Supplier Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={originalUrlInput}
                  onChange={(e) => setOriginalUrlInput(e.target.value)}
                  placeholder="https://supplier.com/wheel.png"
                  className="flex-1 bg-zinc-700 rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && loadOriginalImage()}
                />
                <button
                  onClick={loadOriginalImage}
                  disabled={loading || !originalUrlInput.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 px-4 py-2 rounded text-sm font-medium"
                >
                  Load
                </button>
              </div>
            </div>
            
            {/* Normalized URL */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Normalized Asset URL (manual upload)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={normalizedUrlInput}
                  onChange={(e) => setNormalizedUrlInput(e.target.value)}
                  placeholder="https://cdn.example.com/normalized-wheel.png"
                  className="flex-1 bg-zinc-700 rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && loadNormalizedImage()}
                />
                <button
                  onClick={loadNormalizedImage}
                  disabled={loading || !normalizedUrlInput.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-600 px-4 py-2 rounded text-sm font-medium"
                >
                  Load
                </button>
              </div>
            </div>
          </div>
          
          {error && (
            <p className="text-red-400 text-sm mt-2">❌ {error}</p>
          )}
        </div>
        
        {/* Side by Side Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Original Image */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">📷 Original (Supplier)</h2>
            <div 
              className="aspect-square rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-600"
              style={{ 
                backgroundImage: "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
              }}
            >
              {originalImage ? (
                <img
                  ref={originalImgRef}
                  src={originalImage}
                  alt="Original supplier wheel"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-zinc-500">Load original image</span>
              )}
            </div>
            {originalImage && (
              <p className="text-xs text-zinc-500 mt-2 text-center">
                {originalSize.width} × {originalSize.height}px
                {originalSize.width !== originalSize.height && (
                  <span className="text-yellow-400 ml-2">⚠️ Not square</span>
                )}
              </p>
            )}
          </div>
          
          {/* Normalized Image */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">🎯 Normalized (Visualizer-Ready)</h2>
            <div 
              className="aspect-square rounded-lg flex items-center justify-center overflow-hidden border-2 border-zinc-600"
              style={{ 
                backgroundImage: "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
              }}
            >
              {normalizedImage ? (
                <img
                  ref={normalizedImgRef}
                  src={normalizedImage}
                  alt="Normalized wheel"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-zinc-500">
                  <p>No normalized asset yet</p>
                  <p className="text-xs mt-1">Load a normalized URL or mark original as usable</p>
                </div>
              )}
            </div>
            {normalizedImage && (
              <p className="text-xs text-zinc-500 mt-2 text-center">
                {normalizedSize.width} × {normalizedSize.height}px
                {normalizedSize.width === normalizedSize.height && normalizedSize.width >= 400 && (
                  <span className="text-green-400 ml-2">✓ Good size</span>
                )}
              </p>
            )}
          </div>
        </div>
        
        {/* Quality Checklist & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Quality Checklist */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">✅ Quality Checklist</h2>
            <p className="text-xs text-zinc-500 mb-3">Check what applies to the ORIGINAL image:</p>
            
            <div className="space-y-2">
              {[
                { key: "transparentBg", label: "Transparent background" },
                { key: "squareCanvas", label: "Square canvas" },
                { key: "centered", label: "Wheel centered" },
                { key: "frontFacing", label: "Front-facing view" },
                { key: "noTire", label: "No tire included" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[key as keyof QualityChecklist]}
                    onChange={(e) => setChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded bg-zinc-700 border-zinc-600"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            
            {/* Auto-determine suggestion */}
            {originalImage && (
              <div className="mt-4 p-3 bg-zinc-900 rounded text-xs">
                <p className="font-semibold mb-1">Suggested status:</p>
                {checklist.frontFacing && checklist.transparentBg && checklist.centered ? (
                  <p className="text-green-400">✅ Original looks usable directly</p>
                ) : !checklist.frontFacing ? (
                  <p className="text-orange-400">🤖 Needs AI cleanup (angled view)</p>
                ) : (
                  <p className="text-yellow-400">🔧 May need manual cleanup</p>
                )}
              </div>
            )}
          </div>
          
          {/* Status Selection */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">📊 Set Status</h2>
            
            <div className="space-y-2">
              <button
                onClick={markUsableDirect}
                disabled={!originalImage}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  config.status === "usable_direct" 
                    ? "bg-green-900/50 border-green-500 text-green-300" 
                    : "bg-zinc-700 border-zinc-600 hover:border-green-500 disabled:opacity-50"
                }`}
              >
                ✅ Usable Direct
                <p className="text-xs opacity-70">Original is visualizer-ready</p>
              </button>
              
              <button
                onClick={() => setStatus("manual_upload_normalized")}
                disabled={!normalizedImage || normalizedImage === originalImage}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  config.status === "manual_upload_normalized" 
                    ? "bg-cyan-900/50 border-cyan-500 text-cyan-300" 
                    : "bg-zinc-700 border-zinc-600 hover:border-cyan-500 disabled:opacity-50"
                }`}
              >
                📤 Manual Upload
                <p className="text-xs opacity-70">Using uploaded normalized asset</p>
              </button>
              
              <button
                onClick={() => setStatus("needs_ai_cleanup")}
                disabled={!originalImage}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  config.status === "needs_ai_cleanup" 
                    ? "bg-orange-900/50 border-orange-500 text-orange-300" 
                    : "bg-zinc-700 border-zinc-600 hover:border-orange-500 disabled:opacity-50"
                }`}
              >
                🤖 Needs AI Cleanup
                <p className="text-xs opacity-70">Mark for future AI processing</p>
              </button>
              
              <button
                onClick={() => setStatus("rejected")}
                disabled={!originalImage}
                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                  config.status === "rejected" 
                    ? "bg-red-900/50 border-red-500 text-red-300" 
                    : "bg-zinc-700 border-zinc-600 hover:border-red-500 disabled:opacity-50"
                }`}
              >
                ❌ Rejected
                <p className="text-xs opacity-70">Image cannot be used</p>
              </button>
            </div>
            
            {/* Current Status Display */}
            <div className={`mt-4 p-3 rounded border ${getStatusColor(config.status)}`}>
              <p className="font-semibold">{getStatusLabel(config.status)}</p>
              <p className="text-xs opacity-70 mt-1">{getStatusDescription(config.status)}</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">🚀 Actions</h2>
            
            <div className="space-y-3">
              <button
                onClick={previewOnTundra}
                disabled={!originalImage && !normalizedImage}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-600 px-4 py-3 rounded font-medium transition-colors"
              >
                🚗 Preview on Tundra
                <p className="text-xs opacity-70">
                  Uses: {normalizedImage ? "Normalized" : "Original"}
                </p>
              </button>
              
              <button
                onClick={copyConfig}
                disabled={!config.originalUrl}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 px-4 py-3 rounded font-medium transition-colors"
              >
                {copied ? "✅ Copied!" : "📋 Copy Config JSON"}
              </button>
              
              {/* Active URL display */}
              {getActiveWheelUrl() && (
                <div className="p-3 bg-zinc-900 rounded text-xs">
                  <p className="font-semibold text-zinc-400 mb-1">Active Wheel URL:</p>
                  <p className="text-green-400 break-all">{getActiveWheelUrl()}</p>
                </div>
              )}
            </div>
            
            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm text-zinc-400 mb-1">Notes</label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any notes about this wheel asset..."
                className="w-full h-20 bg-zinc-700 rounded px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        </div>
        
        {/* Future AI Section (placeholder) */}
        <div className="bg-gradient-to-r from-orange-900/20 to-yellow-900/20 border border-orange-700/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="font-semibold text-orange-300">AI Normalization (Coming Soon)</h3>
              <p className="text-sm text-orange-200/70 mt-1">
                Future feature: Automatically convert angled wheel images to front-facing assets using AI image generation.
                For now, wheels marked as &quot;Needs AI Cleanup&quot; should be manually processed or uploaded.
              </p>
              <p className="text-xs text-orange-200/50 mt-2">
                Architecture is ready — just needs an image generation API (DALL·E, Stable Diffusion, etc.) to be plugged in.
              </p>
            </div>
          </div>
        </div>
        
        {/* Config Preview */}
        <details className="mt-6">
          <summary className="cursor-pointer text-zinc-400 hover:text-white">
            📄 View Config JSON
          </summary>
          <pre className="mt-2 p-4 bg-zinc-800 rounded-lg text-xs overflow-auto max-h-64">
            {JSON.stringify({ ...config, checklist }, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
