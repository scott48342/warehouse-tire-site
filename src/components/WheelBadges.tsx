"use client";

import { type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// BADGE TYPES & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export type AvailabilityLabel = "in_stock" | "limited" | "check_availability";
export type MerchandisingBadge = "top_pick" | "best_value";

export type WheelBadgeInfo = {
  availability?: {
    label: AvailabilityLabel;
    localStock?: number;
    globalStock?: number;
  };
  ranking?: {
    score: number;
    priceTier?: "value" | "mid" | "premium";
  };
  isTopPick?: boolean;
  isBestValue?: boolean;
};

// Priority order for badge selection (max 2 badges)
// Top Pick > In Stock > Best Value > Limited > Check Availability
const BADGE_PRIORITY: Array<AvailabilityLabel | MerchandisingBadge> = [
  "top_pick",
  "in_stock",
  "best_value",
  "limited",
  // "check_availability" excluded - not shown as badge
];

// ═══════════════════════════════════════════════════════════════════════════
// BADGE STYLING
// ═══════════════════════════════════════════════════════════════════════════

const BADGE_STYLES = {
  // Availability badges
  in_stock: {
    bg: "bg-green-100",
    border: "border-green-200",
    text: "text-green-800",
    icon: "✓",
    label: "In Stock",
  },
  limited: {
    bg: "bg-amber-100",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: "⚡",
    label: "Limited",
  },
  check_availability: {
    bg: "bg-neutral-100",
    border: "border-neutral-200",
    text: "text-neutral-600",
    icon: "📦",
    label: "Check Availability",
  },
  // Merchandising badges
  top_pick: {
    bg: "bg-gradient-to-r from-amber-100 to-orange-100",
    border: "border-amber-300",
    text: "text-amber-900",
    icon: "🔥",
    label: "Top Pick",
  },
  best_value: {
    bg: "bg-blue-100",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: "💎",
    label: "Best Value",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BADGE SELECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Determines which badges to show based on availability and ranking data.
 * Returns max 2 badges, prioritized by BADGE_PRIORITY.
 */
export function selectBadges(info: WheelBadgeInfo): Array<AvailabilityLabel | MerchandisingBadge> {
  const candidates: Array<AvailabilityLabel | MerchandisingBadge> = [];

  // Add merchandising badges based on ranking score
  const score = info.ranking?.score ?? 0;
  const priceTier = info.ranking?.priceTier;

  // Top Pick: score >= 90 OR explicitly marked
  if (info.isTopPick || score >= 90) {
    candidates.push("top_pick");
  }

  // Best Value: mid-price tier + high score (>= 75) OR explicitly marked
  if (info.isBestValue || (priceTier === "mid" && score >= 75)) {
    candidates.push("best_value");
  }

  // Add availability badges
  const availLabel = info.availability?.label;
  if (availLabel === "in_stock") {
    candidates.push("in_stock");
  } else if (availLabel === "limited") {
    candidates.push("limited");
  }
  // Note: check_availability is NOT added as a badge (too noisy)

  // Sort by priority and take top 2
  const sorted = candidates.sort(
    (a, b) => BADGE_PRIORITY.indexOf(a) - BADGE_PRIORITY.indexOf(b)
  );

  return sorted.slice(0, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

interface BadgeProps {
  type: AvailabilityLabel | MerchandisingBadge;
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ type, size = "sm", className = "" }: BadgeProps) {
  const style = BADGE_STYLES[type];
  if (!style) return null;

  const sizeClasses = size === "sm" 
    ? "px-2 py-0.5 text-[10px]" 
    : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${style.bg} ${style.border} ${style.text} ${sizeClasses} ${className}`}
    >
      <span>{style.icon}</span>
      <span>{style.label}</span>
    </span>
  );
}

interface WheelBadgeStackProps {
  info: WheelBadgeInfo;
  size?: "sm" | "md";
  layout?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Renders a stack of badges for a wheel card.
 * Automatically selects and limits to max 2 badges.
 */
export function WheelBadgeStack({ 
  info, 
  size = "sm", 
  layout = "horizontal",
  className = "" 
}: WheelBadgeStackProps) {
  const badges = selectBadges(info);
  
  if (badges.length === 0) return null;

  const layoutClasses = layout === "horizontal" 
    ? "flex flex-wrap gap-1.5" 
    : "flex flex-col gap-1";

  return (
    <div className={`${layoutClasses} ${className}`}>
      {badges.map((badge) => (
        <Badge key={badge} type={badge} size={size} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABILITY INDICATOR (Standalone)
// ═══════════════════════════════════════════════════════════════════════════

interface AvailabilityIndicatorProps {
  label: AvailabilityLabel;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function AvailabilityIndicator({ 
  label, 
  showLabel = true,
  size = "sm" 
}: AvailabilityIndicatorProps) {
  const dotColors = {
    in_stock: "bg-green-500",
    limited: "bg-amber-500",
    check_availability: "bg-neutral-400",
  };

  const textColors = {
    in_stock: "text-green-700",
    limited: "text-amber-700",
    check_availability: "text-neutral-500",
  };

  const labels = {
    in_stock: "In Stock",
    limited: "Limited Stock",
    check_availability: "Check Availability",
  };

  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${dotSize} rounded-full ${dotColors[label]}`} />
      {showLabel && (
        <span className={`${textSize} font-medium ${textColors[label]}`}>
          {labels[label]}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FITMENT CONFIRMATION TEXT
// ═══════════════════════════════════════════════════════════════════════════

interface FitmentConfirmationProps {
  fitmentClass?: "surefit" | "specfit" | "extended";
  vehicleLabel?: string;
  className?: string;
}

export function FitmentConfirmation({ 
  fitmentClass, 
  vehicleLabel,
  className = "" 
}: FitmentConfirmationProps) {
  if (!fitmentClass) return null;

  const messages = {
    surefit: "Guaranteed fit",
    specfit: "Fits with specifications",
    extended: "Custom fitment available",
  };

  const colors = {
    surefit: "text-green-600",
    specfit: "text-blue-600",
    extended: "text-amber-600",
  };

  return (
    <div className={`text-xs ${className}`}>
      <span className={`${colors[fitmentClass]} font-semibold`}>
        ✓ {messages[fitmentClass]}
      </span>
      {vehicleLabel && (
        <span className="text-neutral-500 ml-1">for your {vehicleLabel}</span>
      )}
    </div>
  );
}
