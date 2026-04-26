/**
 * Client-side Funnel Event Tracker
 * 
 * Usage:
 *   import { trackEvent } from '@/lib/analytics/tracker';
 *   trackEvent('product_view', { productSku: 'ABC123', productType: 'wheel' });
 */

import type { FunnelEventName, DeviceType, StoreMode } from './types';

// Session ID management
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('wtd_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('wtd_session_id', sessionId);
  }
  return sessionId;
}

// Device detection
function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Get traffic source from URL params or referrer
function getTrafficSource(): string {
  if (typeof window === 'undefined') return 'direct';
  
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;
  
  const gclid = params.get('gclid');
  if (gclid) return 'google_ads';
  
  const fbclid = params.get('fbclid');
  if (fbclid) return 'facebook';
  
  const referrer = document.referrer;
  if (!referrer) return 'direct';
  
  try {
    const url = new URL(referrer);
    if (url.hostname.includes('google')) return 'google';
    if (url.hostname.includes('facebook') || url.hostname.includes('fb.')) return 'facebook';
    if (url.hostname.includes('instagram')) return 'instagram';
    if (url.hostname.includes('bing')) return 'bing';
    if (url.hostname.includes('yahoo')) return 'yahoo';
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

// Get store mode from cookie/localStorage
function getStoreMode(): StoreMode {
  if (typeof window === 'undefined') return 'national';
  
  // Check for local mode indicator
  const isLocal = localStorage.getItem('wtd_store_mode') === 'local' ||
                  window.location.hostname.includes('warehousetire.net');
  return isLocal ? 'local' : 'national';
}

// UTM parameters
function getUtmParams(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || undefined,
    medium: params.get('utm_medium') || undefined,
    campaign: params.get('utm_campaign') || undefined,
  };
}

/**
 * Track a funnel event
 */
export async function trackEvent(
  eventName: FunnelEventName,
  data?: {
    productSku?: string;
    productType?: 'wheel' | 'tire' | 'accessory' | 'package';
    cartValue?: number;
    orderId?: string;
    couponCode?: string;
    discountAmount?: number;
    discountType?: 'first_order' | 'promo' | 'manual';
    metadata?: Record<string, any>;
  }
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const utm = getUtmParams();
  
  const event = {
    eventName,
    sessionId: getSessionId(),
    deviceType: getDeviceType(),
    storeMode: getStoreMode(),
    trafficSource: getTrafficSource(),
    pageUrl: window.location.href,
    utmSource: utm.source,
    utmMedium: utm.medium,
    utmCampaign: utm.campaign,
    ...data,
  };
  
  try {
    // Send to API (fire and forget, don't block UI)
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // Silently fail - analytics shouldn't break the site
    });
    
    // Also push to dataLayer for GTM/GA4
    if (typeof window !== 'undefined' && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: eventName,
        ...event,
      });
    }
  } catch {
    // Silently fail
  }
}

/**
 * Track session start (call once on page load)
 */
export function trackSessionStart(): void {
  // Only track once per session
  if (typeof window === 'undefined') return;
  
  const tracked = sessionStorage.getItem('wtd_session_tracked');
  if (!tracked) {
    trackEvent('session_start');
    sessionStorage.setItem('wtd_session_tracked', '1');
  }
}

/**
 * Track product view
 */
export function trackProductView(sku: string, type: 'wheel' | 'tire' | 'accessory' | 'package'): void {
  trackEvent('product_view', { productSku: sku, productType: type });
}

/**
 * Track add to cart
 */
export function trackAddToCart(sku: string, type: 'wheel' | 'tire' | 'accessory' | 'package', cartValue?: number): void {
  trackEvent('add_to_cart', { productSku: sku, productType: type, cartValue });
}

/**
 * Track checkout steps
 */
export function trackBeginCheckout(cartValue: number): void {
  trackEvent('begin_checkout', { cartValue });
}

export function trackCheckoutStep2(cartValue: number): void {
  trackEvent('checkout_step2', { cartValue });
}

export function trackAddShippingInfo(cartValue: number): void {
  trackEvent('add_shipping_info', { cartValue });
}

export function trackAddPaymentInfo(cartValue: number): void {
  trackEvent('add_payment_info', { cartValue });
}

export function trackPurchase(
  orderId: string, 
  cartValue: number, 
  couponCode?: string,
  discountAmount?: number,
  discountType?: 'first_order' | 'promo' | 'manual'
): void {
  trackEvent('purchase', { orderId, cartValue, couponCode, discountAmount, discountType });
}

/**
 * Track first order popup
 */
export function trackFirstOrderPopupShown(): void {
  trackEvent('first_order_popup_shown');
}

export function trackFirstOrderPopupSubmit(email?: string): void {
  trackEvent('first_order_popup_submit', { metadata: { hasEmail: !!email } });
}

export function trackFirstOrderCouponApplied(couponCode: string): void {
  trackEvent('first_order_coupon_applied', { couponCode });
}

export function trackFirstOrderCouponRedeemed(couponCode: string, cartValue: number): void {
  trackEvent('first_order_coupon_redeemed', { couponCode, cartValue });
}
