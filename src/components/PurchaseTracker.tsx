"use client";

/**
 * PurchaseTracker Component
 * 
 * Client component that tracks purchase events.
 * Use in the checkout success page to track completed orders.
 * 
 * Usage:
 *   <PurchaseTracker orderId="ORD-123" cartValue={2399.99} couponCode="SAVE10" discountAmount={50} discountType="first_order" />
 */

import { useEffect, useRef } from "react";
import { trackPurchase, trackFirstOrderCouponRedeemed } from "./FunnelTracker";

interface PurchaseTrackerProps {
  orderId: string;
  cartValue: number;
  couponCode?: string;
  discountAmount?: number;
  discountType?: 'first_order' | 'promo' | 'manual';
  isFirstOrder?: boolean;
}

export function PurchaseTracker({ 
  orderId, 
  cartValue, 
  couponCode, 
  discountAmount,
  discountType,
  isFirstOrder 
}: PurchaseTrackerProps) {
  const tracked = useRef(false);
  
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    
    // Track the purchase with discount info (if available)
    trackPurchase(orderId, cartValue, couponCode, discountAmount, discountType);
    
    // If first order coupon was used, track redemption
    if (isFirstOrder && couponCode) {
      trackFirstOrderCouponRedeemed(couponCode, cartValue);
    }
  }, [orderId, cartValue, couponCode, discountAmount, discountType, isFirstOrder]);
  
  return null;
}

export default PurchaseTracker;
