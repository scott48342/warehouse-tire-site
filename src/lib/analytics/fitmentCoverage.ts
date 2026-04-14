/**
 * Fitment Coverage Analytics
 * 
 * Tracks real-world config coverage vs fallback rates.
 * Fires to both GA4 and internal analytics.
 * 
 * NON-DESTRUCTIVE: This is read-only tracking, no behavior changes.
 */

// ============================================================================
// Types
// ============================================================================

export interface FitmentCoverageEvent {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
  hasConfig: boolean;
  source: "config" | "legacy" | "none";
  confidence: "high" | "medium" | "low";
  wheelDiameter?: number;
  autoSelected: boolean;
  productType: "tires" | "wheels";
}

export interface FitmentCoverageStats {
  totalSelections: number;
  configBacked: number;
  legacyFallback: number;
  noData: number;
  configCoveragePercent: number;
  fallbackPercent: number;
  byMake: Record<string, { total: number; config: number; fallback: number }>;
  byConfidence: Record<string, number>;
}

// ============================================================================
// Client-side tracking (fires from browser)
// ============================================================================

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track fitment coverage event
 * Call this when a vehicle is selected or results page loads
 */
export function trackFitmentCoverage(event: FitmentCoverageEvent): void {
  // Only run on client
  if (typeof window === "undefined") return;
  
  const payload = {
    event_category: "fitment",
    event_label: `${event.year}_${event.make}_${event.model}`,
    year: event.year,
    make: event.make,
    model: event.model,
    trim: event.trim || "",
    has_config: event.hasConfig,
    source: event.source,
    confidence: event.confidence,
    wheel_diameter: event.wheelDiameter || null,
    auto_selected: event.autoSelected,
    product_type: event.productType,
  };
  
  // Fire to GA4
  if (window.gtag) {
    window.gtag("event", "fitment_coverage", payload);
  }
  
  // Fire to internal analytics
  fetch("/api/analytics/fitment-coverage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // Silently fail - analytics shouldn't break the site
  });
}

/**
 * Track wheel size selector shown
 */
export function trackWheelSizeGateShown(params: {
  year: string;
  make: string;
  model: string;
  availableDiameters: number[];
  fromConfig: boolean;
}): void {
  if (typeof window === "undefined") return;
  
  if (window.gtag) {
    window.gtag("event", "wheel_size_gate_shown", {
      event_category: "fitment",
      year: params.year,
      make: params.make,
      model: params.model,
      available_diameters: params.availableDiameters.join(","),
      from_config: params.fromConfig,
    });
  }
}

/**
 * Track when "Base" trim is used (fallback)
 */
export function trackBaseTrimUsed(params: {
  year: string;
  make: string;
  model: string;
}): void {
  if (typeof window === "undefined") return;
  
  if (window.gtag) {
    window.gtag("event", "base_trim_fallback", {
      event_category: "fitment",
      year: params.year,
      make: params.make,
      model: params.model,
    });
  }
}

/**
 * Track config auto-selection (wheel diameter auto-picked)
 */
export function trackConfigAutoSelection(params: {
  year: string;
  make: string;
  model: string;
  selectedDiameter: number;
  confidence: string;
}): void {
  if (typeof window === "undefined") return;
  
  if (window.gtag) {
    window.gtag("event", "config_auto_selection", {
      event_category: "fitment",
      year: params.year,
      make: params.make,
      model: params.model,
      selected_diameter: params.selectedDiameter,
      confidence: params.confidence,
    });
  }
}

// ============================================================================
// Server-side aggregation helpers
// ============================================================================

/**
 * Calculate coverage stats from raw events
 */
export function calculateCoverageStats(
  events: FitmentCoverageEvent[]
): FitmentCoverageStats {
  const stats: FitmentCoverageStats = {
    totalSelections: events.length,
    configBacked: 0,
    legacyFallback: 0,
    noData: 0,
    configCoveragePercent: 0,
    fallbackPercent: 0,
    byMake: {},
    byConfidence: { high: 0, medium: 0, low: 0 },
  };
  
  for (const event of events) {
    // Count by source
    if (event.source === "config") {
      stats.configBacked++;
    } else if (event.source === "legacy") {
      stats.legacyFallback++;
    } else {
      stats.noData++;
    }
    
    // Count by make
    const make = event.make.toLowerCase();
    if (!stats.byMake[make]) {
      stats.byMake[make] = { total: 0, config: 0, fallback: 0 };
    }
    stats.byMake[make].total++;
    if (event.source === "config") {
      stats.byMake[make].config++;
    } else {
      stats.byMake[make].fallback++;
    }
    
    // Count by confidence
    stats.byConfidence[event.confidence]++;
  }
  
  // Calculate percentages
  if (stats.totalSelections > 0) {
    stats.configCoveragePercent = (stats.configBacked / stats.totalSelections) * 100;
    stats.fallbackPercent = ((stats.legacyFallback + stats.noData) / stats.totalSelections) * 100;
  }
  
  return stats;
}
