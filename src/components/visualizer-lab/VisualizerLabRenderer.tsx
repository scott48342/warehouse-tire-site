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
  
  // ─────────────────────────────────────────────────────────────────────────
  // WHEEL-TO-TIRE RATIO MAPPING
  // Maps wheel diameter to what % of tire outer diameter the wheel occupies.
  // Larger wheel = larger ratio = thinner sidewall
  // ─────────────────────────────────────────────────────────────────────────
  const WHEEL_TO_TIRE_RATIO: Record<number, number> = {
    17: 0.68,  // 32% sidewall - thick (off-road look)
    18: 0.72,  // 28% sidewall - slightly thick
    20: 0.78,  // 22% sidewall - baseline
    22: 0.84,  // 16% sidewall - thinner
    24: 0.89,  // 11% sidewall - low profile
    26: 0.93,  // 7% sidewall - very low profile
  };
  
  // Get wheel-to-tire ratio for selected diameter (default to 0.78 if unknown)
  const wheelToTireRatio = WHEEL_TO_TIRE_RATIO[wheelDiameter] ?? 0.78;
  
  // Calculate effective anchors with NEW sizing logic:
  // - tireOuterRadius: stable, based on anchor (represents the wheel well size)
  // - wheelVisualRadius: varies based on wheel diameter ratio
  const effectiveAnchors = useMemo(() => {
    const frontBase = familyConfig.anchors.frontWheel;
    const rearBase = familyConfig.anchors.rearWheel;
    
    const baseWheelScale = stanceProfile.wheelScale * overrides.wheelScale;
    const effectiveBodyYOffset = stanceProfile.bodyYOffset + overrides.bodyYOffset;
    
    // Tire outer radius stays STABLE (based on anchor, not wheel diameter)
    // This represents the overall tire size for the build
    const frontTireOuterRadius = (frontBase.radius + (overrides.frontWheel.radius ?? 0)) * baseWheelScale;
    const rearTireOuterRadius = (rearBase.radius + (overrides.rearWheel.radius ?? 0)) * baseWheelScale;
    
    // Wheel visual radius CHANGES based on selected diameter
    // Larger wheel = higher ratio = wheel takes up more of the tire
    const frontWheelVisualRadius = frontTireOuterRadius * wheelToTireRatio;
    const rearWheelVisualRadius = rearTireOuterRadius * wheelToTireRatio;
    
    return {
      front: {
        x: frontBase.x + (overrides.frontWheel.x ?? 0),
        y: frontBase.y + (overrides.frontWheel.y ?? 0) + effectiveBodyYOffset,
        radius: frontWheelVisualRadius,  // This is now the WHEEL radius
        tireRadius: frontTireOuterRadius, // NEW: separate tire outer radius
      },
      rear: {
        x: rearBase.x + (overrides.rearWheel.x ?? 0),
        y: rearBase.y + (overrides.rearWheel.y ?? 0) + effectiveBodyYOffset,
        radius: rearWheelVisualRadius,
        tireRadius: rearTireOuterRadius,
      },
      bodyYOffset: effectiveBodyYOffset,
      wheelToTireRatio, // Expose for debug display
    };
  }, [familyConfig, stanceProfile, overrides, wheelToTireRatio]);

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
        // In new sizing system, dragging resizes the tire outer (anchor.tireRadius)
        const anchor = anchorsRef.current[selectedWheel];
        const distFromCenter = Math.sqrt((point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2);
        const baseRadius = selectedWheel === "front" 
          ? familyConfig.anchors.frontWheel.radius 
          : familyConfig.anchors.rearWheel.radius;
        const scaledBaseRadius = baseRadius * stanceProfile.wheelScale * overrides.wheelScale;
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
  }, [isDragging, selectedWheel, dragMode, getCanvasCoords, getHitTarget, onOverridesChange, overrides, familyConfig, stanceProfile]);

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

    // Draw contact shadows FIRST (beneath everything)
    if (showTire) {
      drawContactShadow(ctx, effectiveAnchors.front);
      drawContactShadow(ctx, effectiveAnchors.rear);
    }

    // Draw tire layers BEHIND wheels (if enabled)
    if (showTire) {
      drawTire(ctx, effectiveAnchors.front, tireImgRef.current);
      drawTire(ctx, effectiveAnchors.rear, tireImgRef.current);
    }

    // Draw wheel overlays ON TOP of tires (with inset for depth)
    if (wheelImgRef.current) {
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.front, showTire);
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.rear, showTire);
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

  // Wheel inset factor - makes wheel slightly smaller than tire opening for depth
  const WHEEL_INSET = 0.97;

  const drawWheelOverlay = (
    ctx: CanvasRenderingContext2D,
    wheelImg: HTMLImageElement,
    anchor: { x: number; y: number; radius: number },
    applyInset: boolean = false
  ) => {
    // Apply inset when tire is shown (creates depth effect)
    const effectiveRadius = applyInset ? anchor.radius * WHEEL_INSET : anchor.radius;
    const size = effectiveRadius * 2;
    ctx.drawImage(
      wheelImg,
      anchor.x - effectiveRadius,
      anchor.y - effectiveRadius,
      size,
      size
    );
  };

  /**
   * Draw contact shadow beneath tire for grounded feel.
   * Elliptical shape, darker center, fades outward.
   */
  const drawContactShadow = (
    ctx: CanvasRenderingContext2D,
    anchor: { x: number; y: number; radius: number; tireRadius: number }
  ) => {
    // Use the stable tire outer radius (not wheel radius)
    const tireOuterRadius = anchor.tireRadius * tireScale; // Apply tireScale for overall size tuning
    const { x, y } = anchor;
    
    // Shadow positioned at bottom of tire
    const shadowY = y + tireOuterRadius * 0.92; // Slightly inside tire bottom
    const shadowWidth = tireOuterRadius * 1.1;
    const shadowHeight = tireOuterRadius * 0.15;
    
    ctx.save();
    
    // Create elliptical gradient for soft shadow
    const gradient = ctx.createRadialGradient(
      x, shadowY, 0,
      x, shadowY, shadowWidth
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.4)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.2)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    
    // Draw elliptical shadow
    ctx.beginPath();
    ctx.ellipse(x, shadowY, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  };

  /**
   * Draw tire behind wheel.
   * Uses tire image if provided, otherwise draws a programmatic tire with realistic shading.
   * 
   * NEW: anchor.tireRadius = stable tire outer size
   *      anchor.radius = wheel visual size (varies by diameter)
   */
  const drawTire = (
    ctx: CanvasRenderingContext2D,
    anchor: { x: number; y: number; radius: number; tireRadius: number },
    tireImg: HTMLImageElement | null
  ) => {
    // Tire outer radius is STABLE (from anchor.tireRadius), with optional tireScale tuning
    const tireOuterRadius = anchor.tireRadius * tireScale;
    // Wheel inner radius varies by selected diameter
    const wheelInnerRadius = anchor.radius * WHEEL_INSET;
    const { x, y } = anchor;

    if (tireImg) {
      // Draw tire image
      const size = tireOuterRadius * 2;
      ctx.drawImage(
        tireImg,
        x - tireOuterRadius,
        y - tireOuterRadius,
        size,
        size
      );
    } else {
      // Programmatic tire rendering with realistic shading
      ctx.save();
      
      // Create radial gradient for tire body (darker outer edge, lighter inner)
      const tireGradient = ctx.createRadialGradient(
        x, y, wheelInnerRadius,
        x, y, tireOuterRadius
      );
      tireGradient.addColorStop(0, "#2a2a2a");    // Lighter inner (near wheel)
      tireGradient.addColorStop(0.3, "#222222");  // Mid-tone
      tireGradient.addColorStop(0.7, "#1a1a1a");  // Darker toward edge
      tireGradient.addColorStop(1, "#111111");    // Darkest outer edge
      
      // Draw tire body with gradient
      ctx.beginPath();
      ctx.arc(x, y, tireOuterRadius, 0, Math.PI * 2);
      ctx.fillStyle = tireGradient;
      ctx.fill();
      
      // Subtle tread texture (very light concentric lines)
      // More lines when sidewall is thicker
      ctx.strokeStyle = "rgba(40, 40, 40, 0.5)";
      ctx.lineWidth = 1;
      const sidewallThickness = tireOuterRadius - wheelInnerRadius;
      const treadStart = wheelInnerRadius + sidewallThickness * 0.25;
      const treadEnd = tireOuterRadius - 4;
      const treadSpacing = Math.max(4, sidewallThickness * 0.15); // Adjust spacing based on sidewall
      for (let r = treadStart; r < treadEnd; r += treadSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Outer edge highlight (subtle rubber lip)
      ctx.beginPath();
      ctx.arc(x, y, tireOuterRadius - 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(50, 50, 50, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Inner edge shadow (where tire meets wheel rim)
      ctx.beginPath();
      ctx.arc(x, y, wheelInnerRadius + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Very subtle sidewall highlight (top portion catches light)
      const highlightGradient = ctx.createLinearGradient(x, y - tireOuterRadius, x, y);
      highlightGradient.addColorStop(0, "rgba(60, 60, 60, 0.15)");
      highlightGradient.addColorStop(0.5, "rgba(60, 60, 60, 0)");
      highlightGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.beginPath();
      ctx.arc(x, y, tireOuterRadius - 2, 0, Math.PI * 2);
      ctx.fillStyle = highlightGradient;
      ctx.fill();
      
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
      front: { x: number; y: number; radius: number; tireRadius: number };
      rear: { x: number; y: number; radius: number; tireRadius: number };
      bodyYOffset: number;
      wheelToTireRatio: number;
    }
  ) => {
    // Calculate sidewall info
    const frontTireOuter = anchors.front.tireRadius * tireScale;
    const frontWheelInner = anchors.front.radius * WHEEL_INSET;
    const frontSidewall = frontTireOuter - frontWheelInner;
    const sidewallPct = Math.round((1 - anchors.wheelToTireRatio) * 100);
    
    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(10, 10, 340, 280);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";

    const lines = [
      `Family: ${familyConfig.familyId}`,
      `Stance: ${stanceMode}`,
      `Wheel: ${wheelDiameter}"`,
      "",
      `── TIRE SIZING ──`,
      `Wheel/Tire Ratio: ${(anchors.wheelToTireRatio * 100).toFixed(0)}%`,
      `Sidewall: ${sidewallPct}% (${frontSidewall.toFixed(0)}px)`,
      `Tire Outer: ${frontTireOuter.toFixed(0)}px`,
      `Wheel Visual: ${frontWheelInner.toFixed(0)}px`,
      "",
      `Front: (${Math.round(anchors.front.x)}, ${Math.round(anchors.front.y)})`,
      `Rear:  (${Math.round(anchors.rear.x)}, ${Math.round(anchors.rear.y)})`,
      "",
      `Selected: ${selectedWheel ?? "none"}`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 20, 30 + i * 18);
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
