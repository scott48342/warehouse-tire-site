"use client";

import { useEffect, useRef } from "react";
import { trackFitmentCoverage, trackConfigAutoSelection } from "@/lib/analytics/fitmentCoverage";

interface FitmentCoverageTrackerProps {
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

/**
 * FitmentCoverageTracker
 * 
 * Client component that fires fitment coverage analytics.
 * Place on vehicle results pages to track config vs fallback rates.
 * 
 * NON-DESTRUCTIVE: Renders nothing, only fires analytics.
 */
export function FitmentCoverageTracker({
  year,
  make,
  model,
  trim,
  modification,
  hasConfig,
  source,
  confidence,
  wheelDiameter,
  autoSelected,
  productType,
}: FitmentCoverageTrackerProps) {
  // Track once per unique vehicle combination
  const tracked = useRef<string | null>(null);
  
  useEffect(() => {
    // Build unique key for this vehicle
    const key = `${year}_${make}_${model}_${trim || ""}_${modification || ""}_${productType}`;
    
    // Don't double-track same vehicle in same session
    if (tracked.current === key) return;
    tracked.current = key;
    
    // Fire coverage event
    trackFitmentCoverage({
      year,
      make,
      model,
      trim,
      modification,
      hasConfig,
      source,
      confidence,
      wheelDiameter,
      autoSelected,
      productType,
    });
    
    // Fire auto-selection event if applicable
    if (autoSelected && wheelDiameter) {
      trackConfigAutoSelection({
        year,
        make,
        model,
        selectedDiameter: wheelDiameter,
        confidence,
      });
    }
  }, [year, make, model, trim, modification, hasConfig, source, confidence, wheelDiameter, autoSelected, productType]);
  
  // Render nothing - this is a tracking-only component
  return null;
}

export default FitmentCoverageTracker;
