/**
 * Early Email Capture Component
 * 
 * Shows in cart slideout when:
 * - Cart has items worth $200+
 * - No email has been captured yet
 * - User hasn't dismissed it in this session
 * 
 * Purpose: Capture email BEFORE checkout to enable recovery emails
 * even if customer abandons at checkout without filling contact info.
 * 
 * Analysis: 76% of abandoned carts had NO email captured.
 * 
 * @created 2026-07-20
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getCartId } from "@/lib/cart/useCartTracking";

interface EarlyEmailCaptureProps {
  cartTotal: number;
  vehicle?: { year: string | number; make: string; model: string; trim?: string; modification?: string } | null;
  onEmailCaptured?: (email: string) => void;
  minCartValue?: number;
}

const SESSION_KEY = "wtd_early_email_dismissed";
const EMAIL_CAPTURED_KEY = "wtd_email_captured";

export function EarlyEmailCapture({ 
  cartTotal, 
  vehicle, 
  onEmailCaptured,
  minCartValue = 200 
}: EarlyEmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed to avoid flash
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already dismissed or email captured this session
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const dismissed = sessionStorage.getItem(SESSION_KEY);
    const captured = sessionStorage.getItem(EMAIL_CAPTURED_KEY);
    
    // Show if: cart >= min value AND not dismissed AND email not captured
    setIsDismissed(!!dismissed || !!captured || cartTotal < minCartValue);
  }, [cartTotal, minCartValue]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    sessionStorage.setItem(SESSION_KEY, "1");
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter your email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please enter a valid email");
      return;
    }

    setIsSubmitting(true);

    try {
      const cartId = getCartId();

      // Update cart tracking with email
      await fetch("/api/cart/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          customer: { email: trimmedEmail },
          subtotal: cartTotal,
          estimatedTotal: cartTotal,
          vehicle,
        }),
      });

      // Also subscribe for marketing
      await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          source: "early_cart_capture",
          vehicle,
          cartId,
          marketingConsent: true,
        }),
      });

      setIsSuccess(true);
      sessionStorage.setItem(EMAIL_CAPTURED_KEY, trimmedEmail);
      onEmailCaptured?.(trimmedEmail);

      // Auto-hide after success
      setTimeout(() => {
        setIsDismissed(true);
      }, 2000);
    } catch (err) {
      setError("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [email, cartTotal, vehicle, onEmailCaptured]);

  // Don't render if dismissed or cart too small
  if (isDismissed) return null;

  if (isSuccess) {
    return (
      <div className="mx-4 mb-3 rounded-lg bg-green-50 border border-green-200 p-3">
        <div className="flex items-center gap-2 text-sm text-green-800">
          <span>✅</span>
          <span className="font-medium">Saved! We'll email your cart if you leave.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-amber-400 hover:text-amber-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-2 mb-2 pr-6">
        <span className="text-base flex-shrink-0">📧</span>
        <div className="text-xs">
          <p className="font-semibold text-amber-900">
            Save your cart for later?
          </p>
          <p className="text-amber-700 mt-0.5">
            Get a link to your exact setup + price alerts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 h-8 rounded-lg border border-amber-300 px-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 bg-white"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "..." : "Save"}
        </button>
      </form>

      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}

      <p className="mt-2 text-[10px] text-amber-600">
        No spam. Just your saved cart + checkout link.
      </p>
    </div>
  );
}

export default EarlyEmailCapture;
