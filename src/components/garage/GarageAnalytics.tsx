/**
 * Jake Garage Analytics
 * 
 * Tracks Jake Garage events separately from main site analytics.
 * All events tagged with source: "jake_garage"
 */

type GarageEvent =
  | "jake_garage_opened"
  | "conversation_started"
  | "vehicle_identified"
  | "recommendation_shown"
  | "package_built"
  | "cart_created"
  | "checkout_started"
  | "abandoned_stage";

interface EventData {
  [key: string]: any;
}

const ANALYTICS_ENDPOINT = "/api/analytics/jake";

/**
 * Track a Jake Garage event
 */
export function trackGarageEvent(event: GarageEvent, data?: EventData) {
  const payload = {
    event,
    source: "jake_garage",
    timestamp: new Date().toISOString(),
    sessionId: getGarageSessionId(),
    url: typeof window !== "undefined" ? window.location.href : "",
    ...data,
  };

  // Console log for debugging
  console.log(`[Jake Garage] ${event}`, data || "");

  // Send to analytics endpoint
  if (typeof window !== "undefined") {
    // Use sendBeacon for better reliability
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
    } else {
      // Fallback to fetch
      fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't break UX for analytics
      });
    }
  }
}

/**
 * Get or create a session ID for the garage session
 */
function getGarageSessionId(): string {
  if (typeof window === "undefined") return "server";
  
  const STORAGE_KEY = "jake_garage_session";
  let sessionId = sessionStorage.getItem(STORAGE_KEY);
  
  if (!sessionId) {
    sessionId = `garage_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(STORAGE_KEY, sessionId);
  }
  
  return sessionId;
}

/**
 * Track abandonment when user leaves
 */
export function trackAbandonment(stage: string) {
  trackGarageEvent("abandoned_stage", { stage });
}

/**
 * Hook to track page visibility changes (abandonment)
 */
export function useAbandonmentTracking(stage: string) {
  if (typeof window === "undefined") return;
  
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      trackAbandonment(stage);
    }
  };

  window.addEventListener("visibilitychange", handleVisibilityChange);
  
  return () => {
    window.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
