/**
 * Analytics event tracking utilities
 * Uses GA4 gtag when available
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Track a custom event to GA4
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
}

// ─────────────────────────────────────────────────────────────
// Lifted & Off-Road Build Events
// ─────────────────────────────────────────────────────────────

export function trackLiftedEntryClick() {
  trackEvent("lifted_entry_click", {
    source: "homepage",
  });
}

export function trackLiftPresetSelect(presetId: string, liftInches: number) {
  trackEvent("lifted_preset_select", {
    preset_id: presetId,
    lift_inches: liftInches,
  });
}

export function trackLiftedCtaClick(params: {
  liftPreset: string;
  liftInches: number;
  year: string;
  make: string;
  model: string;
  hasRecommendation: boolean;
}) {
  trackEvent("lifted_cta_click", {
    preset_id: params.liftPreset,
    lift_inches: params.liftInches,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
    has_recommendation: params.hasRecommendation,
  });
}

export function trackLiftedRecommendationShown(params: {
  liftPreset: string;
  liftInches: number;
  year: string;
  make: string;
  model: string;
  tireDiameterMin: number;
  tireDiameterMax: number;
}) {
  trackEvent("lifted_recommendation_shown", {
    preset_id: params.liftPreset,
    lift_inches: params.liftInches,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
    tire_diameter_min: params.tireDiameterMin,
    tire_diameter_max: params.tireDiameterMax,
  });
}

export function trackLiftedFallbackShown(params: {
  year: string;
  make: string;
  model: string;
}) {
  trackEvent("lifted_fallback_shown", {
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
  });
}

export function trackLiftedTireSuggestionClick(params: {
  liftPreset: string;
  liftInches: number;
  tireSize: string;
  year: string;
  make: string;
  model: string;
}) {
  trackEvent("lifted_tire_suggestion_click", {
    preset_id: params.liftPreset,
    lift_inches: params.liftInches,
    tire_size: params.tireSize,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
  });
}

export function trackLiftedWheelSuggestionClick(params: {
  liftPreset: string;
  liftInches: number;
  wheelDiameter: number;
  year: string;
  make: string;
  model: string;
  vehicleAwareLink: boolean;
}) {
  trackEvent("lifted_wheel_suggestion_click", {
    preset_id: params.liftPreset,
    lift_inches: params.liftInches,
    wheel_diameter: params.wheelDiameter,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
    vehicle_aware_link: params.vehicleAwareLink,
  });
}

export function trackLiftedCategoryClick(params: {
  liftPreset: string;
  category: string;
  year: string;
  make: string;
  model: string;
}) {
  trackEvent("lifted_category_click", {
    preset_id: params.liftPreset,
    category: params.category,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
  });
}
