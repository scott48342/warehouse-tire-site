/**
 * Exit Intent Detection Hook
 * 
 * Detects when user is about to leave the page:
 * - Desktop: Mouse leaving viewport (top edge)
 * - Mobile: Back button gesture or rapid scroll up
 * 
 * @created 2026-07-17
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ExitIntentOptions {
  /** Delay before allowing trigger (ms) - prevents immediate popup */
  delayMs?: number;
  /** Only trigger once per session */
  oncePerSession?: boolean;
  /** Session storage key for tracking */
  sessionKey?: string;
  /** Disable the hook */
  disabled?: boolean;
}

interface ExitIntentState {
  triggered: boolean;
  source: "mouse" | "scroll" | "back" | null;
}

const SESSION_KEY = "wt_exit_intent_shown";

export function useExitIntent(options: ExitIntentOptions = {}): {
  triggered: boolean;
  source: "mouse" | "scroll" | "back" | null;
  reset: () => void;
  dismiss: () => void;
} {
  const {
    delayMs = 5000, // 5 second delay before allowing
    oncePerSession = true,
    sessionKey = SESSION_KEY,
    disabled = false,
  } = options;

  const [state, setState] = useState<ExitIntentState>({
    triggered: false,
    source: null,
  });
  
  const allowedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const scrollUpCountRef = useRef(0);

  // Check if already shown this session
  const alreadyShown = useCallback(() => {
    if (!oncePerSession) return false;
    try {
      return sessionStorage.getItem(sessionKey) === "true";
    } catch {
      return false;
    }
  }, [oncePerSession, sessionKey]);

  // Mark as shown
  const markShown = useCallback(() => {
    if (oncePerSession) {
      try {
        sessionStorage.setItem(sessionKey, "true");
      } catch {
        // Ignore
      }
    }
  }, [oncePerSession, sessionKey]);

  // Trigger exit intent
  const trigger = useCallback((source: "mouse" | "scroll" | "back") => {
    if (disabled || !allowedRef.current || alreadyShown()) return;
    
    setState({ triggered: true, source });
    markShown();
  }, [disabled, alreadyShown, markShown]);

  // Reset trigger
  const reset = useCallback(() => {
    setState({ triggered: false, source: null });
  }, []);

  // Dismiss (mark as shown but reset trigger)
  const dismiss = useCallback(() => {
    markShown();
    setState({ triggered: false, source: null });
  }, [markShown]);

  // Enable after delay
  useEffect(() => {
    if (disabled) return;

    const timer = setTimeout(() => {
      allowedRef.current = true;
    }, delayMs);

    return () => clearTimeout(timer);
  }, [delayMs, disabled]);

  // Desktop: Mouse leaving viewport (top edge)
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Only trigger if mouse leaves from top of viewport
      if (e.clientY <= 0 && allowedRef.current && !alreadyShown()) {
        trigger("mouse");
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [disabled, trigger, alreadyShown]);

  // Mobile: Rapid scroll up detection
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const prevY = lastScrollYRef.current;
      
      // Detect scroll up
      if (currentY < prevY) {
        scrollUpCountRef.current++;
        
        // Trigger after 3 rapid scroll up events near top of page
        if (scrollUpCountRef.current >= 3 && currentY < 100) {
          trigger("scroll");
        }
      } else {
        // Reset on scroll down
        scrollUpCountRef.current = 0;
      }
      
      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [disabled, trigger]);

  // Mobile: Back button detection (using popstate)
  useEffect(() => {
    if (disabled || typeof window === "undefined") return;

    // Push a dummy state to detect back
    const dummyState = { exitIntent: true };
    history.pushState(dummyState, "");

    const handlePopState = (e: PopStateEvent) => {
      if (allowedRef.current && !alreadyShown()) {
        // Re-push state and show popup instead of navigating
        history.pushState(dummyState, "");
        trigger("back");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [disabled, trigger, alreadyShown]);

  return {
    triggered: state.triggered,
    source: state.source,
    reset,
    dismiss,
  };
}

export default useExitIntent;
