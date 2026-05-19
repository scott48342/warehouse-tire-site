"use client";

/**
 * Wheel Normalizer Lab
 * 
 * Tool for preparing wheel images for the visualizer.
 * Handles: cropping, padding, centering, rotation, background removal, export.
 * 
 * NO REGRESSION: This is an isolated lab tool. Does not affect any production flows.
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface NormalizationConfig {
  // Source
  sourceUrl: string;
  sku: string;
  name: string;
  
  // Canvas settings
  outputSize: number;        // Square output (e.g., 500x500)
  padding: number;           // Padding around wheel (0-100, percentage)
  
  // Transform
  scale: number;             // 0.5-2.0
  rotation: number;          // -180 to 180 degrees
  centerX: number;           // -100 to 100 (percentage offset)
  centerY: number;           // -100 to 100 (percentage offset)
  
  // Adjustments
  brightness: number;        // 0.5-1.5
  contrast: number;          // 0.5-1.5
  
  // Background
  removeBackground: boolean;
  bgThreshold: number;       // 0-255 for simple bg removal
  bgColor: string;           // Color to remove (hex)
}

interface QualityChecklist {
  transparentBg: boolean;
  squareCanvas: boolean;
  centered: boolean;
  frontFacing: boolean;
  noTire: boolean;
  approved: boolean;
}

type WheelStatus = "usable_direct" | "ai_normalized" | "needs_manual_cleanup" | "needs_ai_cleanup" | "rejected" | "pending";

interface AINormalizationResult {
  imageUrl: string;
  prompt: string;
  model: string;
  timestamp: string;
  status: "pending" | "processing" | "complete" | "error";
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: NormalizationConfig = {
  sourceUrl: "",
  sku: "",
  name: "",
  outputSize: 500,
  padding: 10,
  scale: 1.0,
  rotation: 0,
  centerX: 0,
  centerY: 0,
  brightness: 1.0,
  contrast: 1.0,
  removeBackground: false,
  bgThreshold: 30,
  bgColor: "#ffffff",
};

const DEFAULT_CHECKLIST: QualityChecklist = {
  transparentBg: false,
  squareCanvas: false,
  centered: false,
  frontFacing: false,
  noTire: false,
  approved: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getWheelStatus(checklist: QualityChecklist): WheelStatus {
  if (checklist.approved) return "usable_direct";
  
  const issues = [
    !checklist.transparentBg,
    !checklist.squareCanvas,
    !checklist.centered,
    !checklist.frontFacing,
    !checklist.noTire,
  ].filter(Boolean).length;
  
  if (issues === 0) return "usable_direct";
  if (issues <= 2 && checklist.frontFacing) return "needs_manual_cleanup";
  if (!checklist.frontFacing) return "needs_ai_cleanup";
  return "needs_manual_cleanup";
}

function getStatusColor(status: WheelStatus): string {
  switch (status) {
    case "usable_direct": return "text-green-400";
    case "ai_normalized": return "text-cyan-400";
    case "needs_manual_cleanup": return "text-yellow-400";
    case "needs_ai_cleanup": return "text-orange-400";
    case "rejected": return "text-red-400";
    default: return "text-gray-400";
  }
}

function getStatusLabel(status: WheelStatus): string {
  switch (status) {
    case "usable_direct": return "✅ Usable Direct";
    case "ai_normalized": return "🤖 AI Normalized";
    case "needs_manual_cleanup": return "🔧 Needs Manual Cleanup";
    case "needs_ai_cleanup": return "🤖 Needs AI Cleanup";
    case "rejected": return "❌ Rejected";
    default: return "⏳ Pending";
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WheelNormalizerPage() {
  const [config, setConfig] = useState<NormalizationConfig>(DEFAULT_CONFIG);
  const [checklist, setChecklist] = useState<QualityChecklist>(DEFAULT_CHECKLIST);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // AI Normalization state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<AINormalizationResult | null>(null);
  const [aiPromptOverride, setAiPromptOverride] = useState("");
  const [aiApproved, setAiApproved] = useState(false);
  
  // Load image from URL
  const loadImage = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    
    setLoading(true);
    setError("");
    
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image. Check URL or CORS."));
        // Use proxy for cross-origin images
        img.src = url.startsWith("http") ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
      });
      
      setOriginalImage(img);
      setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setConfig(prev => ({ ...prev, sourceUrl: url }));
      
      // Auto-detect some checklist items
      const isSquare = Math.abs(img.naturalWidth - img.naturalHeight) < 10;
      setChecklist(prev => ({
        ...prev,
        squareCanvas: isSquare,
      }));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load image");
      setOriginalImage(null);
    } finally {
      setLoading(false);
    }
  }, [urlInput]);
  
  // Render normalized preview
  useEffect(() => {
    if (!originalImage || !previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const size = config.outputSize;
    canvas.width = size;
    canvas.height = size;
    
    // Clear with transparency
    ctx.clearRect(0, 0, size, size);
    
    // Calculate effective padding
    const paddingPx = (config.padding / 100) * size;
    const availableSize = size - (paddingPx * 2);
    
    // Calculate scale to fit
    const imgAspect = originalImage.naturalWidth / originalImage.naturalHeight;
    let drawWidth = availableSize;
    let drawHeight = availableSize;
    
    if (imgAspect > 1) {
      drawHeight = availableSize / imgAspect;
    } else {
      drawWidth = availableSize * imgAspect;
    }
    
    // Apply user scale
    drawWidth *= config.scale;
    drawHeight *= config.scale;
    
    // Center position with offset
    const centerX = size / 2 + (config.centerX / 100) * (size / 2);
    const centerY = size / 2 + (config.centerY / 100) * (size / 2);
    
    // Save context for rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((config.rotation * Math.PI) / 180);
    
    // Apply brightness/contrast via filter
    ctx.filter = `brightness(${config.brightness}) contrast(${config.contrast})`;
    
    // Draw image centered
    ctx.drawImage(
      originalImage,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );
    
    ctx.restore();
    
    // Background removal (simple threshold-based)
    if (config.removeBackground) {
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      const bgRgb = hexToRgb(config.bgColor);
      
      if (bgRgb) {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Calculate color distance from bg color
          const dist = Math.sqrt(
            Math.pow(r - bgRgb.r, 2) +
            Math.pow(g - bgRgb.g, 2) +
            Math.pow(b - bgRgb.b, 2)
          );
          
          // If within threshold, make transparent
          if (dist < config.bgThreshold) {
            data[i + 3] = 0; // Set alpha to 0
          }
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
    }
    
  }, [originalImage, config]);
  
  // Export normalized PNG
  const exportPng = useCallback(() => {
    if (!previewCanvasRef.current) return;
    
    const canvas = previewCanvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    
    // Create download link
    const link = document.createElement("a");
    link.download = `wheel-normalized-${config.sku || "export"}.png`;
    link.href = dataUrl;
    link.click();
  }, [config.sku]);
  
  // Copy config JSON
  const copyConfig = useCallback(() => {
    const exportConfig = {
      source: config.sourceUrl,
      sku: config.sku,
      name: config.name,
      normalization: {
        outputSize: config.outputSize,
        padding: config.padding,
        scale: config.scale,
        rotation: config.rotation,
        centerX: config.centerX,
        centerY: config.centerY,
        brightness: config.brightness,
        contrast: config.contrast,
        removeBackground: config.removeBackground,
        bgThreshold: config.bgThreshold,
        bgColor: config.bgColor,
      },
      checklist,
      status: getWheelStatus(checklist),
      exportedAt: new Date().toISOString(),
    };
    
    navigator.clipboard.writeText(JSON.stringify(exportConfig, null, 2));
    alert("Config copied to clipboard!");
  }, [config, checklist]);
  
  // Preview on Tundra
  const previewOnTundra = useCallback(() => {
    if (!previewCanvasRef.current) return;
    
    const dataUrl = previewCanvasRef.current.toDataURL("image/png");
    // Open Tundra test page with wheel image as query param (base64)
    // For now, we'll open in new tab and user can paste
    const tundraUrl = `/visualizer-lab/tundra-test`;
    
    // Store in sessionStorage for Tundra page to pick up
    sessionStorage.setItem("normalizer-preview-wheel", dataUrl);
    window.open(tundraUrl, "_blank");
  }, []);
  
  // AI Normalize wheel
  const runAiNormalization = useCallback(async () => {
    if (!originalImage) return;
    
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setAiApproved(false);
    
    try {
      // Get the source image as base64
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = originalImage.naturalWidth;
      tempCanvas.height = originalImage.naturalHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error("Failed to create canvas context");
      tempCtx.drawImage(originalImage, 0, 0);
      const sourceBase64 = tempCanvas.toDataURL("image/png");
      
      // Build the prompt
      const defaultPrompt = `Front-facing automotive wheel, studio product photography, centered on white background, professional lighting, no tire, clean isolated wheel face view, high detail, ${config.name || "alloy wheel"}`;
      const prompt = aiPromptOverride.trim() || defaultPrompt;
      
      // Call the AI normalization API
      const response = await fetch("/api/admin/visualizer-lab/ai-normalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImage: sourceBase64,
          prompt,
          sku: config.sku,
          name: config.name,
          outputSize: config.outputSize,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      setAiResult({
        imageUrl: result.imageUrl,
        prompt: result.prompt || prompt,
        model: result.model || "unknown",
        timestamp: new Date().toISOString(),
        status: "complete",
      });
      
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI normalization failed");
      setAiResult({
        imageUrl: "",
        prompt: "",
        model: "",
        timestamp: new Date().toISOString(),
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setAiLoading(false);
    }
  }, [originalImage, config.sku, config.name, config.outputSize, aiPromptOverride]);
  
  // Preview AI result on Tundra
  const previewAiOnTundra = useCallback(() => {
    if (!aiResult?.imageUrl) return;
    
    sessionStorage.setItem("normalizer-preview-wheel", aiResult.imageUrl);
    window.open("/visualizer-lab/tundra-test", "_blank");
  }, [aiResult]);
  
  // Export AI normalized PNG
  const exportAiPng = useCallback(() => {
    if (!aiResult?.imageUrl) return;
    
    const link = document.createElement("a");
    link.download = `wheel-ai-normalized-${config.sku || "export"}.png`;
    link.href = aiResult.imageUrl;
    link.click();
  }, [aiResult, config.sku]);
  
  const status = aiApproved ? "ai_normalized" : getWheelStatus(checklist);
  
  return (
    <div className="min-h-screen bg-zinc-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🔧 Wheel Normalizer Lab</h1>
          <p className="text-zinc-400">
            Prepare wheel images for the visualizer. Normalize cropping, centering, rotation, and background.
          </p>
          
          {/* Info boxes */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
              <div className="font-semibold text-green-400">✅ Front-facing wheels</div>
              <p className="text-green-300/70">Can be used directly with minor adjustments (crop, center, padding).</p>
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
              <div className="font-semibold text-yellow-400">⚠️ Angled/3-quarter views</div>
              <p className="text-yellow-300/70">Likely need AI/manual normalization to extract front-facing view.</p>
            </div>
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
              <div className="font-semibold text-red-400">🚫 Supplier images</div>
              <p className="text-red-300/70">Should not be trusted directly. Always run through normalizer first.</p>
            </div>
          </div>
        </div>
        
        {/* Input Section */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-zinc-400 mb-1">Wheel Image URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/wheel.png or /local/path.png"
                  className="flex-1 bg-zinc-700 rounded px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && loadImage()}
                />
                <button
                  onClick={loadImage}
                  disabled={loading || !urlInput.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 px-4 py-2 rounded text-sm font-medium"
                >
                  {loading ? "Loading..." : "Load"}
                </button>
              </div>
              {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">SKU (optional)</label>
              <input
                type="text"
                value={config.sku}
                onChange={(e) => setConfig(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="e.g., KM54989063518"
                className="w-full bg-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name (optional)</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Fuel Maverick"
                className="w-full bg-zinc-700 rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Original Image */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">📷 Original Image</h2>
            <div className="aspect-square bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-zinc-700">
              {originalImage ? (
                <img
                  src={originalImage.src}
                  alt="Original wheel"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-zinc-500">Load an image to preview</span>
              )}
            </div>
            {originalImage && (
              <p className="text-xs text-zinc-500 mt-2 text-center">
                Original: {originalSize.width} × {originalSize.height}px
                {originalSize.width !== originalSize.height && (
                  <span className="text-yellow-400 ml-2">⚠️ Not square</span>
                )}
              </p>
            )}
          </div>
          
          {/* Normalized Preview */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">🎯 Normalized Preview</h2>
            <div 
              className="aspect-square rounded-lg flex items-center justify-center overflow-hidden border-2 border-zinc-600"
              style={{ 
                backgroundImage: "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
              }}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full"
                style={{ imageRendering: "auto" }}
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2 text-center">
              Output: {config.outputSize} × {config.outputSize}px (transparent)
            </p>
            
            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={exportPng}
                disabled={!originalImage}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-zinc-600 px-3 py-2 rounded text-sm font-medium"
              >
                💾 Export PNG
              </button>
              <button
                onClick={copyConfig}
                disabled={!originalImage}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 px-3 py-2 rounded text-sm font-medium"
              >
                📋 Copy Config
              </button>
            </div>
            <button
              onClick={previewOnTundra}
              disabled={!originalImage}
              className="w-full mt-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-600 px-3 py-2 rounded text-sm font-medium"
            >
              🚗 Preview on Tundra
            </button>
          </div>
          
          {/* Controls & Checklist */}
          <div className="space-y-4">
            {/* Quality Checklist */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">✅ Quality Checklist</h2>
              <div className={`text-lg font-bold mb-3 ${getStatusColor(status)}`}>
                {getStatusLabel(status)}
              </div>
              
              <div className="space-y-2">
                {[
                  { key: "transparentBg", label: "Transparent background" },
                  { key: "squareCanvas", label: "Square canvas" },
                  { key: "centered", label: "Wheel centered" },
                  { key: "frontFacing", label: "Front-facing view" },
                  { key: "noTire", label: "No tire included" },
                  { key: "approved", label: "Manually approved" },
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
            </div>
            
            {/* Normalization Controls */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">🎛️ Controls</h2>
              
              <div className="space-y-4">
                {/* Output Size */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Output Size</span>
                    <span>{config.outputSize}px</span>
                  </label>
                  <input
                    type="range"
                    min={200}
                    max={1000}
                    step={50}
                    value={config.outputSize}
                    onChange={(e) => setConfig(prev => ({ ...prev, outputSize: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Padding */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Padding</span>
                    <span>{config.padding}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={config.padding}
                    onChange={(e) => setConfig(prev => ({ ...prev, padding: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Scale */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Scale</span>
                    <span>{config.scale.toFixed(2)}x</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={config.scale}
                    onChange={(e) => setConfig(prev => ({ ...prev, scale: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Rotation */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Rotation</span>
                    <span>{config.rotation}°</span>
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={config.rotation}
                    onChange={(e) => setConfig(prev => ({ ...prev, rotation: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Center X */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Center X</span>
                    <span>{config.centerX}%</span>
                  </label>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={config.centerX}
                    onChange={(e) => setConfig(prev => ({ ...prev, centerX: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Center Y */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Center Y</span>
                    <span>{config.centerY}%</span>
                  </label>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={config.centerY}
                    onChange={(e) => setConfig(prev => ({ ...prev, centerY: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Brightness */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Brightness</span>
                    <span>{config.brightness.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={config.brightness}
                    onChange={(e) => setConfig(prev => ({ ...prev, brightness: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Contrast */}
                <div>
                  <label className="flex justify-between text-sm text-zinc-400 mb-1">
                    <span>Contrast</span>
                    <span>{config.contrast.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.05}
                    value={config.contrast}
                    onChange={(e) => setConfig(prev => ({ ...prev, contrast: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                
                {/* Background Removal */}
                <div className="border-t border-zinc-700 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                    <input
                      type="checkbox"
                      checked={config.removeBackground}
                      onChange={(e) => setConfig(prev => ({ ...prev, removeBackground: e.target.checked }))}
                      className="w-4 h-4 rounded bg-zinc-700 border-zinc-600"
                    />
                    <span className="text-sm font-medium">Remove Background</span>
                  </label>
                  
                  {config.removeBackground && (
                    <div className="space-y-3 pl-6">
                      <div>
                        <label className="flex justify-between text-sm text-zinc-400 mb-1">
                          <span>BG Color</span>
                          <span>{config.bgColor}</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={config.bgColor}
                            onChange={(e) => setConfig(prev => ({ ...prev, bgColor: e.target.value }))}
                            className="w-10 h-8 rounded bg-zinc-700 border-zinc-600 cursor-pointer"
                          />
                          <button
                            onClick={() => setConfig(prev => ({ ...prev, bgColor: "#ffffff" }))}
                            className="px-2 py-1 bg-zinc-700 rounded text-xs"
                          >
                            White
                          </button>
                          <button
                            onClick={() => setConfig(prev => ({ ...prev, bgColor: "#f0f0f0" }))}
                            className="px-2 py-1 bg-zinc-700 rounded text-xs"
                          >
                            Light Gray
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="flex justify-between text-sm text-zinc-400 mb-1">
                          <span>Threshold</span>
                          <span>{config.bgThreshold}</span>
                        </label>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={config.bgThreshold}
                          onChange={(e) => setConfig(prev => ({ ...prev, bgThreshold: Number(e.target.value) }))}
                          className="w-full"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                          Higher = more aggressive removal (may remove wheel parts)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Reset Button */}
                <button
                  onClick={() => {
                    setConfig(prev => ({
                      ...DEFAULT_CONFIG,
                      sourceUrl: prev.sourceUrl,
                      sku: prev.sku,
                      name: prev.name,
                    }));
                  }}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 px-3 py-2 rounded text-sm"
                >
                  🔄 Reset Controls
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* AI Normalization Section */}
        <div className="mt-8 bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-700/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setAiExpanded(!aiExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🤖</span>
              <div className="text-left">
                <h2 className="text-xl font-bold">AI Wheel Normalization</h2>
                <p className="text-sm text-zinc-400">
                  Convert angled/3-quarter view wheels to front-facing assets using AI regeneration
                </p>
              </div>
            </div>
            <span className="text-2xl">{aiExpanded ? "▼" : "▶"}</span>
          </button>
          
          {aiExpanded && (
            <div className="px-6 pb-6 border-t border-purple-700/30">
              {/* Explanation */}
              <div className="mt-4 p-4 bg-zinc-800/50 rounded-lg text-sm">
                <h3 className="font-semibold text-purple-300 mb-2">💡 How AI Normalization Works</h3>
                <p className="text-zinc-400 mb-2">
                  Instead of trying to mathematically rotate angled wheel images (which doesn&apos;t work well),
                  we use AI to <strong className="text-white">regenerate</strong> the wheel as a clean front-facing render.
                </p>
                <p className="text-zinc-400">
                  The AI preserves: spoke design, finish/material, center cap, lip/barrel style.
                  Output is a visualizer-ready asset: front-facing, centered, transparent background, square canvas.
                </p>
              </div>
              
              {/* Requirements check */}
              {!originalImage && (
                <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-300">⚠️ Load a wheel image first to use AI normalization.</p>
                </div>
              )}
              
              {originalImage && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Controls */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Configuration</h3>
                    
                    {/* Prompt override */}
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">
                        Prompt Override (optional)
                      </label>
                      <textarea
                        value={aiPromptOverride}
                        onChange={(e) => setAiPromptOverride(e.target.value)}
                        placeholder="Leave empty for auto-generated prompt. Or describe the wheel for better results..."
                        className="w-full h-24 bg-zinc-700 rounded px-3 py-2 text-sm resize-none"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Default prompt emphasizes: front-facing, centered, no tire, studio lighting
                      </p>
                    </div>
                    
                    {/* Run button */}
                    <button
                      onClick={runAiNormalization}
                      disabled={aiLoading || !originalImage}
                      className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-zinc-600 disabled:to-zinc-600 px-4 py-3 rounded-lg font-semibold text-lg transition-all"
                    >
                      {aiLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⚙️</span> Generating...
                        </span>
                      ) : (
                        "🚀 Generate Front-Facing Wheel"
                      )}
                    </button>
                    
                    {aiError && (
                      <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                        ❌ {aiError}
                      </div>
                    )}
                    
                    {/* Status notes */}
                    <div className="p-3 bg-zinc-800 rounded-lg text-sm">
                      <h4 className="font-semibold mb-2">Asset Status Legend:</h4>
                      <ul className="space-y-1 text-zinc-400">
                        <li><span className="text-green-400">✅ usable_direct</span> — Front-facing, ready to use</li>
                        <li><span className="text-cyan-400">🤖 ai_normalized</span> — AI-generated front-facing version</li>
                        <li><span className="text-yellow-400">🔧 needs_manual_cleanup</span> — Minor fixes needed</li>
                        <li><span className="text-orange-400">🤖 needs_ai_cleanup</span> — Angled, needs AI conversion</li>
                        <li><span className="text-red-400">❌ rejected</span> — Not usable</li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Right: Results */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Side-by-Side Comparison</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Original */}
                      <div>
                        <p className="text-sm text-zinc-400 mb-2 text-center">Original (Angled)</p>
                        <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center">
                          <img
                            src={originalImage.src}
                            alt="Original"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      </div>
                      
                      {/* AI Result */}
                      <div>
                        <p className="text-sm text-zinc-400 mb-2 text-center">AI Normalized (Front)</p>
                        <div 
                          className="aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                          style={{ 
                            backgroundImage: "linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)",
                            backgroundSize: "20px 20px",
                            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
                          }}
                        >
                          {aiLoading ? (
                            <div className="text-center">
                              <div className="text-4xl animate-pulse">🤖</div>
                              <p className="text-sm text-zinc-400 mt-2">Generating...</p>
                            </div>
                          ) : aiResult?.imageUrl ? (
                            <img
                              src={aiResult.imageUrl}
                              alt="AI Normalized"
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <span className="text-zinc-500 text-sm">Run AI to see result</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Result actions */}
                    {aiResult?.imageUrl && aiResult.status === "complete" && (
                      <div className="space-y-3">
                        {/* Approve/Reject */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAiApproved(true)}
                            className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                              aiApproved 
                                ? "bg-green-600 text-white" 
                                : "bg-zinc-700 hover:bg-green-700 text-zinc-300"
                            }`}
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => {
                              setAiApproved(false);
                              setAiResult(null);
                            }}
                            className="flex-1 bg-zinc-700 hover:bg-red-700 px-4 py-2 rounded font-medium transition-colors"
                          >
                            ❌ Reject
                          </button>
                        </div>
                        
                        {/* Export/Preview buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={exportAiPng}
                            className="flex-1 bg-green-600 hover:bg-green-500 px-3 py-2 rounded text-sm font-medium"
                          >
                            💾 Export PNG
                          </button>
                          <button
                            onClick={previewAiOnTundra}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded text-sm font-medium"
                          >
                            🚗 Preview on Tundra
                          </button>
                        </div>
                        
                        {/* Generation info */}
                        <div className="p-3 bg-zinc-800 rounded text-xs text-zinc-500">
                          <p><strong>Model:</strong> {aiResult.model}</p>
                          <p><strong>Prompt:</strong> {aiResult.prompt}</p>
                          <p><strong>Generated:</strong> {new Date(aiResult.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
