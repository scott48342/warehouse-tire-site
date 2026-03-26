"use client";

import { useMemo } from "react";

/**
 * Fitment Confidence Badge
 * 
 * Displays the confidence level of fitment data with appropriate styling.
 * Used in wheel search results, cart, and fitment summaries.
 * 
 * @module FitmentConfidenceBadge
 */

export type FitmentConfidenceLevel = "high" | "medium" | "low" | "none";

export type FitmentClass = "surefit" | "specfit" | "extended";

export interface FitmentConfidenceBadgeProps {
  /** Fitment confidence level from API */
  confidence?: FitmentConfidenceLevel;
  
  /** Per-wheel fitment class (surefit/specfit/extended) */
  fitmentClass?: FitmentClass;
  
  /** Whether to show detailed explanation */
  showDetails?: boolean;
  
  /** Custom warning message */
  warningMessage?: string | null;
  
  /** Size variant */
  size?: "sm" | "md" | "lg";
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Configuration for each confidence level
 */
const CONFIDENCE_CONFIG = {
  high: {
    label: "Verified Fitment",
    shortLabel: "Verified",
    description: "Bolt pattern and hub bore verified",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
    icon: "✓",
    accentBar: "bg-green-500",
  },
  medium: {
    label: "Partial Fitment",
    shortLabel: "Partial",
    description: "Bolt pattern verified, hub bore unknown",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-200",
    icon: "⚠",
    accentBar: "bg-amber-500",
  },
  low: {
    label: "Limited Data",
    shortLabel: "Limited",
    description: "Cannot verify bolt pattern",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-200",
    icon: "?",
    accentBar: "bg-orange-500",
  },
  none: {
    label: "Not Available",
    shortLabel: "N/A",
    description: "No fitment data available",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-200",
    icon: "✕",
    accentBar: "bg-red-500",
  },
} as const;

/**
 * Configuration for fitmentClass (wheel-specific fit type)
 */
const FITMENT_CLASS_CONFIG = {
  surefit: {
    label: "Best Fit",
    shortLabel: "Best",
    description: "Direct OEM-equivalent fit for your vehicle",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-200",
    icon: "✓",
    accentBar: "bg-green-500",
  },
  specfit: {
    label: "Good Fit",
    shortLabel: "Good",
    description: "Aftermarket fit with verified specs",
    bgColor: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-200",
    icon: "✓",
    accentBar: "bg-blue-500",
  },
  extended: {
    label: "Aggressive Fit",
    shortLabel: "Custom",
    description: "Custom fitment for modified vehicles",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-200",
    icon: "⚡",
    accentBar: "bg-orange-500",
  },
} as const;

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: {
    badgePadding: "px-2 py-0.5",
    textSize: "text-[10px]",
    iconSize: "text-[9px]",
    detailsTextSize: "text-[10px]",
  },
  md: {
    badgePadding: "px-2.5 py-1",
    textSize: "text-xs",
    iconSize: "text-[10px]",
    detailsTextSize: "text-xs",
  },
  lg: {
    badgePadding: "px-3 py-1.5",
    textSize: "text-sm",
    iconSize: "text-xs",
    detailsTextSize: "text-sm",
  },
} as const;

/**
 * FitmentConfidenceBadge Component
 * 
 * Displays confidence level for overall fitment data OR
 * fitment class for individual wheel matches.
 */
export function FitmentConfidenceBadge({
  confidence,
  fitmentClass,
  showDetails = false,
  warningMessage,
  size = "md",
  className = "",
}: FitmentConfidenceBadgeProps) {
  // Determine which config to use (fitmentClass takes precedence if both provided)
  const config = useMemo(() => {
    if (fitmentClass && FITMENT_CLASS_CONFIG[fitmentClass]) {
      return FITMENT_CLASS_CONFIG[fitmentClass];
    }
    if (confidence && CONFIDENCE_CONFIG[confidence]) {
      return CONFIDENCE_CONFIG[confidence];
    }
    return null;
  }, [confidence, fitmentClass]);

  const sizeConfig = SIZE_CONFIG[size];

  if (!config) {
    return null;
  }

  return (
    <div className={className}>
      {/* Badge */}
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-bold ${sizeConfig.badgePadding} ${sizeConfig.textSize} ${config.bgColor} ${config.textColor} ${config.borderColor}`}
        title={config.description}
      >
        <span className={sizeConfig.iconSize}>{config.icon}</span>
        <span>{size === "sm" ? config.shortLabel : config.label}</span>
      </span>

      {/* Details text (shown below badge when enabled) */}
      {showDetails && (
        <div className={`mt-1 ${sizeConfig.detailsTextSize} text-neutral-600`}>
          {config.description}
        </div>
      )}

      {/* Warning message for medium confidence */}
      {warningMessage && (
        <div className={`mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 ${sizeConfig.detailsTextSize} text-amber-800`}>
          <span className="mr-1">⚠</span>
          {warningMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Simplified badge for inline use (no details, no warnings)
 */
export function FitmentBadgeInline({
  confidence,
  fitmentClass,
  size = "sm",
  className = "",
}: Omit<FitmentConfidenceBadgeProps, "showDetails" | "warningMessage">) {
  return (
    <FitmentConfidenceBadge
      confidence={confidence}
      fitmentClass={fitmentClass}
      size={size}
      className={className}
      showDetails={false}
      warningMessage={null}
    />
  );
}

/**
 * Confidence indicator bar (used as accent on cards)
 */
export function FitmentAccentBar({
  confidence,
  fitmentClass,
  className = "",
}: {
  confidence?: FitmentConfidenceLevel;
  fitmentClass?: FitmentClass;
  className?: string;
}) {
  const config = useMemo(() => {
    if (fitmentClass && FITMENT_CLASS_CONFIG[fitmentClass]) {
      return FITMENT_CLASS_CONFIG[fitmentClass];
    }
    if (confidence && CONFIDENCE_CONFIG[confidence]) {
      return CONFIDENCE_CONFIG[confidence];
    }
    return null;
  }, [confidence, fitmentClass]);

  if (!config) {
    return null;
  }

  return (
    <div
      className={`pointer-events-none absolute left-0 top-0 h-full w-1 ${config.accentBar} ${className}`}
    />
  );
}

/**
 * Fitment summary strip with confidence indicator
 * Shows vehicle info + confidence level in a compact format
 */
export function FitmentConfidenceStrip({
  confidence,
  vehicle,
  warningMessage,
  className = "",
}: {
  confidence: FitmentConfidenceLevel;
  vehicle?: { year?: string; make?: string; model?: string; trim?: string };
  warningMessage?: string | null;
  className?: string;
}) {
  const config = CONFIDENCE_CONFIG[confidence];
  
  if (!config) return null;

  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : null;

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {vehicleLabel && (
            <span className="text-sm font-semibold text-neutral-800">{vehicleLabel}</span>
          )}
          <FitmentBadgeInline confidence={confidence} size="sm" />
        </div>
        
        {confidence === "high" && (
          <span className="text-xs text-green-700 font-medium">
            ✓ Full fitment verification
          </span>
        )}
      </div>

      {warningMessage && confidence === "medium" && (
        <div className="mt-2 text-xs text-amber-800">
          {warningMessage}
        </div>
      )}
    </div>
  );
}

export default FitmentConfidenceBadge;
