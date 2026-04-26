"use client";

/**
 * PurchaseTracker Component
 * 
 * Client component that tracks purchase events.
 * Use in the checkout success page to track completed orders.
 * 
 * Usage:
 *   <PurchaseTracker orderId="ORD-123" cartValue={2399.99} couponCode="SAVE10" />
 */

import { useEffect, useRef } from "react";
import { trackPurchase, trackFirstOrderCouponRedeemed } from "./FunnelTracker";

interface PurchaseTrackerProps {
  orderId: string;
  cartValue: number;
  couponCode?: string;
  isFirstOrder?: boolean;
}

export function PurchaseTracker({ orderId, cartValue, couponCode, isFirstOrder }: PurchaseTrackerProps) {
  const tracked = useRef(false);
  
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    
    // Track the purchase
    trackPurchase(orderId, cartValue, couponCode);
    
    // If first order coupon was used, track redemption
    if (isFirstOrder && couponCode) {
      trackFirstOrderCouponRedeemed(couponCode, cartValue);
    }
  }, [orderId, cartValue, couponCode, isFirstOrder]);
  
  return null;
}

export default PurchaseTracker;
