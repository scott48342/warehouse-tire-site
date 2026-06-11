/**
 * Quick View Modal Analytics
 * 
 * Tracks user interactions with the quick view feature to measure:
 * - Feature adoption rate (opens per session)
 * - Conversion impact (add-to-cart from quick view vs PDP)
 * - Navigation patterns (quick view → PDP vs quick view → cart)
 */

export type QuickViewEventName =
  | "quick_view_opened"
  | "quick_view_closed"
  | "quick_view_add_to_cart"
  | "quick_view_view_details";

export type QuickViewEventData = {
  product_sku: string;
  product_type: "tire" | "wheel" | "package";
  has_active_vehicle: boolean;
  // Additional context
  source_page?: string;
  time_open_ms?: number;
};

/**
 * Track a quick view event via Google Analytics and our internal analytics.
 */
export function trackQuickViewEvent(
  event: QuickViewEventName,
  data: QuickViewEventData
): void {
  if (typeof window === "undefined") return;

  const eventPayload = {
    ...data,
    timestamp: Date.now(),
    url: window.location.href,
    referrer: document.referrer || undefined,
  };

  // Google Analytics 4 (gtag)
  if (typeof (window as any).gtag === "function") {
    (window as any).gtag("event", event, {
      event_category: "quick_view",
      event_label: data.product_sku,
      product_type: data.product_type,
      has_vehicle: data.has_active_vehicle,
    });
  }

  // Console logging for debugging
  console.log(`[QuickView Analytics] ${event}`, eventPayload);

  // Fire and forget to internal analytics endpoint
  fetch("/api/analytics/quick-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      ...eventPayload,
    }),
    keepalive: true,
  }).catch((err) => {
    // Silent fail - analytics should never block UX
    console.debug("[QuickView Analytics] Failed to send event:", err);
  });
}

/**
 * Track quick view session timing.
 * Call when modal opens to start timer, returns function to stop and report.
 */
export function startQuickViewSession(
  productSku: string,
  productType: "tire" | "wheel" | "package"
): () => number {
  const startTime = Date.now();
  
  return () => {
    const duration = Date.now() - startTime;
    
    // Track session duration if meaningful (> 500ms)
    if (duration > 500) {
      trackQuickViewEvent("quick_view_closed", {
        product_sku: productSku,
        product_type: productType,
        has_active_vehicle: false, // Will be overwritten by actual call
        time_open_ms: duration,
      });
    }
    
    return duration;
  };
}
