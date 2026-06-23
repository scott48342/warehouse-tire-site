"use client";

/**
 * PurchaseTracker Component
 *
 * Client component that tracks purchase events.
 * Use in the checkout success page to track completed orders.
 *
 * Fires (all additive, none replace each other):
 *   1. Internal funnel purchase -> /api/analytics/track (existing, unchanged)
 *   2. GA4 standard `purchase` event via gtag (NEW, deduped per order)
 *   3. Enhanced Conversions user_data via gtag set (NEW), set BEFORE the
 *      Google Ads purchase conversion (which still fires in GoogleAdsConversion.tsx).
 *
 * The Google Ads purchase CONVERSION itself is intentionally NOT fired here —
 * it remains in GoogleAdsConversion.tsx to avoid double-counting.
 */

import { useEffect, useRef } from "react";
import { trackPurchase, trackFirstOrderCouponRedeemed } from "./FunnelTracker";
import { ga4Purchase, ga4SetUserData, type Ga4Item } from "@/lib/ga4";

interface PurchaseTrackerProps {
  orderId: string;
  cartValue: number;
  couponCode?: string;
  discountAmount?: number;
  discountType?: 'first_order' | 'promo' | 'manual';
  isFirstOrder?: boolean;
  /** Optional GA4 line items (additive). */
  items?: Ga4Item[];
  tax?: number;
  shipping?: number;
  /** Enhanced Conversions user data (additive). Set before Ads conversion. */
  userData?: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    street?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
}

export function PurchaseTracker({
  orderId,
  cartValue,
  couponCode,
  discountAmount,
  discountType,
  isFirstOrder,
  items,
  tax,
  shipping,
  userData,
}: PurchaseTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    // 1. Internal funnel purchase (existing behavior, unchanged)
    trackPurchase(orderId, cartValue, couponCode, discountAmount, discountType);

    // If first order coupon was used, track redemption
    if (isFirstOrder && couponCode) {
      trackFirstOrderCouponRedeemed(couponCode, cartValue);
    }

    // 2 + 3. GA4 purchase + Enhanced Conversions (deduped per order)
    const ga4Key = `ga4_purchase_${orderId}`;
    if (typeof window !== "undefined" && !sessionStorage.getItem(ga4Key)) {
      // Enhanced Conversions FIRST so it's attached before the Ads conversion fires.
      if (userData) {
        ga4SetUserData(userData);
      }
      ga4Purchase({
        transactionId: orderId,
        value: cartValue,
        items,
        tax,
        shipping,
        coupon: couponCode,
      });
      sessionStorage.setItem(ga4Key, "true");
    }
  }, [orderId, cartValue, couponCode, discountAmount, discountType, isFirstOrder, items, tax, shipping, userData]);

  return null;
}

export default PurchaseTracker;
