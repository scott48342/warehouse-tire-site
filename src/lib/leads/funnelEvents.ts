/**
 * Funnel Events Tracking
 * 
 * Track key lead capture and conversion events:
 * - save_modal_shown
 * - save_modal_skipped
 * - save_modal_submitted
 * - lead_created
 * - build_saved
 * - cart_saved
 * - checkout_started
 * - checkout_completed
 * 
 * @created 2026-07-18
 */

// ============================================================================
// Types
// ============================================================================

export type FunnelEventType =
  | "save_modal_shown"
  | "save_modal_skipped"
  | "save_modal_submitted"
  | "lead_created"
  | "build_saved"
  | "cart_saved"
  | "checkout_started"
  | "checkout_completed"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "cart_recovered";

export interface FunnelEventData {
  event: FunnelEventType;
  
  // Identifiers
  sessionId?: string;
  cartId?: string;
  leadId?: string;
  jakeBuildId?: string;
  orderId?: string;
  
  // Source attribution
  sourceSite?: "national" | "local" | "garage";
  sourceChannel?: string;
  landingPage?: string;
  referrer?: string;
  
  // Context
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  cartValue?: number;
  modalContext?: "garage" | "package" | "cart";
  
  // Metadata
  timestamp?: number;
  userAgent?: string;
  ipAddress?: string;
}

// ============================================================================
// Client-side tracking
// ============================================================================

/**
 * Track a funnel event (client-side)
 * Sends to /api/analytics/funnel
 */
export async function trackFunnelEvent(data: FunnelEventData): Promise<void> {
  try {
    // Add timestamp if not provided
    const eventData: FunnelEventData = {
      ...data,
      timestamp: data.timestamp || Date.now(),
    };
    
    // Fire and forget - don't block UI
    fetch("/api/analytics/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    }).catch(err => {
      console.warn("[FunnelEvents] Failed to track event:", err);
    });
    
    // Also push to dataLayer for Google Analytics if available
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: "funnel_event",
        funnel_event_type: data.event,
        funnel_source_site: data.sourceSite,
        funnel_source_channel: data.sourceChannel,
        funnel_cart_value: data.cartValue,
        funnel_modal_context: data.modalContext,
      });
    }
    
  } catch (err) {
    console.warn("[FunnelEvents] Error tracking event:", err);
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

export function trackModalShown(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "save_modal_shown" });
}

export function trackModalSkipped(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "save_modal_skipped" });
}

export function trackModalSubmitted(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "save_modal_submitted" });
}

export function trackLeadCreated(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "lead_created" });
}

export function trackBuildSaved(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "build_saved" });
}

export function trackCartSaved(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "cart_saved" });
}

export function trackCheckoutStarted(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "checkout_started" });
}

export function trackCheckoutCompleted(data: Omit<FunnelEventData, "event">): void {
  trackFunnelEvent({ ...data, event: "checkout_completed" });
}

// ============================================================================
// Export
// ============================================================================

export const funnelEvents = {
  track: trackFunnelEvent,
  modalShown: trackModalShown,
  modalSkipped: trackModalSkipped,
  modalSubmitted: trackModalSubmitted,
  leadCreated: trackLeadCreated,
  buildSaved: trackBuildSaved,
  cartSaved: trackCartSaved,
  checkoutStarted: trackCheckoutStarted,
  checkoutCompleted: trackCheckoutCompleted,
};

export default funnelEvents;
