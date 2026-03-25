"use client";

import { useEffect, useRef } from "react";
import { markCartRecovered, clearCartId } from "@/lib/cart/useCartTracking";
import { useCart } from "@/lib/cart/CartContext";

/**
 * Client component that handles cart recovery when an order is placed.
 * 
 * Place this on the checkout success page to:
 * 1. Mark the tracked cart as recovered
 * 2. Clear the cart
 * 3. Clear the cart ID for next session
 */
export function CartRecoveryHandler({ orderId }: { orderId: string }) {
  const { clearCart } = useCart();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    // Mark cart as recovered on the server
    markCartRecovered(orderId);
    
    // Clear the local cart
    clearCart();
    
    console.log("[CartRecoveryHandler] Cart cleared and marked as recovered for order:", orderId);
  }, [orderId, clearCart]);

  // This component doesn't render anything
  return null;
}

export default CartRecoveryHandler;
