"use client";

import React, { useEffect, useRef, useMemo } from "react";
import type {
  TemplateFamilyConfig,
  StanceMode,
  WheelDiameter,
  WheelAnchor,
} from "@/lib/visualizer-lab/types";

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
}

export function VisualizerLabRenderer({
  familyConfig,
  stanceMode,
  wheelDiameter,
  vehicleImageUrl,
  wheelImageUrl,
  overrides,
  showDebug,
}: VisualizerLabRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vehicleImgRef = useRef<HTMLImageElement | null>(null);
  const wheelImgRef = useRef<HTMLImageElement | null>(null);

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

  // Re-render when relevant props change
  useEffect(() => {
    renderCanvas();
  }, [effectiveAnchors, showDebug, stanceMode, wheelDiameter]);

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
      // Apply body Y offset by adjusting draw position
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

    // Draw wheel overlays
    if (wheelImgRef.current) {
      // Front wheel
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.front);
      // Rear wheel
      drawWheelOverlay(ctx, wheelImgRef.current, effectiveAnchors.rear);
    }

    // Debug overlays
    if (showDebug) {
      drawDebugOverlays(ctx, effectiveAnchors);
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

  const drawDebugOverlays = (
    ctx: CanvasRenderingContext2D,
    anchors: {
      front: { x: number; y: number; radius: number };
      rear: { x: number; y: number; radius: number };
      bodyYOffset: number;
    }
  ) => {
    // Front wheel debug
    drawAnchorDebug(ctx, anchors.front, "FRONT", "#00ff00");
    // Rear wheel debug
    drawAnchorDebug(ctx, anchors.rear, "REAR", "#00ffff");

    // Info panel
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 300, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";

    const lines = [
      `Family: ${familyConfig.familyId}`,
      `Stance: ${stanceMode}`,
      `Wheel: ${wheelDiameter}"`,
      `Body Y: ${anchors.bodyYOffset.toFixed(1)}px`,
      "",
      `Front: (${anchors.front.x}, ${anchors.front.y}) r=${anchors.front.radius.toFixed(1)}`,
      `Rear:  (${anchors.rear.x}, ${anchors.rear.y}) r=${anchors.rear.radius.toFixed(1)}`,
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 20, 30 + i * 20);
    });
  };

  const drawAnchorDebug = (
    ctx: CanvasRenderingContext2D,
    anchor: { x: number; y: number; radius: number },
    label: string,
    color: string
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Circle
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, anchor.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center crosshair
    ctx.beginPath();
    ctx.moveTo(anchor.x - 10, anchor.y);
    ctx.lineTo(anchor.x + 10, anchor.y);
    ctx.moveTo(anchor.x, anchor.y - 10);
    ctx.lineTo(anchor.x, anchor.y + 10);
    ctx.stroke();

    // Label
    ctx.fillStyle = color;
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, anchor.x, anchor.y - anchor.radius - 10);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={familyConfig.canvas.width}
        height={familyConfig.canvas.height}
        className="w-full h-auto bg-neutral-900 rounded-xl border border-neutral-700"
        style={{ maxWidth: familyConfig.canvas.width }}
      />
    </div>
  );
}
