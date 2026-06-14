"use client";

/**
 * Save My Cart/Build/Setup Modal
 * 
 * Non-blocking modal for capturing leads before abandonment.
 * Triggered on: View Cart, Checkout click, Jake package view
 * 
 * Key UX principles:
 * - Always skippable (never block checkout)
 * - Value-focused messaging ("Save your build")
 * - Personalized with vehicle when available
 * - Minimal friction (just email required)
 * 
 * Messaging strategy:
 * - Jake Garage → "Save Your Build"
 * - Wheel/Tire Packages → "Save Your Setup"
 * - Traditional Cart → "Save Your Cart"
 * - With vehicle → "Save Your 2021 Silverado Build"
 * 
 * @created 2026-07-18
 * @updated 2026-07-18 - Personalized messaging, build value display
 */

import { useState, useCallback, useEffect } from "react";
import { X, Check, Mail, Car, ShoppingCart, Loader2, Package, Wrench } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type ModalContext = "garage" | "package" | "cart";

export interface SaveCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSkip?: () => void; // Called when user skips (for analytics)
  onShow?: () => void; // Called when modal is displayed (for analytics)
  
  // Pre-fill data
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
  };
  cartId?: string;
  cartValue?: number;
  cartItems?: any[];
  checkoutUrl?: string;
  
  // Source tracking
  sourceSite?: "national" | "local" | "garage";
  sourceChannel?: "cart_save" | "checkout" | "build_save" | "jake_package" | "exit_intent";
  sessionId?: string;
  landingPage?: string;
  referrer?: string;
  
  // Build context (for Jake Garage)
  jakeBuildId?: string;
  tireSize?: string;
  wheelSize?: string;
  liftLevel?: string;
  buildProfile?: string;
  
  // Customize text (overrides auto-generated)
  headline?: string;
  subtext?: string;
  ctaText?: string;
  skipText?: string;
  
  // Context detection (auto-detected if not provided)
  modalContext?: ModalContext;
  
  // Legacy prop (mapped to modalContext)
  isGarage?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getVehicleShortName(vehicle?: { year?: string; make?: string; model?: string }): string | null {
  if (!vehicle?.year || !vehicle?.make || !vehicle?.model) return null;
  // Return "2021 Silverado" or "F-150" style
  const model = vehicle.model;
  return `${vehicle.year} ${model}`;
}

function getVehicleMakeModel(vehicle?: { make?: string; model?: string }): string | null {
  if (!vehicle?.make || !vehicle?.model) return null;
  return `${vehicle.make} ${vehicle.model}`;
}

// ============================================================================
// Component
// ============================================================================

export function SaveCartModal({
  isOpen,
  onClose,
  onSuccess,
  onSkip,
  onShow,
  vehicle,
  cartId,
  cartValue,
  cartItems,
  checkoutUrl,
  sourceSite = "national",
  sourceChannel = "cart_save",
  sessionId,
  landingPage,
  referrer,
  jakeBuildId,
  tireSize,
  wheelSize,
  liftLevel,
  buildProfile,
  headline,
  subtext,
  ctaText,
  skipText,
  modalContext,
  isGarage = false,
}: SaveCartModalProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Determine context: garage > package > cart
  const effectiveContext: ModalContext = modalContext || (
    isGarage || sourceSite === "garage" ? "garage" :
    (cartItems?.some(i => i.type === "wheel") && cartItems?.some(i => i.type === "tire")) ? "package" :
    "cart"
  );
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail("");
      setError(null);
      setSuccess(false);
      onShow?.(); // Fire analytics event
    }
  }, [isOpen, onShow]);
  
  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);
  
  // Handle skip (close + analytics)
  const handleSkip = useCallback(() => {
    onSkip?.();
    onClose();
  }, [onSkip, onClose]);
  
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Basic validation
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          vehicle,
          cartId,
          cartValue,
          cartSnapshot: cartItems,
          checkoutUrl: checkoutUrl || (typeof window !== "undefined" ? window.location.href : undefined),
          sourceSite,
          sourceChannel,
          sessionId,
          landingPage: landingPage || (typeof window !== "undefined" ? window.location.pathname : undefined),
          referrer: referrer || (typeof document !== "undefined" ? document.referrer : undefined),
          jakeBuildId,
          tireSize,
          wheelSize,
          liftLevel,
          buildProfile,
          modalContext: effectiveContext,
          marketingConsent: true,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }
      
      // Success!
      setSuccess(true);
      
      // Store in localStorage to not show again for same cart
      if (cartId && typeof window !== "undefined") {
        localStorage.setItem(`cart_saved_${cartId}`, "true");
      }
      
      // Auto-close after success
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
      
    } catch (err: any) {
      console.error("[SaveCartModal] Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [email, vehicle, cartId, cartValue, cartItems, checkoutUrl, sourceSite, sourceChannel, sessionId, landingPage, referrer, jakeBuildId, tireSize, wheelSize, liftLevel, buildProfile, effectiveContext, onSuccess, onClose]);
  
  if (!isOpen) return null;
  
  // ============================================================================
  // Dynamic Personalized Messaging
  // ============================================================================
  
  const vehicleShortName = getVehicleShortName(vehicle);
  const vehicleMakeModel = getVehicleMakeModel(vehicle);
  
  // Context-aware terminology
  const termMap: Record<ModalContext, { thing: string; action: string }> = {
    garage: { thing: "Build", action: "build recommendations" },
    package: { thing: "Setup", action: "wheel and tire package" },
    cart: { thing: "Cart", action: "cart" },
  };
  const { thing, action } = termMap[effectiveContext];
  
  // Generate personalized headline
  // "Save Your 2021 Silverado Build" or "Save Your F-150 Setup" or "Save Your Cart"
  let displayHeadline = headline;
  if (!displayHeadline) {
    if (vehicleShortName) {
      displayHeadline = `Save Your ${vehicleShortName} ${thing}`;
    } else if (vehicleMakeModel) {
      displayHeadline = `Save Your ${vehicleMakeModel} ${thing}`;
    } else {
      displayHeadline = `Save Your ${thing}`;
    }
  }
  
  // Generate personalized subtext
  const displaySubtext = subtext || (
    `Enter your email and we'll save your vehicle, ${action}, and checkout link so you can come back anytime.`
  );
  
  const displayCtaText = ctaText || "Save & Continue";
  const displaySkipText = skipText || "Skip For Now";
  
  // Vehicle display for badge
  const vehicleDisplay = vehicle?.year && vehicle?.make && vehicle?.model
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`
    : null;
  
  // Icon based on context
  const ContextIcon = effectiveContext === "garage" ? Wrench : 
                      effectiveContext === "package" ? Package : 
                      ShoppingCart;
  
  // Value label based on context
  const valueLabel = effectiveContext === "garage" ? "Build Value" :
                     effectiveContext === "package" ? "Package Value" :
                     "Cart Value";
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && handleSkip()}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Content */}
        <div className="p-6 sm:p-8">
          {success ? (
            // Success state
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Saved!</h2>
              <p className="text-gray-600">
                Check your email for your saved {thing.toLowerCase()} link.
              </p>
            </div>
          ) : (
            <>
              {/* Icon */}
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <ContextIcon className="w-7 h-7 text-blue-600" />
              </div>
              
              {/* Headline */}
              <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
                {displayHeadline}
              </h2>
              
              {/* Subtext */}
              <p className="text-center text-gray-600 mb-4">
                {displaySubtext}
              </p>
              
              {/* Build/Cart Value Display */}
              {cartValue && cartValue > 0 && (
                <div className="mb-4 py-3 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{valueLabel}</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(cartValue)}</span>
                  </div>
                </div>
              )}
              
              {/* Benefits */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Save your vehicle specs</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Save your {effectiveContext === "garage" ? "build recommendations" : "wheel & tire selections"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Access from any device</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Get your checkout link by email</span>
                </div>
              </div>
              
              {/* Vehicle badge (if we have it and headline isn't already personalized) */}
              {vehicleDisplay && !vehicleShortName && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <Car className="w-4 h-4" />
                  <span>{vehicleDisplay}</span>
                </div>
              )}
              
              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email input */}
                <div>
                  <label htmlFor="save-cart-email" className="sr-only">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="save-cart-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>
                
                {/* Error message */}
                {error && (
                  <p className="text-sm text-red-600 text-center">{error}</p>
                )}
                
                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    displayCtaText
                  )}
                </button>
                
                {/* Skip button */}
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  {displaySkipText}
                </button>
              </form>
              
              {/* Privacy note */}
              <p className="mt-4 text-xs text-center text-gray-400">
                We respect your privacy. Your email is only used to save your {thing.toLowerCase()} and send recovery reminders.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SaveCartModal;
