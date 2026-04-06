"use client";

/**
 * Popularity Badge Component
 * 
 * Displays real behavior-driven signals: Popular, Trending, Best Value.
 * Uses data from productPopularityService (cart_add_events).
 * 
 * IMPORTANT:
 * - Only shows signals when backed by real data
 * - Gracefully hides when no signal applies
 * - Never shows fake/placeholder signals
 * 
 * @created 2026-04-06
 */

import { useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type ProductType = "tire" | "wheel";

export interface PopularitySignalData {
  isPopular: boolean;
  isTrending: boolean;
  isBestValue: boolean;
  popularityRank: number | null;
  message: string | null;
}

interface PopularityBadgeProps {
  /** Signal data from API/server */
  signal?: PopularitySignalData | null;
  /** Fallback: fetch signal client-side (slower, avoid if possible) */
  sku?: string;
  productType?: ProductType;
  /** Visual variant */
  variant?: "default" | "compact" | "inline";
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Main Component (Server-side signal preferred)
// ============================================================================

/**
 * PopularityBadge - Displays popularity/trending signal
 * 
 * Usage with server-provided signal (recommended):
 * ```tsx
 * <PopularityBadge signal={popularitySignal} />
 * ```
 * 
 * Usage with client-side fetch (fallback):
 * ```tsx
 * <PopularityBadge sku="SKU123" productType="tire" />
 * ```
 */
export function PopularityBadge({
  signal,
  sku,
  productType,
  variant = "default",
  className = "",
}: PopularityBadgeProps) {
  const [clientSignal, setClientSignal] = useState<PopularitySignalData | null>(null);

  // Client-side fetch (only if no server signal provided)
  useEffect(() => {
    if (signal || !sku || !productType) return;

    const fetchSignal = async () => {
      try {
        const res = await fetch(
          `/api/analytics/popularity?sku=${encodeURIComponent(sku)}&type=${productType}`
        );
        if (res.ok) {
          const data = await res.json();
          setClientSignal(data.signal || null);
        }
      } catch {
        // Silent fail - no signal is fine
      }
    };

    fetchSignal();
  }, [signal, sku, productType]);

  // Use server signal if available, otherwise client signal
  const effectiveSignal = signal || clientSignal;

  // Don't render if no signal or no message
  if (!effectiveSignal?.message) {
    return null;
  }

  // Determine icon and colors based on signal type
  const { icon, bgColor, textColor, borderColor } = getSignalStyle(effectiveSignal);

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium ${textColor} ${className}`}
      >
        <span>{icon}</span>
        <span>{effectiveSignal.message}</span>
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full ${bgColor} ${borderColor} border px-2 py-0.5 text-[11px] font-semibold ${textColor} ${className}`}
      >
        <span>{icon}</span>
        <span>{effectiveSignal.message}</span>
      </span>
    );
  }

  // Default: full badge
  return (
    <div
      className={`flex items-center gap-2 text-sm ${textColor} ${bgColor} rounded-lg px-3 py-2 border ${borderColor} ${className}`}
    >
      <span>{icon}</span>
      <span className="font-medium">{effectiveSignal.message}</span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function getSignalStyle(signal: PopularitySignalData): {
  icon: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  if (signal.isTrending) {
    return {
      icon: "📈",
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
      borderColor: "border-purple-200",
    };
  }

  if (signal.isPopular) {
    return {
      icon: "🔥",
      bgColor: "bg-amber-50/70",
      textColor: "text-amber-700",
      borderColor: "border-amber-100",
    };
  }

  if (signal.isBestValue) {
    return {
      icon: "💰",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
      borderColor: "border-green-200",
    };
  }

  // Fallback (shouldn't reach here if message is set)
  return {
    icon: "✨",
    bgColor: "bg-neutral-50",
    textColor: "text-neutral-700",
    borderColor: "border-neutral-200",
  };
}

// ============================================================================
// SRP Card Badge (for listing pages)
// ============================================================================

interface SRPPopularityBadgeProps {
  signal?: PopularitySignalData | null;
  className?: string;
}

/**
 * Compact badge for SRP cards
 * 
 * Shows only the most relevant signal in a minimal format.
 */
export function SRPPopularityBadge({ signal, className = "" }: SRPPopularityBadgeProps) {
  if (!signal?.message) return null;

  const { icon, textColor } = getSignalStyle(signal);

  return (
    <div className={`flex items-center gap-1 text-[11px] font-semibold ${textColor} ${className}`}>
      <span>{icon}</span>
      <span className="truncate">{getShortMessage(signal)}</span>
    </div>
  );
}

function getShortMessage(signal: PopularitySignalData): string {
  if (signal.isTrending) return "Trending";
  if (signal.isPopular) return "Popular";
  if (signal.isBestValue) return "Best Value";
  return "";
}

// ============================================================================
// Export
// ============================================================================

export default PopularityBadge;
