/**
 * Exit Intent Popup v2
 * 
 * Enhanced exit capture with:
 * - 3 A/B copy variants
 * - Proper analytics tracking
 * - High-intent gating
 * - Success/error states
 * - Better UX copy
 * 
 * @created 2026-04-05
 * @enhanced 2026-04-23 - A/B testing, improved copy, analytics
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useExitIntent, type ExitIntentVariant } from "@/hooks/useExitIntent";
import { useCart } from "@/lib/cart/CartContext";
import { getCartId } from "@/lib/cart/useCartTracking";

// ============================================================================
// Variant Copy
// ============================================================================

interface VariantCopy {
  headline: string;
  subhead: string;
  placeholder: string;
  cta: string;
  trustLine: string;
  bullets: string[];
}

const VARIANT_COPY: Record<ExitIntentVariant, VariantCopy> = {
  A: {
    headline: "Keep your setup",
    subhead: "Email yourself this vehicle-matched wheel & tire package so you can come back anytime.",
    placeholder: "Enter your email",
    cta: "Email My Setup →",
    trustLine: "We'll send your saved cart and a direct checkout link. No spam.",
    bullets: ["Vehicle fitment saved", "Pricing saved", "Resume anytime"],
  },
  B: {
    headline: "Don't lose this setup",
    subhead: "Your matched wheels & tires may change in price or availability.",
    placeholder: "Enter your email to save it",
    cta: "Save My Setup →",
    trustLine: "We'll send your cart and notify you if anything changes.",
    bullets: ["Stock updates", "Price change alerts", "Quick return to checkout"],
  },
  C: {
    headline: "Get your setup sent as a quote",
    subhead: "We'll email your exact wheel & tire package so you can review or finish later.",
    placeholder: "Enter your email",
    cta: "Send My Quote →",
    trustLine: "Includes your vehicle, fitment, and total price.",
    bullets: ["Exact fitment included", "Full package pricing", "Easy checkout link"],
  },
};

// ============================================================================
// Props
// ============================================================================

interface ExitIntentPopupProps {
  /** Minimum cart value to show popup (default: $0 = any cart) */
  minCartValue?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ExitIntentPopup({ minCartValue = 0 }: ExitIntentPopupProps) {
  const { items, getTotal } = useCart();
  const cartTotal = getTotal();
  const hasCart = items.length > 0 && cartTotal >= minCartValue;
  
  // Get vehicle from cart
  const vehicle = items.find(
    (i) => (i.type === "wheel" || i.type === "tire") && i.vehicle
  )?.vehicle;
  const hasVehicle = !!vehicle;

  // Exit intent hook with high-intent requirements
  const { 
    triggered, 
    variant, 
    dismiss, 
    markSubmitted,
    trackEvent,
  } = useExitIntent({
    minTimeOnSite: 8000, // 8 seconds
    requireInteraction: true,
    oncePerSession: true,
    disabled: false,
    highIntent: {
      hasCart,
      hasVehicle,
    },
  });

  // Disable on POS subdomain
  const [isPOS, setIsPOS] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsPOS(window.location.hostname.startsWith("pos."));
    }
  }, []);

  // State
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [emailStarted, setEmailStarted] = useState(false);

  // Get variant copy
  const copy = VARIANT_COPY[variant];

  // Control visibility with animation
  useEffect(() => {
    if (triggered && hasCart) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [triggered, hasCart]);

  // Track email field interaction
  const handleEmailFocus = useCallback(() => {
    if (!emailStarted) {
      setEmailStarted(true);
      trackEvent("exit_capture_email_started");
    }
  }, [emailStarted, trackEvent]);

  // Handle submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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
    const startTime = Date.now();

    try {
      const cartId = getCartId();

      // Track submit attempt
      trackEvent("exit_capture_submitted", {
        cartItemCount: items.length,
        hasVehicle,
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      });

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

      const data = await response.json();
      
      if (!response.ok) {
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

      // Track success
      trackEvent("exit_capture_success", {
        responseTimeMs: Date.now() - startTime,
      });

      setSuccess(true);
      markSubmitted();

      // Auto-close after success
      setTimeout(() => {
        dismiss();
      }, 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      
      // Track error
      trackEvent("exit_capture_error", {
        errorReason: message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    trackEvent("exit_capture_dismissed", {
      hadEmailTyped: email.length > 0,
    });
    dismiss();
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Don't render conditions
  if (isPOS) return null;
  if (!triggered) return null;
  if (!hasCart) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent pointer-events-none"
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
          {/* Header */}
          <div className="bg-gradient-to-br from-neutral-800 to-neutral-900 px-6 py-5 text-white relative">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-3xl mb-2">🚗</div>
            <h2 className="text-xl font-bold">{copy.headline}</h2>
            <p className="text-sm text-white/80 mt-1">{copy.subhead}</p>
          </div>

          {/* Body */}
          <div className="p-6">
            {success ? (
              // Success State
              <div className="text-center py-4">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-neutral-900">Check your email</h3>
                <p className="text-sm text-neutral-600 mt-2">
                  We just sent your setup and checkout link.
                </p>
                <p className="text-xs text-neutral-400 mt-3">
                  If you don't see it in a minute, check spam/promotions.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-4 px-6 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              // Form State
              <form onSubmit={handleSubmit}>
                {/* Vehicle Context */}
                {vehicle && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <span className="text-green-600">✔</span>
                      <span className="font-medium">
                        Fitment for {vehicle.year} {vehicle.make} {vehicle.model}
                      </span>
                    </div>
                  </div>
                )}

                <label htmlFor="exit-email" className="block text-sm font-medium text-neutral-700 mb-2">
                  {copy.placeholder}
                </label>

                <input
                  id="exit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleEmailFocus}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-neutral-300 rounded-xl text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  autoFocus
                  autoComplete="email"
                  disabled={loading}
                />

                {error && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠</span> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    copy.cta
                  )}
                </button>

                <p className="mt-3 text-xs text-neutral-500 text-center">
                  {copy.trustLine}
                </p>
              </form>
            )}
          </div>

          {/* Support bullets */}
          {!success && (
            <div className="px-6 pb-5">
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                {copy.bullets.map((bullet, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-green-500">✔</span> {bullet}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* "No thanks" link */}
        {!success && (
          <button
            onClick={handleClose}
            className="mt-4 w-full text-center text-sm text-white/60 hover:text-white transition-colors"
          >
            No thanks, I'll remember my setup
          </button>
        )}
      </div>
    </div>
  );
}

export default ExitIntentPopup;
