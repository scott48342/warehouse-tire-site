"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { CartAccessoryItem, AccessoryRecommendationState } from "./accessoryTypes";
import { getCartId } from "./useCartTracking";

export type { CartAccessoryItem, AccessoryRecommendationState };

/**
 * Track add-to-cart event for product popularity analytics.
 * Fire-and-forget: never blocks cart UX.
 */
async function trackAddToCartEvent(
  item: CartWheelItem | CartTireItem,
  source?: string
): Promise<void> {
  try {
    const cartId = getCartId();
    if (!cartId) return;

    // Get session ID if available
    const sessionId = typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("wt_session_id")
      : null;

    // Build product name based on type
    let productName: string;
    let size: string | undefined;
    let specs: Record<string, unknown> | undefined;

    if (item.type === "wheel") {
      const wheel = item as CartWheelItem;
      productName = `${wheel.brand} ${wheel.model}${wheel.finish ? ` - ${wheel.finish}` : ""}`;
      size = wheel.diameter ? `${wheel.diameter}"` : undefined;
      specs = {
        diameter: wheel.diameter,
        width: wheel.width,
        offset: wheel.offset,
        boltPattern: wheel.boltPattern,
        staggered: wheel.staggered,
      };
    } else {
      const tire = item as CartTireItem;
      productName = `${tire.brand} ${tire.model}`;
      size = tire.size;
      specs = {
        size: tire.size,
        loadIndex: tire.loadIndex,
        speedRating: tire.speedRating,
        staggered: tire.staggered,
      };
    }

    await fetch("/api/cart/add-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productType: item.type,
        sku: item.sku,
        rearSku: item.rearSku,
        productName,
        brand: item.brand,
        price: item.unitPrice,
        quantity: item.quantity,
        size,
        specs,
        cartId,
        sessionId,
        vehicle: item.vehicle,
        source: source || "unknown",
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
      }),
    });
  } catch (err) {
    // Silently fail - analytics should never block cart experience
    console.warn("[CartTracking] Failed to track add-to-cart:", err);
  }
}

export type CartWheelItem = {
  type: "wheel";
  sku: string;
  rearSku?: string; // For staggered setups
  brand: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  rearWidth?: string;
  offset?: string;
  rearOffset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  fitmentClass?: "surefit" | "specfit" | "extended";
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  staggered?: boolean;
  /** Supplier source (e.g., "wheelpros") - for internal use only */
  source?: string;
};

export type CartTireItem = {
  type: "tire";
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  size: string;
  rearSize?: string;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  staggered?: boolean;
  /** Supplier source (e.g., "tireweb:atd", "km") - for internal use only */
  source?: string;
};

export type CartItem = CartWheelItem | CartTireItem | CartAccessoryItem;

type CartContextValue = {
  items: CartItem[];
  /** Add item to cart. Optional source for analytics (pdp, package, search, etc.) */
  addItem: (item: CartItem, source?: string) => void;
  addAccessory: (item: CartAccessoryItem) => void;
  addAccessories: (items: CartAccessoryItem[]) => void;
  /** Update an accessory in-place by SKU (safe immutable update). */
  updateAccessory: (sku: string, patch: Partial<CartAccessoryItem>) => void;
  /** Replace an accessory's SKU (e.g., placeholder → real Gorilla SKU). */
  replaceAccessorySku: (oldSku: string, next: CartAccessoryItem) => void;
  removeItem: (sku: string, type: "wheel" | "tire" | "accessory") => void;
  updateQuantity: (sku: string, type: "wheel" | "tire" | "accessory", quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getTotal: () => number;
  hasWheels: () => boolean;
  hasTires: () => boolean;
  hasAccessories: () => boolean;
  getWheels: () => CartWheelItem[];
  getTires: () => CartTireItem[];
  getAccessories: () => CartAccessoryItem[];
  getRequiredAccessories: () => CartAccessoryItem[];
  // Accessory recommendation state (for UI)
  accessoryState: AccessoryRecommendationState | null;
  setAccessoryState: (state: AccessoryRecommendationState | null) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  lastAddedItem: CartItem | null;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_STORAGE_KEY = "wt_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [accessoryState, setAccessoryState] = useState<AccessoryRecommendationState | null>(null);

  // Load cart from localStorage on mount
  // Note: This is the correct SSR hydration pattern - localStorage isn't available during SSR
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
  }, []);

  // Refresh tire prices on cart load to ensure current pricing
  // This catches any items added with stale/incorrect prices
  useEffect(() => {
    if (!hydrated) return;
    
    const refreshTirePrices = async () => {
      const tireItems = items.filter((i): i is CartTireItem => i.type === "tire");
      if (tireItems.length === 0) return;

      let hasUpdates = false;
      const updatedItems = [...items];

      for (const tire of tireItems) {
        try {
          // Fetch current price for this tire
          const res = await fetch(
            `/api/tires/search?partNumber=${encodeURIComponent(tire.sku)}&limit=1`
          );
          if (!res.ok) continue;
          
          const data = await res.json();
          const result = data?.results?.[0];
          if (!result) continue;

          // Calculate correct display price (sell price, or cost + $50)
          const cost = typeof result.cost === "number" && result.cost > 0 ? result.cost : null;
          const sellPrice = typeof result.price === "number" && result.price > 0 ? result.price : null;
          const currentPrice = sellPrice || (cost ? cost + 50 : null);

          if (currentPrice && Math.abs(currentPrice - tire.unitPrice) > 0.01) {
            // Price has changed - update it
            console.log(`[Cart] Refreshing tire price: ${tire.sku} $${tire.unitPrice} → $${currentPrice}`);
            const idx = updatedItems.findIndex(i => i.sku === tire.sku && i.type === "tire");
            if (idx >= 0) {
              updatedItems[idx] = { ...updatedItems[idx], unitPrice: currentPrice };
              hasUpdates = true;
            }
          }
        } catch (err) {
          // Silent fail - don't break cart if price refresh fails
          console.warn(`[Cart] Failed to refresh price for ${tire.sku}:`, err);
        }
      }

      if (hasUpdates) {
        setItems(updatedItems);
      }
    };

    // Run price refresh (fire-and-forget, non-blocking)
    refreshTirePrices();
  }, [hydrated]); // Only run once after hydration, not on every items change

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch {
        // Ignore storage errors
      }
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem, source?: string) => {
    setItems((prev) => {
      // Check if item already exists (same SKU and type)
      const existingIndex = prev.findIndex(
        (i) => i.sku === item.sku && i.type === item.type
      );

      if (existingIndex >= 0) {
        // Update quantity of existing item
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
        };
        return updated;
      }

      // Add new item
      return [...prev, item];
    });
    setLastAddedItem(item);
    setIsOpen(true);

    // Track add-to-cart event for tires/wheels (not accessories)
    if (item.type === "tire" || item.type === "wheel") {
      trackAddToCartEvent(item as CartWheelItem | CartTireItem, source);
    }
  }, []);

  /**
   * Remove an item from cart with dependency cleanup.
   * 
   * When removing a WHEEL:
   * - Also removes wheel-dependent accessories (lug nuts, hub rings, etc.)
   * - Accessories with `wheelSku` matching the removed wheel are cleaned up
   * - Tires and unrelated accessories are preserved
   * 
   * When removing a TIRE or ACCESSORY:
   * - Only that specific item is removed
   */
  const removeItem = useCallback((sku: string, type: "wheel" | "tire" | "accessory") => {
    setItems((prev) => {
      // If removing a wheel, also remove dependent accessories
      if (type === "wheel") {
        const wheelToRemove = prev.find(i => i.type === "wheel" && i.sku === sku) as CartWheelItem | undefined;
        
        if (wheelToRemove) {
          console.log("[cart] Removing wheel:", sku);
          
          // Find and log dependent accessories that will be removed
          const dependentAccessories = prev.filter(i => {
            if (i.type !== "accessory") return false;
            const acc = i as CartAccessoryItem;
            // Remove if wheelSku matches OR if it's a wheel-dependent category with no other wheels
            const isLinkedToThisWheel = acc.wheelSku === sku;
            return isLinkedToThisWheel;
          });
          
          if (dependentAccessories.length > 0) {
            console.log("[cart] Removing dependent accessories:", dependentAccessories.map(a => a.sku));
          }
          
          // Check if there are other wheels remaining
          const otherWheels = prev.filter(i => i.type === "wheel" && i.sku !== sku);
          const hasOtherWheels = otherWheels.length > 0;
          
          // Filter out the wheel and its dependent accessories
          return prev.filter(i => {
            // Always remove the target wheel
            if (i.type === "wheel" && i.sku === sku) return false;
            
            // For accessories, check if they're dependent on this wheel
            if (i.type === "accessory") {
              const acc = i as CartAccessoryItem;
              
              // If accessory is explicitly linked to this wheel, remove it
              if (acc.wheelSku === sku) return false;
              
              // If accessory is wheel-dependent category AND no other wheels remain, remove it
              // (catches accessories that weren't explicitly linked but are wheel-dependent)
              const wheelDependentCategories = ["lug_nut", "hub_ring", "lug_bolt", "valve_stem"];
              if (!hasOtherWheels && wheelDependentCategories.includes(acc.category)) {
                console.log("[cart] Removing orphaned wheel accessory:", acc.sku);
                return false;
              }
            }
            
            // Keep everything else (tires, other accessories)
            return true;
          });
        }
      }
      
      // Standard removal for non-wheel items
      return prev.filter((i) => !(i.sku === sku && i.type === type));
    });
  }, []);

  const updateQuantity = useCallback(
    (sku: string, type: "wheel" | "tire" | "accessory", quantity: number) => {
      if (quantity <= 0) {
        removeItem(sku, type);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.sku === sku && i.type === type ? { ...i, quantity } : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    setLastAddedItem(null);
  }, []);

  const getItemCount = useCallback(() => {
    return items.reduce((sum, i) => sum + i.quantity, 0);
  }, [items]);

  const getTotal = useCallback(() => {
    return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }, [items]);

  const hasWheels = useCallback(() => {
    return items.some((i) => i.type === "wheel");
  }, [items]);

  const hasTires = useCallback(() => {
    return items.some((i) => i.type === "tire");
  }, [items]);

  const getWheels = useCallback(() => {
    return items.filter((i): i is CartWheelItem => i.type === "wheel");
  }, [items]);

  const getTires = useCallback(() => {
    return items.filter((i): i is CartTireItem => i.type === "tire");
  }, [items]);

  const hasAccessories = useCallback(() => {
    return items.some((i) => i.type === "accessory");
  }, [items]);

  const getAccessories = useCallback(() => {
    return items.filter((i): i is CartAccessoryItem => i.type === "accessory");
  }, [items]);

  const getRequiredAccessories = useCallback(() => {
    return items.filter(
      (i): i is CartAccessoryItem => i.type === "accessory" && i.required
    );
  }, [items]);

  const addAccessory = useCallback((item: CartAccessoryItem) => {
    setItems((prev) => {
      // Check if already exists
      const existingIndex = prev.findIndex(
        (i) => i.type === "accessory" && i.sku === item.sku
      );
      if (existingIndex >= 0) {
        // Already added, don't duplicate
        return prev;
      }
      console.log("[cart] Adding accessory:", item.sku, item.name);
      return [...prev, item];
    });
  }, []);

  const addAccessories = useCallback((newItems: CartAccessoryItem[]) => {
    setItems((prev) => {
      const existingSkus = new Set(
        prev.filter((i) => i.type === "accessory").map((i) => i.sku)
      );
      const toAdd = newItems.filter((i) => !existingSkus.has(i.sku));
      if (toAdd.length === 0) return prev;
      console.log("[cart] Adding accessories:", toAdd.map((i) => i.sku));
      return [...prev, ...toAdd];
    });
  }, []);

  const updateAccessory = useCallback((sku: string, patch: Partial<CartAccessoryItem>) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.type !== "accessory") return i;
        if (i.sku !== sku) return i;
        return { ...(i as CartAccessoryItem), ...patch };
      })
    );
  }, []);

  const replaceAccessorySku = useCallback((oldSku: string, next: CartAccessoryItem) => {
    setItems((prev) => {
      const withoutOld = prev.filter((i) => !(i.type === "accessory" && i.sku === oldSku));
      // If new sku already exists, don't duplicate; instead merge meta onto existing.
      const existingIdx = withoutOld.findIndex((i) => i.type === "accessory" && i.sku === next.sku);
      if (existingIdx >= 0) {
        const updated = [...withoutOld];
        const existing = updated[existingIdx] as CartAccessoryItem;
        updated[existingIdx] = {
          ...existing,
          ...next,
          meta: { ...(existing.meta || {}), ...(next.meta || {}) },
        };
        return updated;
      }
      return [...withoutOld, next];
    });
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        addAccessory,
        addAccessories,
        updateAccessory,
        replaceAccessorySku,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        getTotal,
        hasWheels,
        hasTires,
        hasAccessories,
        getWheels,
        getTires,
        getAccessories,
        getRequiredAccessories,
        accessoryState,
        setAccessoryState,
        isOpen,
        setIsOpen,
        lastAddedItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
