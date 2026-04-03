"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCart } from "@/lib/cart/CartContext";
import { getCartId } from "@/lib/cart/useCartTracking";

const STORAGE_KEY = "wt_exit_intent_shown";
const COOLDOWN_HOURS = 24; // Don't show again for 24 hours after dismissing

interface ExitIntentPopupProps {
  /** Minimum cart value to show popup (default $50) */
  minCartValue?: number;
  /** Delay before enabling exit detection (default 5s) */
  enableDelayMs?: number;
}

export function ExitIntentPopup({
  minCartValue = 50,
  enableDelayMs = 5000,
}: ExitIntentPopupProps) {
  const { items } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabledRef = useRef(false);
  const hasShownRef = useRef(false);

  // Calculate cart value
  const cartValue = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const hasQualifyingCart = items.length > 0 && cartValue >= minCartValue;

  // Extract vehicle from cart
  const vehicle = items.find(i => i.type === "wheel" || i.type === "tire")?.vehicle;

  // Check if we should show (not shown recently)
  const shouldShow = useCallback(() => {
    if (typeof window === "undefined") return false;
    
    const lastShown = localStorage.getItem(STORAGE_KEY);
    if (!lastShown) return true;
    
    const lastShownTime = parseInt(lastShown, 10);
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    return Date.now() - lastShownTime > cooldownMs;
  }, []);

  // Handle mouse leave (exit intent)
  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger on mouse leaving through top of viewport
    if (e.clientY > 50) return;
    if (!enabledRef.current) return;
    if (hasShownRef.current) return;
    if (!hasQualifyingCart) return;
    if (!shouldShow()) return;

    hasShownRef.current = true;
    setIsOpen(true);
  }, [hasQualifyingCart, shouldShow]);

  // Enable exit detection after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      enabledRef.current = true;
    }, enableDelayMs);

    return () => clearTimeout(timer);
  }, [enableDelayMs]);

  // Add mouse leave listener
  useEffect(() => {
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [handleMouseLeave]);

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    // Mark as shown
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "exit_intent",
          vehicle: vehicle ? {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
          } : undefined,
          cartId: getCartId(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save email");
      }

      setSubmitted(true);
      // Close after showing success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 pt-8 text-center">
          {!submitted ? (
            <>
              {/* Icon */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>

              {/* Heading */}
              <h2 className="mb-2 text-xl font-bold text-neutral-900">
                Wait! Don't lose your cart
              </h2>
              <p className="mb-1 text-sm text-neutral-600">
                You have <span className="font-semibold">${cartValue.toLocaleString()}</span> worth of items
              </p>
              {vehicle && (
                <p className="mb-4 text-xs text-neutral-500">
                  for your {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-4">
                <label className="block text-left text-xs font-medium text-neutral-700 mb-1">
                  Enter your email to save your cart
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />

                {error && (
                  <p className="mt-2 text-xs text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-xl bg-[var(--brand-red,#dc2626)] py-3 text-sm font-bold text-white hover:bg-[var(--brand-red-700,#b91c1c)] disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save my cart"}
                </button>
              </form>

              <p className="mt-3 text-[11px] text-neutral-400">
                We'll send a link to restore your cart. No spam, ever.
              </p>

              <button
                onClick={handleClose}
                className="mt-3 text-xs text-neutral-500 hover:text-neutral-700 underline"
              >
                No thanks, I'll start over
              </button>
            </>
          ) : (
            <>
              {/* Success state */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-neutral-900">Cart saved!</h2>
              <p className="text-sm text-neutral-600">
                We've sent a recovery link to <span className="font-medium">{email}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExitIntentPopup;
