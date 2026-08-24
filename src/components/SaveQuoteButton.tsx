"use client";

/**
 * Save Quote Button
 * 
 * Allows users to save their cart configuration as a quote.
 * - Authenticated users: Direct save to account
 * - Guest users: Creates pending quote → redirect to auth → claim
 * 
 * @created 2026-08-24
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { useGarage } from "@/contexts/GarageContext";
import { authClient } from "@/lib/auth-client";
import { storePendingClaim } from "@/lib/savedQuotes/pendingClaimStorage";
import { getCartId } from "@/lib/cart/useCartTracking";
import type { SaveQuoteRequest } from "@/lib/savedQuotes/types";

interface SaveQuoteButtonProps {
  variant?: "inline" | "button";
  returnTo?: string;
  onSaveComplete?: () => void;
}

export function SaveQuoteButton({ 
  variant = "inline", 
  returnTo,
  onSaveComplete,
}: SaveQuoteButtonProps) {
  const router = useRouter();
  const { items } = useCart();
  const cartId = getCartId();
  const { activeVehicle } = useGarage();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Don't show if no items
  if (items.length === 0) {
    return null;
  }

  // Don't show if no vehicle context
  if (!activeVehicle) {
    return null;
  }

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      // Check if user is authenticated
      const session = await authClient.getSession();
      const isAuthenticated = !!session?.data?.user;
      
      // Build quote request from cart
      const quoteRequest = buildQuoteRequest();
      if (!quoteRequest) {
        setError("Unable to save quote. Please ensure you have items in your cart.");
        setIsSaving(false);
        return;
      }
      
      if (isAuthenticated) {
        // Authenticated: Direct save
        const res = await fetch("/api/account/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...quoteRequest,
            idempotencyKey: `cart_${cartId}_${Date.now()}`,
          }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          if (data.code === "limit_reached") {
            setError("You've reached the maximum of 20 saved quotes. Remove one to save a new quote.");
          } else if (data.code === "email_not_verified") {
            setError("Please verify your email to save quotes.");
          } else {
            setError(data.message || "Failed to save quote");
          }
          setIsSaving(false);
          return;
        }
        
        setSuccess(true);
        onSaveComplete?.();
        
        // Brief success state, then redirect
        setTimeout(() => {
          router.push(`/account?quote_saved=${data.id}`);
        }, 500);
        
      } else {
        // Guest: Create pending quote and redirect to auth
        const currentPath = returnTo || window.location.pathname + window.location.search;
        
        const res = await fetch(`/api/quotes/pending?returnTo=${encodeURIComponent(currentPath)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quoteRequest),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.message || "Failed to save quote");
          setIsSaving(false);
          return;
        }
        
        // Store token in sessionStorage for post-auth claim
        // This survives the login/register/verify flow
        storePendingClaim(data.token, currentPath);
        
        // Build claim URL for the return destination
        const claimUrl = `/account/claim-quote?token=${encodeURIComponent(data.token)}`;
        
        // Redirect to login with claim URL as return destination
        router.push(`/login?returnTo=${encodeURIComponent(claimUrl)}`);
      }
      
    } catch (err) {
      console.error("[SaveQuoteButton] Error:", err);
      setError("Something went wrong. Please try again.");
      setIsSaving(false);
    }
  };

  /**
   * Build SaveQuoteRequest from cart state
   */
  function buildQuoteRequest(): SaveQuoteRequest | null {
    if (!activeVehicle || items.length === 0) return null;
    
    const quoteItems: SaveQuoteRequest["items"] = items.map(item => {
      if (item.type === "wheel") {
        return {
          type: "wheel",
          sku: item.sku,
          rearSku: item.rearSku,
          brand: item.brand,
          model: item.model,
          finish: item.finish,
          diameter: item.diameter,
          width: item.width,
          offset: item.offset,
          boltPattern: item.boltPattern,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          staggered: item.staggered,
        };
      } else if (item.type === "tire") {
        return {
          type: "tire",
          sku: item.sku,
          rearSku: item.rearSku,
          brand: item.brand,
          model: item.model,
          size: item.size,
          rearSize: item.rearSize,
          loadIndex: item.loadIndex,
          speedRating: item.speedRating,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          staggered: item.staggered,
          source: item.source,
        };
      } else {
        // Accessory
        return {
          type: "accessory",
          sku: item.sku,
          brand: item.brand || "Unknown",
          model: item.name || item.sku,
          category: item.category,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          required: item.required,
          reason: item.reason,
        };
      }
    });
    
    return {
      vehicle: {
        year: activeVehicle.year,
        make: activeVehicle.make,
        model: activeVehicle.model,
        trim: activeVehicle.trim,
        modification: activeVehicle.modification,
      },
      items: quoteItems,
      source: "cart",
      cartId,
    };
  }

  // Inline variant (like EmailCartButton)
  if (variant === "inline") {
    return (
      <button
        onClick={handleSave}
        disabled={isSaving || success}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 flex items-center gap-1.5"
      >
        {isSaving ? (
          <>
            <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : success ? (
          <>
            <span>✓</span>
            Saved!
          </>
        ) : (
          <>
            <span>📋</span>
            Save Quote
          </>
        )}
      </button>
    );
  }

  // Button variant
  return (
    <div className="space-y-2">
      <button
        onClick={handleSave}
        disabled={isSaving || success}
        className="flex h-10 w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 gap-2"
      >
        {isSaving ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Saving...
          </>
        ) : success ? (
          <>
            <span>✓</span>
            Quote Saved!
          </>
        ) : (
          <>
            <span>📋</span>
            Save This Quote
          </>
        )}
      </button>
      
      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
      
      {!success && !isSaving && (
        <p className="text-xs text-neutral-500 text-center">
          Save to your account for easy access later
        </p>
      )}
    </div>
  );
}
