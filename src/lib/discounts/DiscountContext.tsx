/**
 * Discount Context
 * 
 * Manages active discount codes across cart and checkout.
 * Handles auto-apply from localStorage and URL params.
 * 
 * @created 2026-04-25
 */

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export interface ActiveDiscount {
  code: string;
  discountPercent: number;
  expiresAt: Date;
  source: "first_order" | "promo" | "manual";
}

interface DiscountContextValue {
  /** Currently active discount */
  activeDiscount: ActiveDiscount | null;
  
  /** Apply a discount code */
  applyDiscount: (code: string) => Promise<{ success: boolean; error?: string }>;
  
  /** Remove active discount */
  removeDiscount: () => void;
  
  /** Calculate discount amount for a subtotal */
  calculateDiscount: (subtotal: number) => number;
  
  /** Check if we have a valid discount */
  hasDiscount: boolean;
  
  /** Loading state */
  isValidating: boolean;
}

const DiscountContext = createContext<DiscountContextValue | null>(null);

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  discountCode: "wt_first_order_code",
  discountExpires: "wt_first_order_expires",
};

// ============================================================================
// Provider
// ============================================================================

export function DiscountProvider({ children }: { children: ReactNode }) {
  const [activeDiscount, setActiveDiscount] = useState<ActiveDiscount | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // ========== Load from storage on mount ==========
  
  useEffect(() => {
    const loadDiscount = async () => {
      if (typeof window === "undefined") return;
      
      try {
        // Check URL params first
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get("discount");
        
        // Then localStorage
        const storedCode = localStorage.getItem(STORAGE_KEYS.discountCode);
        const storedExpires = localStorage.getItem(STORAGE_KEYS.discountExpires);
        
        const code = urlCode || storedCode;
        
        if (code) {
          // Validate with server
          setIsValidating(true);
          
          const response = await fetch(`/api/discounts/first-order?code=${encodeURIComponent(code)}`);
          const data = await response.json();
          
          if (data.valid) {
            const expiresAt = storedExpires ? new Date(storedExpires) : new Date(Date.now() + 48 * 60 * 60 * 1000);
            
            setActiveDiscount({
              code,
              discountPercent: data.discountPercent || 10,
              expiresAt,
              source: "first_order",
            });
            
            // Store in localStorage if from URL
            if (urlCode) {
              localStorage.setItem(STORAGE_KEYS.discountCode, code);
              localStorage.setItem(STORAGE_KEYS.discountExpires, expiresAt.toISOString());
              
              // Clean URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete("discount");
              window.history.replaceState({}, "", newUrl.toString());
            }
            
            // Track auto-apply
            if ((window as any).gtag) {
              (window as any).gtag("event", "first_order_coupon_applied", {
                code,
                source: urlCode ? "url" : "localStorage",
              });
            }
          } else {
            // Invalid code, clear storage
            localStorage.removeItem(STORAGE_KEYS.discountCode);
            localStorage.removeItem(STORAGE_KEYS.discountExpires);
          }
          
          setIsValidating(false);
        }
      } catch (err) {
        console.error("[DiscountContext] Load error:", err);
        setIsValidating(false);
      }
      
      setHydrated(true);
    };
    
    loadDiscount();
  }, []);

  // ========== Apply Discount ==========
  
  const applyDiscount = useCallback(async (code: string): Promise<{ success: boolean; error?: string }> => {
    setIsValidating(true);
    
    try {
      const response = await fetch(`/api/discounts/first-order?code=${encodeURIComponent(code)}`);
      const data = await response.json();
      
      if (!data.valid) {
        setIsValidating(false);
        return { success: false, error: data.error || "Invalid code" };
      }
      
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      
      setActiveDiscount({
        code: code.toUpperCase(),
        discountPercent: data.discountPercent || 10,
        expiresAt,
        source: "first_order",
      });
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.discountCode, code.toUpperCase());
      localStorage.setItem(STORAGE_KEYS.discountExpires, expiresAt.toISOString());
      
      // Track
      if ((window as any).gtag) {
        (window as any).gtag("event", "first_order_coupon_applied", {
          code: code.toUpperCase(),
          source: "manual",
        });
      }
      
      setIsValidating(false);
      return { success: true };
    } catch (err) {
      setIsValidating(false);
      return { success: false, error: "Failed to validate code" };
    }
  }, []);

  // ========== Remove Discount ==========
  
  const removeDiscount = useCallback(() => {
    setActiveDiscount(null);
    localStorage.removeItem(STORAGE_KEYS.discountCode);
    localStorage.removeItem(STORAGE_KEYS.discountExpires);
  }, []);

  // ========== Calculate Discount ==========
  
  const calculateDiscount = useCallback((subtotal: number): number => {
    if (!activeDiscount) return 0;
    return Math.round(subtotal * (activeDiscount.discountPercent / 100) * 100) / 100;
  }, [activeDiscount]);

  // ========== Context Value ==========
  
  const value: DiscountContextValue = {
    activeDiscount,
    applyDiscount,
    removeDiscount,
    calculateDiscount,
    hasDiscount: !!activeDiscount,
    isValidating,
  };

  return (
    <DiscountContext.Provider value={value}>
      {children}
    </DiscountContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useDiscount() {
  const ctx = useContext(DiscountContext);
  if (!ctx) {
    throw new Error("useDiscount must be used within a DiscountProvider");
  }
  return ctx;
}
