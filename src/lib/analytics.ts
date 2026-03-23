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
}) {
  trackEvent("lifted_cta_click", {
    preset_id: params.liftPreset,
    lift_inches: params.liftInches,
    vehicle_year: params.year,
    vehicle_make: params.make,
    vehicle_model: params.model,
  });
}
