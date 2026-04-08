"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import type {
  TemplateFamilyConfig,
  StanceMode,
  WheelDiameter,
  WheelAnchor,
} from "@/lib/visualizer-lab/types";

type WheelTarget = "front" | "rear" | null;
type DragMode = "move" | "resize" | null;

interface VisualizerLabRendererProps {
  /** Family configuration */
  familyConfig: TemplateFamilyConfig;
  /** Current stance mode */
  stanceMode: StanceMode;
  /** Selected wheel diameter */
  wheelDiameter: WheelDiameter;
  /** Vehicle template image URL */
  vehicleImageUrl: string | null;
  /** Wheel overlay image URL */
  wheelImageUrl: string | null;
  /** Fine-tuning overrides */
  overrides: {
    wheelScale: number;
    frontWheel: Partial<WheelAnchor>;
    rearWheel: Partial<WheelAnchor>;
    bodyYOffset: number;
  };
  /** Show debug overlays */
  showDebug: boolean;
  /** Callback when overrides change via drag */
  onOverridesChange?: (overrides: VisualizerLabRendererProps["overrides"]) => void;
  /** Show tire layer behind wheel */
  showTire?: boolean;
  /** Tire scale multiplier (tire radius = wheel radius * tireScale) */
  tireScale?: number;
  /** Optional tire image URL (uses programmatic rendering if not provided) */
  tireImageUrl?: string | null;
}

export function VisualizerLabRenderer({
  familyConfig,
  stanceMode,
  wheelDiameter,
  vehicleImageUrl,
  wheelImageUrl,
  overrides,
  showDebug,
  onOverridesChange,
  showTire = true,
  tireScale = 1.18,
  tireImageUrl = null,
}: VisualizerLabRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vehicleImgRef = useRef<HTMLImageElement | null>(null);
  const wheelImgRef = useRef<HTMLImageElement | null>(null);
  const tireImgRef = useRef<HTMLImageElement | null>(null);

  // Interaction state
  const [selectedWheel, setSelectedWheel] = useState<WheelTarget>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startOverrides: typeof overrides } | null>(null);

  // Calculate effective values
  const stanceProfile = familyConfig.stanceProfiles[stanceMode];
  const { baseDiameter, pixelsPerInch } = familyConfig.wheelScaling;
  
  // Calculate wheel size change from base
  const diameterDelta = wheelDiameter - baseDiameter;
  const radiusDelta = (diameterDelta * pixelsPerInch) / 2;
  
  // Calculate effective anchors with overrides
  const effectiveAnchors = useMemo(() => {
    const frontBase = familyConfig.anchors.frontWheel;
    const rearBase = familyConfig.anchors.rearWheel;
    
    const baseWheelScale = stanceProfile.wheelScale * overrides.wheelScale;
    const effectiveBodyYOffset = stanceProfile.bodyYOffset + overrides.bodyYOffset;
    
    return {
      front: {
        x: frontBase.x + (overrides.frontWheel.x ?? 0),
        y: frontBase.y + (overrides.frontWheel.y ?? 0) + effectiveBodyYOffset,
        radius: (frontBase.radius + radiusDelta + (overrides.frontWheel.radius ?? 0)) * baseWheelScale,
      },
      rear: {
        x: rearBase.x + (overrides.rearWheel.x ?? 0),
        y: rearBase.y + (overrides.rearWheel.y ?? 0) + effectiveBodyYOffset,
        radius: (rearBase.radius + radiusDelta + (overrides.rearWheel.radius ?? 0)) * baseWheelScale,
      },
      bodyYOffset: effectiveBodyYOffset,
    };
  }, [familyConfig, stanceProfile, overrides, radiusDelta]);

  // Store anchors in ref for use in event handlers
  const anchorsRef = useRef(effectiveAnchors);
  anchorsRef.current = effectiveAnchors;

  // Get mouse position in canvas coordinates
  const getCanvasCoords = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = familyConfig.canvas.width / rect.width;
    const scaleY = familyConfig.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [familyConfig.canvas.width, familyConfig.canvas.height]);

  // Check if point is near wheel center (for move)
  const isNearWheelCenter = (point: { x: number; y: number }, anchor: { x: number; y: number; radius: number }): boolean => {
    const dist = Math.sqrt((point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2);
    return dist < anchor.radius * 0.7; // Inner 70% is move zone
  };

  // Check if point is near wheel edge (for resize)
  const isNearWheelEdge = (point: { x: number; y: number }, anchor: { x: number; y: number; radius: number }): boolean => {
    const dist = Math.sqrt((point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2);
    return dist >= anchor.radius * 0.7 && dist <= anchor.radius * 1.3; // Edge zone
  };

  // Determine what's under the cursor
  const getHitTarget = useCallback((point: { x: number; y: number }): { wheel: WheelTarget; mode: DragMode } => {
    const anchors = anchorsRef.current;
    
    // Check front wheel first (typically in foreground)
    if (isNearWheelEdge(point, anchors.front)) {
      return { wheel: "front", mode: "resize" };
    }
    if (isNearWheelCenter(point, anchors.front)) {
      return { wheel: "front", mode: "move" };
    }
    
    // Check rear wheel
    if (isNearWheelEdge(point, anchors.rear)) {
      return { wheel: "rear", mode: "resize" };
    }
    if (isNearWheelCenter(point, anchors.rear)) {
      return { wheel: "rear", mode: "move" };
    }
    
    return { wheel: null, mode: null };
  }, []);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = getCanvasCoords(e);
    const hit = getHitTarget(point);
    
    if (hit.wheel) {
      setSelectedWheel(hit.wheel);
      setDragMode(hit.mode);
      setIsDragging(true);
      dragStartRef.current = {
        x: point.x,
        y: point.y,
        startOverrides: JSON.parse(JSON.stringify(overrides)),
      };
      e.preventDefault();
    }
  }, [getCanvasCoords, getHitTarget, overrides]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getCanvasCoords(e);
    
    if (isDragging && dragStartRef.current && selectedWheel && onOverridesChange) {
      const dx = point.x - dragStartRef.current.x;
      const dy = point.y - dragStartRef.current.y;
      const startOverrides = dragStartRef.current.startOverrides;
      
      const wheelKey = selectedWheel === "front" ? "frontWheel" : "rearWheel";
      const startWheelOverrides = startOverrides[wheelKey];
      
      if (dragMode === "move") {
        // Update X/Y
        onOverridesChange({
          ...overrides,
          [wheelKey]: {
            ...overrides[wheelKey],
            x: (startWheelOverrides.x ?? 0) + dx,
            y: (startWheelOverrides.y ?? 0) + dy,
          },
        });
      } else if (dragMode === "resize") {
        // Calculate distance from wheel center
        const anchor = anchorsRef.current[selectedWheel];
        const distFromCenter = Math.sqrt((point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2);
        const baseRadius = selectedWheel === "front" 
          ? familyConfig.anchors.frontWheel.radius 
          : familyConfig.anchors.rearWheel.radius;
        const scaledBaseRadius = (baseRadius + radiusDelta) * stanceProfile.wheelScale * overrides.wheelScale;
        const radiusDiff = distFromCenter - scaledBaseRadius;
        
        onOverridesChange({
          ...overrides,
          [wheelKey]: {
            ...overrides[wheelKey],
            radius: Math.round(radiusDiff),
          },
        });
      }
    } else {
      // Update cursor based on what's under it
      const hit = getHitTarget(point);
      if (hit.mode === "move") {
        canvas.style.cursor = "move";
      } else if (hit.mode === "resize") {
        canvas.style.cursor = "ew-resize";
      } else {
        canvas.style.cursor = "default";
      }
    }
  }, [isDragging, selectedWheel, dragMode, getCanvasCoords, getHitTarget, onOverridesChange, overrides, familyConfig, radiusDelta, stanceProfile]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
    dragStartRef.current = null;
  }, []);

  // Handle keyboard events for precision control
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedWheel || !onOverridesChange) return;
    
    const wheelKey = selectedWheel === "front" ? "frontWheel" : "rearWheel";
    const step = e.shiftKey ? 10 : 1;
    const radiusStep = e.altKey ? 1 : (e.shiftKey ? 10 : 5);
    
    let handled = false;
    const newOverrides = { ...overrides };
    const wheelOverrides = { ...overrides[wheelKey] };
    
    switch (e.key) {
      case "ArrowLeft":
        wheelOverrides.x = (wheelOverrides.x ?? 0) - step;
        handled = true;
        break;
      case "ArrowRight":
        wheelOverrides.x = (wheelOverrides.x ?? 0) + step;
        handled = true;
        break;
      case "ArrowUp":
        wheelOverrides.y = (wheelOverrides.y ?? 0) - step;
        handled = true;
        break;
      case "ArrowDown":
        wheelOverrides.y = (wheelOverrides.y ?? 0) + step;
        handled = true;
        break;
      case "+":
      case "=":
        wheelOverrides.radius = (wheelOverrides.radius ?? 0) + radiusStep;
        handled = true;
        break;
      case "-":
      case "_":
        wheelOverrides.radius = (wheelOverrides.radius ?? 0) - radiusStep;
        handled = true;
        break;
      case "Escape":
        setSelectedWheel(null);
        handled = true;
        break;
      case "Tab":
        // Switch between front and rear
        setSelectedWheel(selectedWheel === "front" ? "rear" : "front");
        handled = true;
        break;
    }
    
    if (handled) {
      e.preventDefault();
      if (e.key !== "Escape" && e.key !== "Tab") {
        newOverrides[wheelKey] = wheelOverrides;
        onOverridesChange(newOverrides);
      }
    }
  }, [selectedWheel, onOverridesChange, overrides]);

  // Add global mouse up listener
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, handleMouseUp]);

  // Add keyboard listener when wheel is selected
  useEffect(() => {
    if (selectedWheel) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedWheel, handleKeyDown]);

  // Load images
  useEffect(() => {
    if (vehicleImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        vehicleImgRef.current = img;
        renderCanvas();
      };
      img.onerror = () => {
        vehicleImgRef.current = null;
        renderCanvas();
      };
      img.src = vehicleImageUrl;
    } else {
      vehicleImgRef.current = null;
    }
  }, [vehicleImageUrl]);

  useEffect(() => {
    if (wheelImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        wheelImgRef.current = img;
        renderCanvas();
      };
      img.onerror = () => {
        wheelImgRef.current = null;
        renderCanvas();
      };
      img.src = wheelImageUrl;
    } else {
      wheelImgRef.current = null;
    }
  }, [wheelImageUrl]);

  // Load tire image (optional - uses programmatic rendering if not provided)
  useEffect(() => {
    if (tireImageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        tireImgRef.current = img;
        renderCanvas();
      };
      img.onerror = () => {
        tireImgRef.current = null;
        renderCanvas();
      };
      img.src = tireImageUrl;
    } else {
      tireImgRef.current = null;
    }
  }, [tireImageUrl]);

  // Re-render when relevant props change
  useEffect(() => {
    renderCanvas();
  }, [effectiveAnchors, showDebug, stanceMode, wheelDiameter, selectedWheel, showTire, tireScale]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = familyConfig.canvas;
    
    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw vehicle image
    if (vehicleImgRef.current) {
      ctx.drawImage(
        vehicleImgRef.current,
        0,
        effectiveAnchors.bodyYOffset,
        width,
        height
      );
    } else {
      // Placeholder when no vehicle image
      ctx.fillStyle = "#333";
      ctx.fillRect(100, 300, 1400, 400);
      ctx.fillStyle = "#555";
      ctx.font = "24px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Vehicle template not loaded", width / 2, height / 2);
      ctx.fillText("Add template images to /public/visualizer-lab/families/", width / 2, height / 2 + 40);
    }

    // Draw tire layers BEHIND wheels (if enabled)
    if (showTire) {
      drawTire(ctx, effectiveAnchors.front, tireScale, tireImgRef.current);
      drawTire(ctx, effectiveAnchors.rear, tireScale, tireImgRef.current);
    }

    // Draw wheel overlays ON TOP of tires
    if (wheelImgRef.current) {
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.front);
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.rear);
    }

    // Debug overlays (always show when interacting, or when debug is on)
    if (showDebug || selectedWheel) {
      drawDebugOverlays(ctx, effectiveAnchors);
    }

    // Draw selection/interaction handles
    if (selectedWheel === "front" || showDebug) {
      drawInteractionHandles(ctx, effectiveAnchors.front, "FRONT", selectedWheel === "front");
    }
    if (selectedWheel === "rear" || showDebug) {
      drawInteractionHandles(ctx, effectiveAnchors.rear, "REAR", selectedWheel === "rear");
    }
  };

  const drawWheelOverlay = (
    ctx: CanvasRenderingContext2D,
    wheelImg: HTMLImageElement,
    anchor: { x: number; y: number; radius: number }
  ) => {
    const size = anchor.radius * 2;
    ctx.drawImage(
      wheelImg,
      anchor.x - anchor.radius,
      anchor.y - anchor.radius,
      size,
      size
    );
  };

  /**
   * Draw tire behind wheel.
   * Uses tire image if provided, otherwise draws a programmatic tire (donut shape).
   */
  const drawTire = (
    ctx: CanvasRenderingContext2D,
    wheelAnchor: { x: number; y: number; radius: number },
    scale: number,
    tireImg: HTMLImageElement | null
  ) => {
    const tireRadius = wheelAnchor.radius * scale;
    const { x, y } = wheelAnchor;

    if (tireImg) {
      // Draw tire image
      const size = tireRadius * 2;
      ctx.drawImage(
        tireImg,
        x - tireRadius,
        y - tireRadius,
        size,
        size
      );
    } else {
      // Programmatic tire rendering (donut shape)
      // Outer tire edge
      ctx.save();
      
      // Draw tire body (dark rubber)
      ctx.beginPath();
      ctx.arc(x, y, tireRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.fill();
      
      // Add subtle tire tread texture (concentric rings)
      ctx.strokeStyle = "#252525";
      ctx.lineWidth = 2;
      for (let r = wheelAnchor.radius + 5; r < tireRadius - 3; r += 8) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Sidewall highlight (subtle rim on outer edge)
      ctx.beginPath();
      ctx.arc(x, y, tireRadius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Inner edge where tire meets wheel (slight shadow)
      ctx.beginPath();
      ctx.arc(x, y, wheelAnchor.radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 4;
      ctx.stroke();
      
      ctx.restore();
    }
  };

  const drawInteractionHandles = (
    ctx: CanvasRenderingContext2D,
    anchor: { x: number; y: number; radius: number },
    label: string,
    isSelected: boolean
  ) => {
    const color = label === "FRONT" ? "#00ff00" : "#00ffff";
    const alpha = isSelected ? 1 : 0.5;
    
    ctx.save();
    ctx.globalAlpha = alpha;
    
    // Outer circle (resize zone indicator)
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.setLineDash(isSelected ? [] : [8, 4]);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, anchor.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Resize handles (4 points on the edge)
    if (isSelected) {
      const handleSize = 8;
      ctx.fillStyle = color;
      
      // Right handle
      ctx.beginPath();
      ctx.arc(anchor.x + anchor.radius, anchor.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Left handle
      ctx.beginPath();
      ctx.arc(anchor.x - anchor.radius, anchor.y, handleSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Top handle
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y - anchor.radius, handleSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Bottom handle
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y + anchor.radius, handleSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Center crosshair (move indicator)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const crossSize = isSelected ? 20 : 15;
    ctx.beginPath();
    ctx.moveTo(anchor.x - crossSize, anchor.y);
    ctx.lineTo(anchor.x + crossSize, anchor.y);
    ctx.moveTo(anchor.x, anchor.y - crossSize);
    ctx.lineTo(anchor.x, anchor.y + crossSize);
    ctx.stroke();
    
    // Center dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, isSelected ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Label
    ctx.font = isSelected ? "bold 14px monospace" : "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, anchor.x, anchor.y - anchor.radius - 15);
    
    ctx.restore();
  };

  const drawDebugOverlays = (
    ctx: CanvasRenderingContext2D,
    anchors: {
      front: { x: number; y: number; radius: number };
      rear: { x: number; y: number; radius: number };
      bodyYOffset: number;
    }
  ) => {
    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(10, 10, 320, 220);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";

    const lines = [
      `Family: ${familyConfig.familyId}`,
      `Stance: ${stanceMode}`,
      `Wheel: ${wheelDiameter}"`,
      `Body Y: ${anchors.bodyYOffset.toFixed(1)}px`,
      "",
      `Front: (${Math.round(anchors.front.x)}, ${Math.round(anchors.front.y)}) r=${anchors.front.radius.toFixed(1)}`,
      `Rear:  (${Math.round(anchors.rear.x)}, ${Math.round(anchors.rear.y)}) r=${anchors.rear.radius.toFixed(1)}`,
      "",
      `Selected: ${selectedWheel ?? "none"}`,
      selectedWheel ? "Arrow keys: move | +/-: resize" : "Click wheel to select",
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 20, 30 + i * 20);
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        width={familyConfig.canvas.width}
        height={familyConfig.canvas.height}
        className="w-full h-auto bg-neutral-900 rounded-xl border border-neutral-700"
        style={{ maxWidth: familyConfig.canvas.width }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (!isDragging) {
            const canvas = canvasRef.current;
            if (canvas) canvas.style.cursor = "default";
          }
        }}
        tabIndex={0}
      />
      
      {/* Keyboard hint */}
      {selectedWheel && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/80 text-white text-xs p-2 rounded-lg">
          <span className="text-green-400 font-semibold">{selectedWheel.toUpperCase()} selected</span>
          {" • "}
          <span className="text-neutral-400">
            Arrow keys: move (shift=10px) • +/-: resize • Tab: switch wheel • Esc: deselect
          </span>
        </div>
      )}
    </div>
  );
}
