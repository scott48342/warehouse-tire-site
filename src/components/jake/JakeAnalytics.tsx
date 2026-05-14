"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE ANALYTICS - Track user interactions with Jake
// ═══════════════════════════════════════════════════════════════════════════════

export type JakeEventType =
  | "jake_opened"
  | "jake_closed"
  | "conversation_started"
  | "message_sent"
  | "suggested_prompt_clicked"
  | "vehicle_identified"
  | "product_recommended"
  | "product_clicked"
  | "package_built"
  | "cart_created"
  | "checkout_started";

interface JakeEventData {
  prompt?: string;
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  product?: {
    type?: string;
    name?: string;
    brand?: string;
    sku?: string;
    price?: string;
  };
  count?: number;
  name?: string;
  type?: string;
  source?: "homepage" | "header" | "page" | "floating";
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACK EVENT
// ═══════════════════════════════════════════════════════════════════════════════

export function trackJakeEvent(event: JakeEventType, data?: JakeEventData) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log(`[Jake Analytics] ${event}`, data);
  }

  // Send to Google Analytics (if available)
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", event, {
      event_category: "jake_assistant",
      ...data,
    });
  }

  // Send to custom analytics endpoint
  try {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    // Fire and forget - don't await
    fetch("/api/analytics/jake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silent fail - analytics should never break the UX
    });
  } catch {
    // Silent fail
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useJakeAnalytics() {
  return {
    trackOpened: (source: JakeEventData["source"]) => 
      trackJakeEvent("jake_opened", { source }),
    
    trackClosed: () => 
      trackJakeEvent("jake_closed"),
    
    trackConversationStarted: () => 
      trackJakeEvent("conversation_started"),
    
    trackMessageSent: () => 
      trackJakeEvent("message_sent"),
    
    trackPromptClicked: (prompt: string) => 
      trackJakeEvent("suggested_prompt_clicked", { prompt }),
    
    trackVehicleIdentified: (vehicle: JakeEventData["vehicle"]) => 
      trackJakeEvent("vehicle_identified", { vehicle }),
    
    trackProductRecommended: (count: number) => 
      trackJakeEvent("product_recommended", { count }),
    
    trackProductClicked: (product: JakeEventData["product"]) => 
      trackJakeEvent("product_clicked", { product }),
    
    trackPackageBuilt: () => 
      trackJakeEvent("package_built"),
    
    trackCartCreated: () => 
      trackJakeEvent("cart_created"),
    
    trackCheckoutStarted: () => 
      trackJakeEvent("checkout_started"),
  };
}

export default trackJakeEvent;
