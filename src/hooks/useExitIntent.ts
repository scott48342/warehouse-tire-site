/**
 * Exit Intent Detection Hook v2
 * 
 * Enhanced exit intent with:
 * - High-intent gating (cart, vehicle, engagement)
 * - A/B variant assignment
 * - Analytics events
 * - Proper frequency controls
 * - Desktop mouse leave + mobile inactivity
 * 
 * @created 2026-04-05
 * @enhanced 2026-04-23 - A/B testing, analytics, better targeting
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export type ExitIntentVariant = "A" | "B" | "C";

interface ExitIntentOptions {
  /** Minimum time on site before allowing trigger (ms) */
  minTimeOnSite?: number;
  /** Require at least one interaction before triggering */
  requireInteraction?: boolean;
  /** Only trigger once per session */
  oncePerSession?: boolean;
  /** Storage key prefix */
  storageKeyPrefix?: string;
  /** Disable the hook */
  disabled?: boolean;
  /** High-intent requirements */
  highIntent?: {
    hasCart?: boolean;
    hasVehicle?: boolean;
    pageViews?: number;
    timeOnSite?: number;
  };
}

interface ExitIntentState {
  triggered: boolean;
  source: "mouse" | "mobile_inactivity" | null;
  variant: ExitIntentVariant;
  eligible: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  shown: "wt_exit_shown",
  dismissed: "wt_exit_dismissed_at",
  submitted: "wt_exit_submitted",
  variant: "wt_exit_variant",
  interactions: "wt_exit_interactions",
  pageViews: "wt_exit_page_views",
  sessionStart: "wt_exit_session_start",
};

// ============================================================================
// Analytics Helper
// ============================================================================

function trackExitIntent(event: string, data: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  
  // Console log for debugging
  console.log(`[ExitIntent] ${event}`, data);
  
  // Google Analytics 4
  if ((window as any).gtag) {
    (window as any).gtag("event", event, data);
  }
  
  // Mixpanel / other analytics
  if ((window as any).mixpanel) {
    (window as any).mixpanel.track(event, data);
  }
  
  // Custom analytics endpoint (optional)
  try {
    navigator.sendBeacon?.("/api/analytics/track", JSON.stringify({
      event,
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // Ignore beacon errors
  }
}

// ============================================================================
// Variant Assignment
// ============================================================================

function getOrAssignVariant(): ExitIntentVariant {
  if (typeof window === "undefined") return "A";
  
  try {
    // Check if already assigned
    const stored = sessionStorage.getItem(STORAGE_KEYS.variant);
    if (stored && ["A", "B", "C"].includes(stored)) {
      return stored as ExitIntentVariant;
    }
    
    // Assign new variant (33/33/33 split)
    const rand = Math.random();
    const variant: ExitIntentVariant = rand < 0.333 ? "A" : rand < 0.666 ? "B" : "C";
    sessionStorage.setItem(STORAGE_KEYS.variant, variant);
    return variant;
  } catch {
    return "A";
  }
}

// ============================================================================
// Main Hook
// ============================================================================

export function useExitIntent(options: ExitIntentOptions = {}): {
  triggered: boolean;
  source: "mouse" | "mobile_inactivity" | null;
  variant: ExitIntentVariant;
  eligible: boolean;
  dismiss: () => void;
  markSubmitted: () => void;
  trackEvent: (event: string, data?: Record<string, any>) => void;
} {
  const {
    minTimeOnSite = 8000, // 8 seconds
    requireInteraction = true,
    oncePerSession = true,
    disabled = false,
    highIntent = {},
  } = options;

  const [state, setState] = useState<ExitIntentState>({
    triggered: false,
    source: null,
    variant: "A",
    eligible: false,
  });

  const hasInteractedRef = useRef(false);
  const sessionStartRef = useRef(Date.now());
  const scrollDepthRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const mobileInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ========== Storage Helpers ==========
  
  const wasShownThisSession = useCallback((): boolean => {
    if (!oncePerSession) return false;
    try {
      return sessionStorage.getItem(STORAGE_KEYS.shown) === "true";
    } catch {
      return false;
    }
  }, [oncePerSession]);

  const wasDismissedRecently = useCallback((): boolean => {
    try {
      const dismissedAt = localStorage.getItem(STORAGE_KEYS.dismissed);
      if (!dismissedAt) return false;
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSince = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      return hoursSince < 24; // Suppress for 24 hours
    } catch {
      return false;
    }
  }, []);

  const wasSubmitted = useCallback((): boolean => {
    try {
      return localStorage.getItem(STORAGE_KEYS.submitted) === "true";
    } catch {
      return false;
    }
  }, []);

  const markShown = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEYS.shown, "true");
    } catch {}
  }, []);

  const markDismissed = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.dismissed, Date.now().toString());
      sessionStorage.setItem(STORAGE_KEYS.shown, "true");
    } catch {}
  }, []);

  const markSubmittedStorage = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.submitted, "true");
      sessionStorage.setItem(STORAGE_KEYS.shown, "true");
    } catch {}
  }, []);

  // ========== High Intent Check ==========
  
  const checkHighIntent = useCallback((): boolean => {
    const { hasCart, hasVehicle, pageViews, timeOnSite } = highIntent;
    
    // If any condition is met, user is high-intent
    if (hasCart) return true;
    if (hasVehicle) return true;
    
    // Check page views
    if (pageViews !== undefined) {
      try {
        const views = parseInt(sessionStorage.getItem(STORAGE_KEYS.pageViews) || "1", 10);
        if (views >= 3) return true;
      } catch {}
    }
    
    // Check time on site
    const elapsed = Date.now() - sessionStartRef.current;
    if (elapsed >= 45000) return true; // 45 seconds
    
    // Check scroll depth (mobile especially)
    if (scrollDepthRef.current >= 60) return true;
    
    return false;
  }, [highIntent]);

  // ========== Eligibility Check ==========
  
  const isEligible = useCallback((): boolean => {
    if (disabled) return false;
    if (wasShownThisSession()) return false;
    if (wasDismissedRecently()) return false;
    if (wasSubmitted()) return false;
    
    const elapsed = Date.now() - sessionStartRef.current;
    if (elapsed < minTimeOnSite) return false;
    
    if (requireInteraction && !hasInteractedRef.current) return false;
    
    if (!checkHighIntent()) return false;
    
    return true;
  }, [disabled, wasShownThisSession, wasDismissedRecently, wasSubmitted, minTimeOnSite, requireInteraction, checkHighIntent]);

  // ========== Trigger ==========
  
  const trigger = useCallback((source: "mouse" | "mobile_inactivity") => {
    if (!isEligible()) return;
    
    const variant = getOrAssignVariant();
    markShown();
    
    setState({
      triggered: true,
      source,
      variant,
      eligible: true,
    });
    
    // Track shown event
    trackExitIntent("exit_capture_shown", {
      variant,
      source,
      device: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      hasCart: highIntent.hasCart || false,
      hasVehicle: highIntent.hasVehicle || false,
      timeOnSite: Math.round((Date.now() - sessionStartRef.current) / 1000),
      scrollDepth: scrollDepthRef.current,
    });
  }, [isEligible, markShown, highIntent]);

  // ========== Dismiss ==========
  
  const dismiss = useCallback(() => {
    markDismissed();
    setState(s => ({ ...s, triggered: false }));
    
    trackExitIntent("exit_capture_dismissed", {
      variant: state.variant,
    });
  }, [markDismissed, state.variant]);

  // ========== Mark Submitted ==========
  
  const markSubmitted = useCallback(() => {
    markSubmittedStorage();
    setState(s => ({ ...s, triggered: false }));
  }, [markSubmittedStorage]);

  // ========== Track Event Helper ==========
  
  const trackEvent = useCallback((event: string, data: Record<string, any> = {}) => {
    trackExitIntent(event, {
      ...data,
      variant: state.variant,
    });
  }, [state.variant]);

  // ========== Initialize ==========
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Get/assign variant on mount
    const variant = getOrAssignVariant();
    setState(s => ({ ...s, variant }));
    
    // Track page view
    try {
      const views = parseInt(sessionStorage.getItem(STORAGE_KEYS.pageViews) || "0", 10);
      sessionStorage.setItem(STORAGE_KEYS.pageViews, (views + 1).toString());
    } catch {}
    
    // Track session start
    try {
      if (!sessionStorage.getItem(STORAGE_KEYS.sessionStart)) {
        sessionStorage.setItem(STORAGE_KEYS.sessionStart, Date.now().toString());
      }
      sessionStartRef.current = parseInt(sessionStorage.getItem(STORAGE_KEYS.sessionStart) || Date.now().toString(), 10);
    } catch {}
  }, []);

  // ========== Interaction Tracking ==========
  
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    
    const handleInteraction = () => {
      hasInteractedRef.current = true;
      lastActivityRef.current = Date.now();
      
      // Check eligibility on interaction
      if (isEligible() && !state.eligible) {
        setState(s => ({ ...s, eligible: true }));
        trackExitIntent("exit_capture_eligible", {
          variant: state.variant,
          hasCart: highIntent.hasCart || false,
          hasVehicle: highIntent.hasVehicle || false,
        });
      }
    };
    
    const handleScroll = () => {
      hasInteractedRef.current = true;
      lastActivityRef.current = Date.now();
      
      // Track scroll depth
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const depth = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
      if (depth > scrollDepthRef.current) {
        scrollDepthRef.current = depth;
      }
    };
    
    window.addEventListener("click", handleInteraction);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleInteraction);
    
    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [disabled, isEligible, state.eligible, state.variant, highIntent]);

  // ========== Desktop: Mouse Leave ==========
  
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined" || typeof document === "undefined") return;
    
    // Skip on mobile
    if (/Mobi|Android/i.test(navigator.userAgent)) return;
    
    const handleMouseOut = (e: MouseEvent) => {
      // Check if mouse left the viewport at top
      if (e.relatedTarget === null && e.clientY <= 5) {
        trigger("mouse");
      }
    };
    
    document.documentElement.addEventListener("mouseout", handleMouseOut);
    
    return () => {
      document.documentElement.removeEventListener("mouseout", handleMouseOut);
    };
  }, [disabled, trigger]);

  // ========== Mobile: Inactivity Detection ==========
  
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    
    // Only on mobile
    if (!/Mobi|Android/i.test(navigator.userAgent)) return;
    
    const checkInactivity = () => {
      const inactiveTime = Date.now() - lastActivityRef.current;
      const hasScrollDepth = scrollDepthRef.current >= 60;
      
      // Trigger if: 8+ seconds inactive, 60%+ scroll depth, high intent
      if (inactiveTime >= 8000 && hasScrollDepth && isEligible()) {
        trigger("mobile_inactivity");
      }
    };
    
    // Check every 2 seconds
    const interval = setInterval(checkInactivity, 2000);
    
    return () => {
      clearInterval(interval);
    };
  }, [disabled, trigger, isEligible]);

  return {
    triggered: state.triggered,
    source: state.source,
    variant: state.variant,
    eligible: state.eligible,
    dismiss,
    markSubmitted,
    trackEvent,
  };
}

export default useExitIntent;
