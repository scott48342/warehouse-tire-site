"use client";

/**
 * Classic Confidence Badge
 * 
 * Shows confidence level for classic fitment data.
 * Uses consistent styling with modern FitmentConfidenceBadge but
 * with classic-specific labels and colors.
 * 
 * TRIGGER: Only shown when isClassicVehicle = true
 */

export type ClassicConfidenceLevel = "high" | "medium" | "low";

export interface ClassicConfidenceBadgeProps {
  /** Confidence level from classic API */
  confidence: ClassicConfidenceLevel;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show description */
  showDescription?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const CONFIDENCE_CONFIG = {
  high: {
    label: "High Confidence",
    shortLabel: "High",
    description: "Platform specs verified — bolt pattern and hub bore confirmed",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-300",
    icon: "✓",
  },
  medium: {
    label: "Medium Confidence",
    shortLabel: "Medium",
    description: "Platform specs partially verified — confirm with specialist",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-300",
    icon: "⚠",
  },
  low: {
    label: "Low Confidence",
    shortLabel: "Low",
    description: "Limited data available — professional verification recommended",
    bgColor: "bg-orange-100",
    textColor: "text-orange-800",
    borderColor: "border-orange-300",
    icon: "?",
  },
} as const;

const SIZE_CONFIG = {
  sm: {
    padding: "px-2 py-0.5",
    text: "text-xs",
    icon: "text-[10px]",
  },
  md: {
    padding: "px-2.5 py-1",
    text: "text-sm",
    icon: "text-xs",
  },
  lg: {
    padding: "px-3 py-1.5",
    text: "text-base",
    icon: "text-sm",
  },
} as const;

export function ClassicConfidenceBadge({
  confidence,
  size = "md",
  showDescription = false,
  className = "",
}: ClassicConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];
  const sizeConfig = SIZE_CONFIG[size];

  if (!config) return null;

  return (
    <div className={className}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border font-semibold ${sizeConfig.padding} ${sizeConfig.text} ${config.bgColor} ${config.textColor} ${config.borderColor}`}
        title={config.description}
      >
        <span className={sizeConfig.icon}>{config.icon}</span>
        <span>{size === "sm" ? config.shortLabel : config.label}</span>
      </span>
      
      {showDescription && (
        <p className="mt-1 text-xs text-neutral-600">{config.description}</p>
      )}
    </div>
  );
}

export default ClassicConfidenceBadge;
