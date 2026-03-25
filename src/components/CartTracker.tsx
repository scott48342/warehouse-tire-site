"use client";

import { useCart } from "@/lib/cart/CartContext";
import { useCartTracking } from "@/lib/cart/useCartTracking";

/**
 * Component that tracks cart changes for abandoned cart monitoring.
 * 
 * Mount this once in your layout (inside CartProvider) to automatically
 * sync cart state to the server when items change.
 */
export function CartTracker() {
  const { items } = useCart();
  
  // Track cart changes (will sync to server after debounce)
  useCartTracking(items);
  
  return null;
}

export default CartTracker;
