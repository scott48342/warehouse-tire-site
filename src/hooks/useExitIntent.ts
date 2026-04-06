/**
 * Exit Intent Detection Hook
 * 
 * Detects when user is about to leave the page:
 * - Desktop: Mouse leaving viewport (top edge)
 * - Mobile: Rapid scroll up near top of page
 * 
 * @created 2026-04-05
 * @fixed 2026-04-05 - Improved reliability, removed history manipulation
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
  source: "mouse" | "scroll" | null;
}

const SESSION_KEY = "wt_exit_intent_shown";

export function useExitIntent(options: ExitIntentOptions = {}): {
  triggered: boolean;
  source: "mouse" | "scroll" | null;
  reset: () => void;
  dismiss: () => void;
} {
  const {
    delayMs = 5000,
    oncePerSession = true,
    sessionKey = SESSION_KEY,
    disabled = false,
  } = options;

  const [state, setState] = useState<ExitIntentState>({
    triggered: false,
    source: null,
  });
  
  const allowedRef = useRef(false);
  const mountedRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const scrollUpCountRef = useRef(0);

  // Check if already shown this session
  const checkAlreadyShown = useCallback((): boolean => {
    if (!oncePerSession) return false;
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(sessionKey) === "true";
    } catch {
      return false;
    }
  }, [oncePerSession, sessionKey]);

  // Mark as shown
  const markShown = useCallback(() => {
    if (!oncePerSession) return;
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(sessionKey, "true");
    } catch {
      // Ignore storage errors
    }
  }, [oncePerSession, sessionKey]);

  // Trigger exit intent
  const trigger = useCallback((source: "mouse" | "scroll") => {
    if (disabled) return;
    if (!allowedRef.current) return;
    if (!mountedRef.current) return;
    if (checkAlreadyShown()) return;
    
    setState({ triggered: true, source });
    markShown();
  }, [disabled, checkAlreadyShown, markShown]);

  // Reset trigger
  const reset = useCallback(() => {
    setState({ triggered: false, source: null });
  }, []);

  // Dismiss (mark as shown and reset)
  const dismiss = useCallback(() => {
    markShown();
    setState({ triggered: false, source: null });
  }, [markShown]);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Enable trigger after delay
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    
    // Check if already shown before setting up
    if (checkAlreadyShown()) {
      return;
    }

    const timer = setTimeout(() => {
      allowedRef.current = true;
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, disabled, checkAlreadyShown]);

  // Desktop: Mouse leaving viewport at top edge
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;
    if (typeof document === "undefined") return;

    const handleMouseOut = (e: MouseEvent) => {
      // Only trigger if mouse actually left the document
      // relatedTarget is null when mouse leaves the window entirely
      if (e.relatedTarget === null && e.clientY <= 5) {
        if (allowedRef.current && mountedRef.current && !checkAlreadyShown()) {
          trigger("mouse");
        }
      }
    };

    // Use mouseout on document.documentElement for better reliability
    document.documentElement.addEventListener("mouseout", handleMouseOut);
    
    return () => {
      document.documentElement.removeEventListener("mouseout", handleMouseOut);
    };
  }, [disabled, trigger, checkAlreadyShown]);

  // Mobile: Rapid scroll up detection near top of page
  useEffect(() => {
    if (disabled) return;
    if (typeof window === "undefined") return;

    let lastY = window.scrollY;
    let upCount = 0;

    const handleScroll = () => {
      const currentY = window.scrollY;
      
      // Detect scroll up
      if (currentY < lastY && currentY < 200) {
        upCount++;
        
        // Trigger after 3+ scroll up events near top
        if (upCount >= 3 && allowedRef.current && mountedRef.current && !checkAlreadyShown()) {
          trigger("scroll");
          upCount = 0; // Reset after triggering
        }
      } else if (currentY > lastY) {
        // Reset on scroll down
        upCount = 0;
      }
      
      lastY = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [disabled, trigger, checkAlreadyShown]);

  return {
    triggered: state.triggered,
    source: state.source,
    reset,
    dismiss,
  };
}

export default useExitIntent;
