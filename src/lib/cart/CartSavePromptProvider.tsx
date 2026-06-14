"use client";

/**
 * Cart Save Prompt Provider
 * 
 * Wraps the cart context and provides the Save My Cart modal integration.
 * Automatically tracks when to show the prompt based on cart state.
 * 
 * @created 2026-07-18
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { SaveCartModal, type SaveCartModalProps, type ModalContext } from "@/components/SaveCartModal";
import { useCart } from "./CartContext";
import { getCartId, getSessionId } from "./useCartTracking";
import { trackModalShown, trackModalSkipped, trackModalSubmitted } from "@/lib/leads";

// ============================================================================
// Constants
// ============================================================================

const PROMPT_STORAGE_PREFIX = "wtd_save_prompt_";
const PROMPT_COOLDOWN_HOURS = 24; // Don't re-prompt for 24 hours after skip
const MIN_CART_VALUE_FOR_PROMPT = 100; // Only prompt for carts worth at least this

// ============================================================================
// Types
// ============================================================================

interface CartSavePromptContextValue {
  /** Whether the modal is currently open */
  isModalOpen: boolean;
  
  /** Whether we've already captured email for this cart */
  hasEmail: boolean;
  
  /** Whether user has skipped the prompt for this session */
  hasSkipped: boolean;
  
  /** Whether we should show the prompt (based on all conditions) */
  shouldPrompt: boolean;
  
  /** Open the save cart modal */
  openModal: () => void;
  
  /** Close the modal (user skipped) */
  closeModal: () => void;
  
  /** Mark as saved (after successful capture) */
  markSaved: () => void;
  
  /** Trigger prompt on view cart action */
  onViewCart: () => void;
  
  /** Trigger prompt on checkout action - returns true if should block */
  onCheckout: () => boolean;
  
  /** Set saved email (for checkout flow) */
  setEmail: (email: string) => void;
}

const CartSavePromptContext = createContext<CartSavePromptContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface CartSavePromptProviderProps {
  children: ReactNode;
  
  /** Source site for attribution (auto-detected if not provided) */
  sourceSite?: "national" | "local" | "garage";
  
  /** Default source channel */
  sourceChannel?: SaveCartModalProps["sourceChannel"];
  
  /** Is this Jake Garage? (affects modal text) */
  isGarage?: boolean;
  
  /** Custom headline */
  headline?: string;
  
  /** Custom subtext */
  subtext?: string;
}

export function CartSavePromptProvider({
  children,
  sourceSite,
  sourceChannel = "cart_save",
  isGarage = false,
  headline,
  subtext,
}: CartSavePromptProviderProps) {
  const cart = useCart();
  const cartId = typeof window !== "undefined" ? getCartId() : undefined;
  const sessionId = typeof window !== "undefined" ? getSessionId() : undefined;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [promptedThisSession, setPromptedThisSession] = useState(false);
  
  // Detect source site from hostname
  const [detectedSite, setDetectedSite] = useState<"national" | "local" | "garage">("national");
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.includes("warehousetire.net")) {
        setDetectedSite("local");
      } else if (window.location.pathname.startsWith("/garage")) {
        setDetectedSite("garage");
      } else {
        setDetectedSite("national");
      }
    }
  }, []);
  
  const effectiveSite = sourceSite || detectedSite;
  
  // Load saved/skipped state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && cartId) {
      const savedKey = `${PROMPT_STORAGE_PREFIX}saved_${cartId}`;
      const skippedKey = `${PROMPT_STORAGE_PREFIX}skipped_${cartId}`;
      const skippedAtKey = `${PROMPT_STORAGE_PREFIX}skipped_at_${cartId}`;
      
      if (localStorage.getItem(savedKey) === "true") {
        setHasEmail(true);
      }
      
      const skippedAt = localStorage.getItem(skippedAtKey);
      if (skippedAt) {
        const hoursSinceSkip = (Date.now() - parseInt(skippedAt)) / (1000 * 60 * 60);
        if (hoursSinceSkip < PROMPT_COOLDOWN_HOURS) {
          setHasSkipped(true);
        } else {
          // Clear old skip
          localStorage.removeItem(skippedKey);
          localStorage.removeItem(skippedAtKey);
        }
      }
    }
  }, [cartId]);
  
  // Calculate if we should prompt
  const cartTotal = cart.getTotal();
  const itemCount = cart.getItemCount();
  const shouldPrompt = 
    !hasEmail && 
    !hasSkipped && 
    !promptedThisSession &&
    itemCount > 0 && 
    cartTotal >= MIN_CART_VALUE_FOR_PROMPT;
  
  // Get vehicle from cart items
  const vehicleFromCart = cart.items.find(item => 
    (item.type === "wheel" || item.type === "tire") && 
    (item as any).vehicle
  )?.vehicle as { year: string; make: string; model: string; trim?: string } | undefined;
  
  // Determine modal context
  const hasWheelsAndTires = cart.hasWheels() && cart.hasTires();
  const modalContext: ModalContext = isGarage || effectiveSite === "garage" 
    ? "garage" 
    : hasWheelsAndTires 
      ? "package" 
      : "cart";
  
  // Tracking data for funnel events
  const getTrackingData = useCallback(() => ({
    sessionId,
    cartId,
    sourceSite: effectiveSite,
    sourceChannel,
    cartValue: cartTotal,
    modalContext,
    vehicle: vehicleFromCart,
  }), [sessionId, cartId, effectiveSite, sourceChannel, cartTotal, modalContext, vehicleFromCart]);
  
  const openModal = useCallback(() => {
    if (!hasEmail && !hasSkipped) {
      setIsModalOpen(true);
      setPromptedThisSession(true);
    }
  }, [hasEmail, hasSkipped]);
  
  // Handle modal shown (for analytics)
  const handleModalShown = useCallback(() => {
    trackModalShown(getTrackingData());
  }, [getTrackingData]);
  
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setHasSkipped(true);
    
    // Track skip
    trackModalSkipped(getTrackingData());
    
    if (typeof window !== "undefined" && cartId) {
      localStorage.setItem(`${PROMPT_STORAGE_PREFIX}skipped_${cartId}`, "true");
      localStorage.setItem(`${PROMPT_STORAGE_PREFIX}skipped_at_${cartId}`, Date.now().toString());
    }
  }, [cartId, getTrackingData]);
  
  const markSaved = useCallback(() => {
    setHasEmail(true);
    setIsModalOpen(false);
    
    // Track submission
    trackModalSubmitted(getTrackingData());
    
    if (typeof window !== "undefined" && cartId) {
      localStorage.setItem(`${PROMPT_STORAGE_PREFIX}saved_${cartId}`, "true");
    }
  }, [cartId, getTrackingData]);
  
  const setEmail = useCallback((email: string) => {
    if (email) {
      setHasEmail(true);
      if (typeof window !== "undefined" && cartId) {
        localStorage.setItem(`${PROMPT_STORAGE_PREFIX}saved_${cartId}`, "true");
      }
    }
  }, [cartId]);
  
  // View cart trigger - show after short delay
  const onViewCart = useCallback(() => {
    if (shouldPrompt) {
      setTimeout(() => {
        setIsModalOpen(true);
        setPromptedThisSession(true);
      }, 1500); // 1.5 second delay to let user see cart first
    }
  }, [shouldPrompt]);
  
  // Checkout trigger - show immediately, return whether to proceed
  const onCheckout = useCallback((): boolean => {
    if (shouldPrompt) {
      setIsModalOpen(true);
      setPromptedThisSession(true);
      return false; // Don't block checkout - just show modal
    }
    return true; // Proceed with checkout
  }, [shouldPrompt]);
  
  // Build cart snapshot for the modal
  const cartSnapshot = cart.items.map(item => ({
    type: item.type,
    sku: item.sku,
    brand: item.brand,
    name: item.type === "accessory" ? item.name : item.model,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    imageUrl: item.imageUrl,
  }));
  
  const contextValue: CartSavePromptContextValue = {
    isModalOpen,
    hasEmail,
    hasSkipped,
    shouldPrompt,
    openModal,
    closeModal,
    markSaved,
    onViewCart,
    onCheckout,
    setEmail,
  };
  
  return (
    <CartSavePromptContext.Provider value={contextValue}>
      {children}
      
      {/* The modal - rendered at provider level */}
      <SaveCartModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={markSaved}
        onSkip={closeModal}
        onShow={handleModalShown}
        vehicle={vehicleFromCart ? {
          year: vehicleFromCart.year,
          make: vehicleFromCart.make,
          model: vehicleFromCart.model,
          trim: vehicleFromCart.trim,
        } : undefined}
        cartId={cartId}
        cartValue={cartTotal}
        cartItems={cartSnapshot}
        sourceSite={effectiveSite}
        sourceChannel={sourceChannel}
        sessionId={sessionId}
        modalContext={modalContext}
        headline={headline}
        subtext={subtext}
      />
    </CartSavePromptContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCartSavePrompt(): CartSavePromptContextValue {
  const context = useContext(CartSavePromptContext);
  if (!context) {
    // Return a no-op implementation if used outside provider
    return {
      isModalOpen: false,
      hasEmail: false,
      hasSkipped: false,
      shouldPrompt: false,
      openModal: () => {},
      closeModal: () => {},
      markSaved: () => {},
      onViewCart: () => {},
      onCheckout: () => true,
      setEmail: () => {},
    };
  }
  return context;
}

export default CartSavePromptProvider;
