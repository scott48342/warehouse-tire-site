/**
 * Cart Tracking Hook
 * 
 * Syncs cart state to server for abandoned cart tracking.
 * Uses debouncing to avoid excessive API calls.
 * 
 * @created 2026-03-25
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import type { CartItem, CartWheelItem, CartTireItem } from "./CartContext";

const CART_ID_KEY = "wt_cart_id";
const SYNC_DEBOUNCE_MS = 2000; // Debounce syncs by 2 seconds
const CHECKOUT_SYNC_DEBOUNCE_MS = 500; // Faster sync during checkout

/**
 * Generate a unique cart ID
 */
function generateCartId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Get or create cart ID from localStorage
 */
export function getCartId(): string {
  if (typeof window === "undefined") return "";
  
  let cartId = localStorage.getItem(CART_ID_KEY);
  if (!cartId) {
    cartId = generateCartId();
    localStorage.setItem(CART_ID_KEY, cartId);
  }
  return cartId;
}

/**
 * Clear cart ID (call when order is completed to start fresh)
 */
export function clearCartId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CART_ID_KEY);
}

/**
 * Get session ID (use existing session storage or create)
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  
  let sessionId = sessionStorage.getItem("wt_session_id");
  if (!sessionId) {
    sessionId = `s-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem("wt_session_id", sessionId);
  }
  return sessionId;
}

/**
 * Extract vehicle info from cart items
 */
function extractVehicle(items: CartItem[]): { year?: string; make?: string; model?: string; trim?: string } | undefined {
  const wheelOrTire = items.find(i => i.type === "wheel" || i.type === "tire") as CartWheelItem | CartTireItem | undefined;
  if (!wheelOrTire?.vehicle) return undefined;
  
  return {
    year: wheelOrTire.vehicle.year,
    make: wheelOrTire.vehicle.make,
    model: wheelOrTire.vehicle.model,
    trim: wheelOrTire.vehicle.trim,
  };
}

/**
 * Calculate cart totals
 */
function calculateTotals(items: CartItem[]): { subtotal: number; estimatedTotal: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  // For now, estimated total is same as subtotal (taxes/shipping calculated at checkout)
  return { subtotal, estimatedTotal: subtotal };
}

interface CustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

/**
 * Sync cart to server
 */
async function syncCart(
  items: CartItem[],
  customer?: CustomerInfo
): Promise<void> {
  const cartId = getCartId();
  if (!cartId) return;

  const sessionId = getSessionId();
  const vehicle = extractVehicle(items);
  const { subtotal, estimatedTotal } = calculateTotals(items);

  try {
    await fetch("/api/cart/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        sessionId,
        customer,
        vehicle,
        items,
        subtotal,
        estimatedTotal,
        source: "web",
      }),
    });
  } catch (err) {
    // Silently fail - cart tracking should never break the user experience
    console.warn("[CartTracking] Failed to sync cart:", err);
  }
}

/**
 * Hook to track cart changes
 */
export function useCartTracking(
  items: CartItem[],
  options?: {
    customer?: CustomerInfo;
    isCheckout?: boolean;
  }
): void {
  const { customer, isCheckout } = options || {};
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<string>("");

  const debouncedSync = useCallback(() => {
    // Create a hash of current state to avoid duplicate syncs
    const stateHash = JSON.stringify({ items: items.map(i => i.sku + i.quantity), customer });
    if (stateHash === lastSyncRef.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const debounceMs = isCheckout ? CHECKOUT_SYNC_DEBOUNCE_MS : SYNC_DEBOUNCE_MS;

    syncTimeoutRef.current = setTimeout(() => {
      lastSyncRef.current = stateHash;
      syncCart(items, customer);
    }, debounceMs);
  }, [items, customer, isCheckout]);

  // Sync on cart changes
  useEffect(() => {
    // Don't sync empty carts
    if (items.length === 0) return;

    debouncedSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [items, customer, debouncedSync]);

  // Sync immediately on checkout page
  useEffect(() => {
    if (isCheckout && items.length > 0) {
      syncCart(items, customer);
    }
  }, [isCheckout, items, customer]);
}

/**
 * Mark cart as recovered when order completes
 */
export async function markCartRecovered(orderId: string): Promise<void> {
  const cartId = getCartId();
  if (!cartId) return;

  try {
    await fetch("/api/cart/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartId,
        items: [], // Empty items signals recovery processing
        subtotal: 0,
        estimatedTotal: 0,
        recovered: true,
        orderId,
      }),
    });
    
    // Clear cart ID so next cart gets a new ID
    clearCartId();
  } catch (err) {
    console.warn("[CartTracking] Failed to mark cart as recovered:", err);
  }
}

export default useCartTracking;
