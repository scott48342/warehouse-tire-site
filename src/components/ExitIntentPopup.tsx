/**
 * Exit Intent Popup
 * 
 * Shows when user is about to leave the page with items in cart.
 * Captures email to save cart for recovery.
 * 
 * Features:
 * - Smooth fade-in animation
 * - Email validation
 * - Saves email to cart record
 * - Subscribes for marketing
 * - Works on desktop (mouse leave) and mobile (scroll up)
 * 
 * @created 2026-04-05
 * @fixed 2026-04-05 - Improved trigger reliability
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useExitIntent } from "@/hooks/useExitIntent";
import { useCart } from "@/lib/cart/CartContext";
import { getCartId } from "@/lib/cart/useCartTracking";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping/shippingService";

interface ExitIntentPopupProps {
  /** Minimum cart value to show popup (default: $50) */
  minCartValue?: number;
  /** Delay before popup can trigger (ms) */
  delayMs?: number;
}

export function ExitIntentPopup({
  minCartValue = 50,
  delayMs = 10000, // 10 seconds
}: ExitIntentPopupProps) {
  const { items, getTotal } = useCart();
  const { triggered, dismiss } = useExitIntent({
    delayMs,
    oncePerSession: true,
  });

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const cartTotal = getTotal();
  const hasCart = items.length > 0 && cartTotal >= minCartValue;

  // Control visibility with animation delay
  useEffect(() => {
    if (triggered && hasCart) {
      // Small delay for fade-in animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [triggered, hasCart]);

  // Get vehicle from cart items
  const getVehicle = useCallback(() => {
    const wheelOrTire = items.find(
      (i) => (i.type === "wheel" || i.type === "tire") && i.vehicle
    );
    return wheelOrTire?.vehicle || undefined;
  }, [items]);

  // Handle email submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter your email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const cartId = getCartId();
      const vehicle = getVehicle();

      // Subscribe and link to cart
      const response = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          source: "exit_intent",
          vehicle,
          cartId,
          marketingConsent: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save");
      }

      // Also update cart with email
      await fetch("/api/cart/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          customer: { email: trimmedEmail },
          items,
          subtotal: cartTotal,
          estimatedTotal: cartTotal,
          vehicle,
        }),
      });

      setSuccess(true);

      // Auto-close after success
      setTimeout(() => {
        dismiss();
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    dismiss();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Don't render if not triggered or no cart
  if (!triggered || !hasCart) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full max-w-md transform transition-all duration-300 ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-8 opacity-0 scale-95"
        }`}
      >
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 px-6 py-5 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-3xl mb-2">🛒</div>
            <h2 className="text-xl font-bold">Wait! Don&apos;t lose your cart</h2>
            <p className="text-sm text-white/90 mt-1">
              Save your {formatCurrency(cartTotal)} selection and get exclusive deals
            </p>
          </div>

          {/* Body */}
          <div className="p-6">
            {success ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-semibold text-neutral-900">Cart Saved!</h3>
                <p className="text-sm text-neutral-600 mt-1">
                  We&apos;ll send you a link to recover your cart
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label htmlFor="exit-email" className="block text-sm font-medium text-neutral-700 mb-2">
                  Enter your email to save your cart
                </label>
                
                <input
                  id="exit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                />

                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      Save My Cart
                      <span className="text-white/80">→</span>
                    </>
                  )}
                </button>

                <p className="mt-3 text-xs text-neutral-500 text-center">
                  We&apos;ll send a link to recover your cart. No spam, ever.
                </p>
              </form>
            )}
          </div>

          {/* Trust signals */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="text-green-500">✓</span> Free shipping over ${FREE_SHIPPING_THRESHOLD.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-500">✓</span> Easy returns
              </span>
            </div>
          </div>
        </div>

        {/* "No thanks" link */}
        <button
          onClick={handleClose}
          className="mt-4 w-full text-center text-sm text-white/70 hover:text-white transition-colors"
        >
          No thanks, I&apos;ll remember my cart
        </button>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default ExitIntentPopup;
