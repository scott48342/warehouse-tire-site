"use client";

/**
 * FunnelTracker Component
 * 
 * Handles session tracking and provides hooks for funnel events.
 * Add to root layout alongside existing Analytics component.
 * 
 * Dedupe Strategy:
 * - session_start: Once per browser session (sessionStorage flag)
 * - product_view: Once per SKU per session (sessionStorage set)
 * - add_to_cart: Every time (intentional - can add same item multiple times)
 * - checkout steps: Once per checkout attempt (reset on new cart)
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const SESSION_ID_KEY = "wtd_session_id";
const SESSION_TRACKED_KEY = "wtd_session_tracked";
const PRODUCT_VIEWS_KEY = "wtd_product_views";
const CHECKOUT_TRACKED_KEY = "wtd_checkout_tracked";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
}

function getDeviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getStoreMode(): "local" | "national" {
  if (typeof window === "undefined") return "national";
  
  // Check hostname for local store
  if (window.location.hostname.includes("warehousetire.net")) return "local";
  
  // Check localStorage preference
  const stored = localStorage.getItem("wtd_store_mode");
  if (stored === "local") return "local";
  
  return "national";
}

function getTrafficSource(): string {
  if (typeof window === "undefined") return "direct";
  
  const params = new URLSearchParams(window.location.search);
  
  // Check UTM source first
  const utmSource = params.get("utm_source");
  if (utmSource) return utmSource;
  
  // Check ad click IDs
  if (params.get("gclid")) return "google_ads";
  if (params.get("fbclid")) return "facebook";
  if (params.get("msclkid")) return "bing_ads";
  
  // Parse referrer
  const referrer = document.referrer;
  if (!referrer) return "direct";
  
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    
    if (host.includes("google")) return "google";
    if (host.includes("facebook") || host.includes("fb.")) return "facebook";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("bing")) return "bing";
    if (host.includes("yahoo")) return "yahoo";
    if (host.includes("youtube")) return "youtube";
    if (host.includes("tiktok")) return "tiktok";
    
    // Return domain for other referrers
    return host.replace("www.", "");
  } catch {
    return "unknown";
  }
}

function getUtmParams(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === "undefined") return {};
  
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
  };
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

interface TrackEventOptions {
  eventName: string;
  productSku?: string;
  productType?: "wheel" | "tire" | "accessory" | "package";
  cartValue?: number;
  orderId?: string;
  couponCode?: string;
  vehicle?: { year?: number; make?: string; model?: string };
  metadata?: Record<string, any>;
}

async function sendEvent(options: TrackEventOptions): Promise<void> {
  if (typeof window === "undefined") return;
  
  // Skip internal/test traffic
  const hostname = window.location.hostname;
  if (hostname === "localhost" && !window.location.search.includes("track=1")) {
    console.debug("[Funnel] Skipping localhost event:", options.eventName);
    return;
  }
  
  const utm = getUtmParams();
  
  const payload = {
    eventName: options.eventName,
    sessionId: getOrCreateSessionId(),
    deviceType: getDeviceType(),
    storeMode: getStoreMode(),
    trafficSource: getTrafficSource(),
    pageUrl: window.location.href,
    productSku: options.productSku,
    productType: options.productType,
    cartValue: options.cartValue,
    orderId: options.orderId,
    couponCode: options.couponCode,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    metadata: {
      ...options.metadata,
      vehicle: options.vehicle,
    },
  };
  
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Silently fail
  }
}

// ============================================================================
// EXPORTED TRACKING FUNCTIONS
// ============================================================================

/**
 * Track session start (once per session)
 */
export function trackSessionStart(): void {
  if (typeof window === "undefined") return;
  
  const tracked = sessionStorage.getItem(SESSION_TRACKED_KEY);
  if (tracked) return;
  
  sessionStorage.setItem(SESSION_TRACKED_KEY, "1");
  sendEvent({ eventName: "session_start" });
}

/**
 * Track product view (once per SKU per session)
 */
export function trackProductView(
  sku: string,
  type: "wheel" | "tire" | "accessory" | "package",
  vehicle?: { year?: number; make?: string; model?: string }
): void {
  if (typeof window === "undefined") return;
  
  // Check if already viewed this product
  const viewedJson = sessionStorage.getItem(PRODUCT_VIEWS_KEY) || "[]";
  const viewed: string[] = JSON.parse(viewedJson);
  
  const key = `${type}:${sku}`;
  if (viewed.includes(key)) return;
  
  // Mark as viewed
  viewed.push(key);
  sessionStorage.setItem(PRODUCT_VIEWS_KEY, JSON.stringify(viewed));
  
  sendEvent({
    eventName: "product_view",
    productSku: sku,
    productType: type,
    vehicle,
  });
}

/**
 * Track add to cart (every time)
 */
export function trackAddToCart(
  sku: string,
  type: "wheel" | "tire" | "accessory" | "package",
  cartValue?: number,
  vehicle?: { year?: number; make?: string; model?: string }
): void {
  sendEvent({
    eventName: "add_to_cart",
    productSku: sku,
    productType: type,
    cartValue,
    vehicle,
  });
}

/**
 * Track begin checkout (once per checkout attempt)
 */
export function trackBeginCheckout(cartValue: number): void {
  if (typeof window === "undefined") return;
  
  const checkoutState = sessionStorage.getItem(CHECKOUT_TRACKED_KEY);
  if (checkoutState === "begin") return;
  
  sessionStorage.setItem(CHECKOUT_TRACKED_KEY, "begin");
  sendEvent({ eventName: "begin_checkout", cartValue });
}

/**
 * Track checkout step 2 (shipping)
 */
export function trackCheckoutStep2(cartValue: number): void {
  if (typeof window === "undefined") return;
  
  const checkoutState = sessionStorage.getItem(CHECKOUT_TRACKED_KEY);
  if (checkoutState === "step2") return;
  
  sessionStorage.setItem(CHECKOUT_TRACKED_KEY, "step2");
  sendEvent({ eventName: "checkout_step2", cartValue });
}

/**
 * Track add shipping info
 */
export function trackAddShippingInfo(cartValue: number): void {
  if (typeof window === "undefined") return;
  
  const checkoutState = sessionStorage.getItem(CHECKOUT_TRACKED_KEY);
  if (checkoutState === "shipping") return;
  
  sessionStorage.setItem(CHECKOUT_TRACKED_KEY, "shipping");
  sendEvent({ eventName: "add_shipping_info", cartValue });
}

/**
 * Track add payment info
 */
export function trackAddPaymentInfo(cartValue: number): void {
  if (typeof window === "undefined") return;
  
  const checkoutState = sessionStorage.getItem(CHECKOUT_TRACKED_KEY);
  if (checkoutState === "payment") return;
  
  sessionStorage.setItem(CHECKOUT_TRACKED_KEY, "payment");
  sendEvent({ eventName: "add_payment_info", cartValue });
}

/**
 * Track purchase complete
 */
export function trackPurchase(
  orderId: string,
  cartValue: number,
  couponCode?: string
): void {
  // Clear checkout state so next checkout is tracked
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(CHECKOUT_TRACKED_KEY);
  }
  
  sendEvent({
    eventName: "purchase",
    orderId,
    cartValue,
    couponCode,
  });
}

/**
 * Track first order popup shown
 */
export function trackFirstOrderPopupShown(): void {
  sendEvent({ eventName: "first_order_popup_shown" });
}

/**
 * Track first order popup email submit
 */
export function trackFirstOrderPopupSubmit(): void {
  sendEvent({ eventName: "first_order_popup_submit" });
}

/**
 * Track first order coupon applied to cart
 */
export function trackFirstOrderCouponApplied(couponCode: string): void {
  sendEvent({ eventName: "first_order_coupon_applied", couponCode });
}

/**
 * Track first order coupon redeemed (purchase completed)
 */
export function trackFirstOrderCouponRedeemed(couponCode: string, cartValue: number): void {
  sendEvent({ eventName: "first_order_coupon_redeemed", couponCode, cartValue });
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * FunnelTracker Component
 * 
 * Tracks session_start automatically on mount.
 * Must be included in root layout.
 */
export function FunnelTracker(): null {
  const pathname = usePathname();
  const initialized = useRef(false);
  
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    // Track session start on first mount
    trackSessionStart();
  }, []);
  
  return null;
}

export default FunnelTracker;
