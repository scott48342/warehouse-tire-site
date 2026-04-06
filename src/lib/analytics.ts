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

export function trackLiftKitSuggestionClick(params: {
  liftInches: number;
  make: string;
  model: string;
}) {
  trackEvent("lift_kit_suggestion_click", {
    lift_inches: params.liftInches,
    vehicle_make: params.make,
    vehicle_model: params.model,
  });
}

// ─────────────────────────────────────────────────────────────
// Staggered Fitment Events
// ─────────────────────────────────────────────────────────────

export function trackStaggeredSetupShown(params: {
  year: string;
  make: string;
  model: string;
  trim?: string;
  frontSpec: { diameter: number; width: number };
  rearSpec: { diameter: number; width: number };
}) {
  trackEvent("staggered_setup_shown", {
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
    vehicle_trim: params.trim,
    front_diameter: params.frontSpec.diameter,
    front_width: params.frontSpec.width,
    rear_diameter: params.rearSpec.diameter,
    rear_width: params.rearSpec.width,
  });
}

export function trackStaggeredSetupSelect(params: {
  setupMode: "square" | "staggered";
  year: string;
  make: string;
  model: string;
  trim?: string;
}) {
  trackEvent("staggered_setup_select", {
    setup_mode: params.setupMode,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
    vehicle_trim: params.trim,
  });
}

export function trackStaggeredAddToCart(params: {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  setupType: "square" | "staggered";
  setPrice: number;
  year?: string;
  make?: string;
  vehicleModel?: string;
}) {
  trackEvent("staggered_add_to_cart", {
    wheel_sku: params.sku,
    rear_sku: params.rearSku,
    wheel_brand: params.brand,
    wheel_model: params.model,
    setup_type: params.setupType,
    set_price: params.setPrice,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.vehicleModel,
  });
}
