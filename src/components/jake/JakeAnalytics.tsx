"use client";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE ANALYTICS - Track user interactions with Jake
// ═══════════════════════════════════════════════════════════════════════════════

export type JakeEventType =
  | "jake_opened"
  | "jake_closed"
  | "jake_garage_opened"
  | "conversation_started"
  | "message_sent"
  | "message_received"
  | "suggested_prompt_clicked"
  | "vehicle_identified"
  | "vehicle_context_used"
  | "vehicle_learned_from_chat"
  | "vehicle_cleared_from_jake"
  | "product_recommended"
  | "product_clicked"
  | "rail_product_clicked"
  | "recommendation_shown"
  | "package_built"
  | "cart_created"
  | "checkout_started"
  // Package merchandising events
  | "jake_package_view"
  | "jake_package_click"
  | "jake_package_add_to_cart"
  // Gallery and mockup events
  | "gallery_build_context_used"
  // Mockup lifecycle events (Phase 4)
  | "mockup_requested"
  | "mockup_started"
  | "mockup_succeeded"
  | "mockup_failed"
  | "mockup_generated"
  | "mockup_viewed"
  | "mockup_saved"
  | "mockup_shared"
  // Error tracking
  | "error_occurred"
  | "mockup_to_cart"
  | "mockup_to_checkout"
  | "mockup_build_this"
  | "mockup_make_changes";

interface JakeEventData {
  prompt?: string;
  sessionId?: string;
  requestId?: string;
  // Message tracking for conversation replay
  role?: "user" | "assistant";
  content?: string;
  hasVehicle?: boolean;
  query_preview?: string;
  vehicle?: string | {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  product?: {
    type?: string;
    name?: string;
    brand?: string;
    model?: string;
    sku?: string;
    price?: number;
  };
  products?: Array<{
    type?: string;
    brand?: string;
    model?: string;
    sku?: string;
  }>;
  cartId?: string;
  cartUrl?: string;
  cartValue?: number; // Total cart value in dollars
  count?: number;
  // Package merchandising fields
  merchandisingBadge?: "best_value" | "most_popular" | "premium";
  packageId?: string;
  name?: string;
  type?: string;
  source?: "homepage" | "header" | "page" | "floating";
  error?: {
    type?: string;
    message?: string;
  };
  // Gallery/mockup fields
  build?: string;
  wheelStyle?: string;
  // Mockup tracking fields (Phase 4)
  mockupGenerationTime?: number;
  mockupCacheHit?: boolean;
  mockupMethod?: "gpt-image" | "cached";
  mockupErrorCode?: string;
}

// Generate a session ID for tracking conversations
let jakeSessionId: string | null = null;

export function getJakeSessionId(): string {
  if (!jakeSessionId && typeof window !== "undefined") {
    jakeSessionId = sessionStorage.getItem("jake_session_id");
    if (!jakeSessionId) {
      jakeSessionId = `jake_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("jake_session_id", jakeSessionId);
    }
  }
  return jakeSessionId || "unknown";
}

// Restore a specific sessionId (for conversation persistence)
export function setJakeSessionId(sessionId: string): void {
  if (typeof window !== "undefined") {
    jakeSessionId = sessionId;
    sessionStorage.setItem("jake_session_id", sessionId);
  }
}

// Create a fresh sessionId (for "Start New Conversation")
export function resetJakeSessionId(): string {
  if (typeof window !== "undefined") {
    jakeSessionId = `jake_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem("jake_session_id", jakeSessionId);
  }
  return jakeSessionId || "unknown";
}

// Track a conversation message (for replay in admin)
export function trackJakeMessage(role: "user" | "assistant", content: string) {
  trackJakeEvent("message_sent", { role, content });
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
      data: {
        ...data,
        sessionId: getJakeSessionId(),
      },
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
    
    // Package merchandising tracking
    trackPackageView: (packageId: string, badge?: JakeEventData["merchandisingBadge"]) =>
      trackJakeEvent("jake_package_view", { packageId, merchandisingBadge: badge }),
    
    trackPackageClick: (packageId: string, badge?: JakeEventData["merchandisingBadge"]) =>
      trackJakeEvent("jake_package_click", { packageId, merchandisingBadge: badge }),
    
    trackPackageAddToCart: (packageId: string, cartValue?: number, badge?: JakeEventData["merchandisingBadge"]) =>
      trackJakeEvent("jake_package_add_to_cart", { packageId, cartValue, merchandisingBadge: badge }),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDALONE PACKAGE TRACKING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function trackJakePackageView(packageId: string, merchandisingBadge?: "best_value" | "most_popular" | "premium") {
  trackJakeEvent("jake_package_view", { packageId, merchandisingBadge });
}

export function trackJakePackageClick(packageId: string, merchandisingBadge?: "best_value" | "most_popular" | "premium") {
  trackJakeEvent("jake_package_click", { packageId, merchandisingBadge });
}

export function trackJakePackageAddToCart(packageId: string, cartValue?: number, merchandisingBadge?: "best_value" | "most_popular" | "premium") {
  trackJakeEvent("jake_package_add_to_cart", { packageId, cartValue, merchandisingBadge });
}

export default trackJakeEvent;
