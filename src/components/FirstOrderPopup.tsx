/**
 * First Order Discount Popup
 * 
 * Premium-styled popup offering 10% off first order.
 * Triggers based on time/interaction, not exit intent.
 * 
 * @created 2026-04-25
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  trackFirstOrderPopupShown, 
  trackFirstOrderPopupSubmit 
} from "./FunnelTracker";
import { useIsLocalMode } from "@/contexts/ShopContextProvider";

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  emailCaptured: "wt_first_order_captured",
  discountCode: "wt_first_order_code",
  discountExpires: "wt_first_order_expires",
  dismissed: "wt_first_order_dismissed",
  sessionStart: "wt_first_order_session",
  pageViews: "wt_first_order_views",
  shown: "wt_first_order_shown",
};

// ============================================================================
// Analytics Helper
// ============================================================================

function trackEvent(event: string, data: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  
  console.log(`[FirstOrderPopup] ${event}`, data);
  
  // Google Analytics 4
  if ((window as any).gtag) {
    (window as any).gtag("event", event, data);
  }
  
  // Beacon to analytics endpoint
  try {
    navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
      event,
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore
  }
}

// ============================================================================
// Component
// ============================================================================

export function FirstOrderPopup() {
  // Local mode check - don't show popup on local site
  const isLocalMode = useIsLocalMode();
  
  // State
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [isPOS, setIsPOS] = useState(false);
  
  // Refs
  const hasTriggeredRef = useRef(false);
  const sessionStartRef = useRef(Date.now());
  const pageViewsRef = useRef(1);
  const hasInteractedRef = useRef(false);

  // ========== Check Eligibility ==========
  
  const isEligible = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    
    try {
      // Already captured email
      if (localStorage.getItem(STORAGE_KEYS.emailCaptured) === "true") return false;
      
      // Dismissed this session
      if (sessionStorage.getItem(STORAGE_KEYS.dismissed) === "true") return false;
      
      // Already shown this session
      if (sessionStorage.getItem(STORAGE_KEYS.shown) === "true") return false;
      
      // Has active discount code
      const existingCode = localStorage.getItem(STORAGE_KEYS.discountCode);
      const expiresAt = localStorage.getItem(STORAGE_KEYS.discountExpires);
      if (existingCode && expiresAt) {
        const expiry = new Date(expiresAt);
        if (expiry > new Date()) {
          // Valid code exists, don't show popup
          return false;
        }
      }
      
      return true;
    } catch {
      return true;
    }
  }, []);

  // ========== Show Popup ==========
  
  const showPopup = useCallback(() => {
    if (!isEligible()) return;
    if (hasTriggeredRef.current) return;
    
    hasTriggeredRef.current = true;
    
    try {
      sessionStorage.setItem(STORAGE_KEYS.shown, "true");
    } catch {}
    
    setIsVisible(true);
    setTimeout(() => setIsAnimatingIn(true), 50);
    
    trackEvent("first_order_popup_shown", {
      timeOnSite: Math.round((Date.now() - sessionStartRef.current) / 1000),
      pageViews: pageViewsRef.current,
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    });
    
    // Funnel tracking
    trackFirstOrderPopupShown();
  }, [isEligible]);

  // ========== Trigger Logic ==========
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check for POS subdomain
    if (window.location.hostname.startsWith("pos.")) {
      setIsPOS(true);
      return;
    }
    
    // Check if already has discount from URL
    const params = new URLSearchParams(window.location.search);
    const urlDiscount = params.get("discount");
    if (urlDiscount) {
      try {
        localStorage.setItem(STORAGE_KEYS.discountCode, urlDiscount);
        localStorage.setItem(STORAGE_KEYS.emailCaptured, "true");
      } catch {}
      return;
    }
    
    // Initialize session tracking
    try {
      if (!sessionStorage.getItem(STORAGE_KEYS.sessionStart)) {
        sessionStorage.setItem(STORAGE_KEYS.sessionStart, Date.now().toString());
      }
      sessionStartRef.current = parseInt(
        sessionStorage.getItem(STORAGE_KEYS.sessionStart) || Date.now().toString(), 
        10
      );
      
      // Track page views
      const views = parseInt(sessionStorage.getItem(STORAGE_KEYS.pageViews) || "0", 10);
      pageViewsRef.current = views + 1;
      sessionStorage.setItem(STORAGE_KEYS.pageViews, pageViewsRef.current.toString());
    } catch {}
    
    // Check eligibility
    if (!isEligible()) return;
    
    // Time-based trigger: 12-18 seconds (randomized)
    const delay = 12000 + Math.random() * 6000;
    const timeoutId = setTimeout(() => {
      if (hasInteractedRef.current || pageViewsRef.current >= 2) {
        showPopup();
      }
    }, delay);
    
    // Interaction tracking
    const handleInteraction = () => {
      hasInteractedRef.current = true;
    };
    
    window.addEventListener("click", handleInteraction);
    window.addEventListener("scroll", handleInteraction, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("scroll", handleInteraction);
    };
  }, [isEligible, showPopup]);

  // ========== Page View Trigger ==========
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isPOS) return;
    if (!isEligible()) return;
    
    // Show after 2 page views (product engagement)
    if (pageViewsRef.current >= 2 && !hasTriggeredRef.current) {
      const delay = 5000 + Math.random() * 3000; // 5-8 seconds after 2nd page
      const timeoutId = setTimeout(showPopup, delay);
      return () => clearTimeout(timeoutId);
    }
  }, [isEligible, isPOS, showPopup]);

  // ========== Submit Handler ==========
  
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
      setError("Please enter a valid email");
      return;
    }
    
    setLoading(true);
    
    try {
      const sessionId = sessionStorage.getItem("wt_session_id") || undefined;
      
      const response = await fetch("/api/discounts/first-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          sessionId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      
      // Save discount to localStorage for auto-apply
      try {
        localStorage.setItem(STORAGE_KEYS.emailCaptured, "true");
        localStorage.setItem(STORAGE_KEYS.discountCode, data.code);
        localStorage.setItem(STORAGE_KEYS.discountExpires, data.expiresAt);
      } catch {}
      
      setDiscountCode(data.code);
      setSuccess(true);
      
      trackEvent("first_order_popup_submit", {
        device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      });
      
      // Funnel tracking
      trackFirstOrderPopupSubmit();
      
      // Auto-close after showing success
      setTimeout(() => {
        handleClose();
      }, 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      
      trackEvent("first_order_popup_error", { error: message });
    } finally {
      setLoading(false);
    }
  };

  // ========== Close Handler ==========
  
  const handleClose = () => {
    setIsAnimatingIn(false);
    
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
    
    try {
      sessionStorage.setItem(STORAGE_KEYS.dismissed, "true");
    } catch {}
    
    if (!success) {
      trackEvent("first_order_popup_dismissed");
    }
  };

  // ========== Backdrop Click ==========
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // ========== Don't Render ==========
  
  if (isPOS) return null;
  if (isLocalMode) return null; // No discount popup on local site
  if (!isVisible) return null;

  // ========== Render ==========
  
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isAnimatingIn ? "bg-black/70 backdrop-blur-sm" : "bg-transparent"
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full max-w-md transform transition-all duration-300 ${
          isAnimatingIn
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-8 opacity-0 scale-95"
        }`}
      >
        {/* Card */}
        <div className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-700/50">
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {success ? (
            // ========== Success State ==========
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                You're All Set! 🎉
              </h2>
              
              <p className="text-neutral-400 mb-6">
                Your 10% savings will apply automatically at checkout.
              </p>
              
              {/* Code Display */}
              <div className="bg-neutral-800 border border-dashed border-red-500/50 rounded-xl p-4 mb-6">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  Your Code
                </p>
                <p className="text-2xl font-mono font-bold text-white tracking-wider">
                  {discountCode}
                </p>
              </div>
              
              <p className="text-xs text-neutral-500">
                We've also emailed this code to you as backup.
              </p>
              
              <button
                onClick={handleClose}
                className="mt-6 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            // ========== Form State ==========
            <>
              {/* Header */}
              <div className="p-8 pb-0 text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  First-Time Visitor Offer
                </div>
                
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  Unlock 10% Off
                </h2>
                <h3 className="text-lg text-white/90 mb-2">
                  Your First Order
                </h3>
                
                <p className="text-neutral-400 text-sm">
                  Enter your email and we'll instantly apply your private savings code at checkout.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-8 pt-6">
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-4 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all pr-12"
                    autoFocus
                    autoComplete="email"
                    disabled={loading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                {error && (
                  <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      Unlock My Savings
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Trust Line */}
                <p className="mt-4 text-xs text-neutral-500 text-center">
                  One-time use • Expires in 48 hours • No spam, ever.
                </p>
              </form>
            </>
          )}
        </div>

        {/* "No thanks" link */}
        {!success && (
          <button
            onClick={handleClose}
            className="mt-4 w-full text-center text-sm text-neutral-400 hover:text-white transition-colors"
          >
            No thanks
          </button>
        )}
      </div>
    </div>
  );
}

export default FirstOrderPopup;
