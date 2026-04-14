/**
 * Client-side analytics event tracking
 * 
 * Sends events to our analytics endpoint for conversion tracking,
 * A/B testing, and product improvement.
 * 
 * Fire-and-forget: never blocks UX, fails silently.
 */

export type AnalyticsEventName =
  | "smart_tire_upsell_shown"
  | "smart_tire_upsell_accepted"
  | "smart_tire_upsell_skipped"
  | "wheel_add_to_cart"
  | "tire_add_to_cart"
  | "package_started"
  | "package_completed"
  | "checkout_started"
  | "checkout_completed"
  | "fitment_search"
  | "recommendation_clicked";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

// Session ID for correlating events
let sessionId: string | null = null;

function getSessionId(): string {
  if (sessionId) return sessionId;
  
  if (typeof sessionStorage !== "undefined") {
    sessionId = sessionStorage.getItem("wt_session_id");
    if (!sessionId) {
      sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem("wt_session_id", sessionId);
    }
  } else {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
  
  return sessionId;
}

// Cart ID for linking events to purchases
function getCartId(): string | null {
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("wt_cart_id");
  }
  return null;
}

/**
 * Track an analytics event (fire-and-forget)
 */
export function track(
  name: AnalyticsEventName | string, 
  properties?: Record<string, unknown>
): void {
  // Don't block - queue and send async
  queueMicrotask(() => {
    sendEvent({
      name: name as AnalyticsEventName,
      properties,
      timestamp: Date.now(),
    });
  });
}

/**
 * Send event to analytics endpoint
 */
async function sendEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const payload = {
      ...event,
      sessionId: getSessionId(),
      cartId: getCartId(),
      url: typeof window !== "undefined" ? window.location.href : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };

    // Send to analytics endpoint
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // Use keepalive to ensure delivery even if page unloads
      keepalive: true,
    });
  } catch (e) {
    // Silent fail - analytics should never break UX
    if (process.env.NODE_ENV === "development") {
      console.debug("[Analytics] Event send failed:", e);
    }
  }
}

/**
 * Track page view (call from layout or page components)
 */
export function trackPageView(
  path: string, 
  properties?: Record<string, unknown>
): void {
  track("page_view" as AnalyticsEventName, {
    path,
    ...properties,
  });
}
