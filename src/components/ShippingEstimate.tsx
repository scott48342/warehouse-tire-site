"use client";

import { useState, useEffect, useCallback } from "react";
import {
  calculateShipping,
  isValidZipCode,
  normalizeZipCode,
  formatCurrency,
  FREE_SHIPPING_THRESHOLD,
  FREE_SHIPPING_MESSAGE,
  PACKAGE_SHIPPING_MESSAGE,
  type ShippingItem,
  type ShippingEstimate as ShippingEstimateType,
} from "@/lib/shipping/shippingService";

const ZIP_STORAGE_KEY = "wt_shipping_zip";

// ============================================================================
// ZIP Storage
// ============================================================================

export function getStoredZipCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ZIP_STORAGE_KEY) || "";
}

export function setStoredZipCode(zip: string): void {
  if (typeof window === "undefined") return;
  if (zip) {
    localStorage.setItem(ZIP_STORAGE_KEY, normalizeZipCode(zip));
  } else {
    localStorage.removeItem(ZIP_STORAGE_KEY);
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to manage shipping ZIP and calculation
 */
export function useShippingEstimate(items: ShippingItem[], subtotal: number) {
  const [zipCode, setZipCodeState] = useState("");
  const [estimate, setEstimate] = useState<ShippingEstimateType | null>(null);

  // Load stored ZIP on mount
  useEffect(() => {
    const stored = getStoredZipCode();
    if (stored) {
      setZipCodeState(stored);
    }
  }, []);

  // Recalculate when ZIP or items change
  useEffect(() => {
    const result = calculateShipping({ zipCode, items, subtotal });
    setEstimate(result);
  }, [zipCode, items, subtotal]);

  const setZipCode = useCallback((zip: string) => {
    const normalized = normalizeZipCode(zip);
    setZipCodeState(normalized);
    setStoredZipCode(normalized);
  }, []);

  const clearZipCode = useCallback(() => {
    setZipCodeState("");
    setStoredZipCode("");
  }, []);

  return {
    zipCode,
    setZipCode,
    clearZipCode,
    estimate,
    isValidZip: zipCode ? isValidZipCode(zipCode) : false,
  };
}

// ============================================================================
// Components
// ============================================================================

interface ZipCodeInputProps {
  value: string;
  onChange: (zip: string) => void;
  onClear?: () => void;
  compact?: boolean;
  className?: string;
}

/**
 * ZIP code input field
 */
export function ZipCodeInput({
  value,
  onChange,
  onClear,
  compact = false,
  className = "",
}: ZipCodeInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 5);
    setLocalValue(raw);
    
    // Auto-submit when 5 digits entered
    if (raw.length === 5) {
      onChange(raw);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue.length === 5) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && localValue.length === 5) {
      onChange(localValue);
      (e.target as HTMLInputElement).blur();
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          type="text"
          inputMode="numeric"
          placeholder="ZIP"
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-16 h-8 px-2 text-sm text-center border border-neutral-300 rounded-lg focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
        />
        {value && onClear && (
          <button
            onClick={onClear}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label="Clear ZIP"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="Enter ZIP code"
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-10 px-3 pr-10 text-sm border border-neutral-300 rounded-lg focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          aria-label="Clear ZIP"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface ShippingEstimateBadgeProps {
  estimate: ShippingEstimateType | null;
  subtotal: number;
  showDelivery?: boolean;
  className?: string;
}

/**
 * Shipping estimate display badge
 */
export function ShippingEstimateBadge({
  estimate,
  subtotal,
  showDelivery = false,
  className = "",
}: ShippingEstimateBadgeProps) {
  if (!estimate) return null;

  // Free shipping
  if (estimate.isFree) {
    return (
      <div className={`flex items-center gap-1.5 text-green-700 ${className}`}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-semibold">Free Shipping</span>
      </div>
    );
  }

  // Need ZIP
  if (estimate.zone === 0) {
    return (
      <div className={`text-neutral-500 text-sm ${className}`}>
        <span>Enter ZIP for shipping estimate</span>
      </div>
    );
  }

  // Has estimate
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-neutral-600">Shipping:</span>
        <span className="font-semibold text-neutral-900">{estimate.displayAmount}</span>
        {estimate.isEstimate && (
          <span className="text-xs text-neutral-400">(est.)</span>
        )}
      </div>
      {showDelivery && (
        <div className="text-xs text-neutral-500">
          {estimate.estimatedDays.min}–{estimate.estimatedDays.max} business days
        </div>
      )}
    </div>
  );
}

interface FreeShippingProgressProps {
  subtotal: number;
  compact?: boolean;
  className?: string;
}

/**
 * Progress bar toward free shipping
 */
export function FreeShippingProgress({ subtotal, compact = false, className = "" }: FreeShippingProgressProps) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // Already qualified for free shipping
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    if (compact) {
      return (
        <div className={`flex items-center gap-1.5 text-green-700 ${className}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-semibold">Free shipping unlocked!</span>
        </div>
      );
    }
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center gap-2 text-green-700">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <span className="font-semibold">Free shipping unlocked!</span>
            <span className="text-green-600 text-sm ml-1">Your order qualifies.</span>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant for tight spaces
  if (compact) {
    return (
      <div className={`text-sm ${className}`}>
        <div className="flex items-center gap-2 text-amber-700 mb-1">
          <span className="font-medium">{formatCurrency(remaining)} away from FREE shipping</span>
        </div>
        <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // Full progress bar
  return (
    <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚚</span>
          <span className="text-sm text-amber-900">
            You&apos;re <span className="font-bold">{formatCurrency(remaining)}</span> away from FREE shipping!
          </span>
        </div>
      </div>
      <div className="h-2.5 bg-amber-200/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-amber-600">
        <span>{formatCurrency(subtotal)}</span>
        <span>{formatCurrency(FREE_SHIPPING_THRESHOLD)}</span>
      </div>
    </div>
  );
}

/**
 * Inline free shipping badge for product pages
 */
export function FreeShippingBadge({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-sm text-neutral-600 ${className}`}>
      <span className="text-green-600">🚚</span>
      <span>{FREE_SHIPPING_MESSAGE}</span>
    </div>
  );
}

/**
 * Package shipping message
 */
export function PackageShippingNote({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-sm text-green-700 ${className}`}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{PACKAGE_SHIPPING_MESSAGE}</span>
    </div>
  );
}

interface ShippingEstimatorProps {
  items: ShippingItem[];
  subtotal: number;
  variant?: "inline" | "card" | "minimal";
  className?: string;
}

/**
 * Complete shipping estimator with ZIP input
 */
export function ShippingEstimator({
  items,
  subtotal,
  variant = "card",
  className = "",
}: ShippingEstimatorProps) {
  const { zipCode, setZipCode, clearZipCode, estimate, isValidZip } = useShippingEstimate(items, subtotal);

  // Free shipping - no ZIP needed
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return (
      <div className={className}>
        <FreeShippingProgress subtotal={subtotal} />
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <ZipCodeInput
          value={zipCode}
          onChange={setZipCode}
          onClear={clearZipCode}
          compact
        />
        {isValidZip && estimate && (
          <ShippingEstimateBadge estimate={estimate} subtotal={subtotal} />
        )}
        {!isValidZip && (
          <span className="text-sm text-neutral-500">Enter ZIP for shipping</span>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-600">Shipping to:</span>
          <ZipCodeInput
            value={zipCode}
            onChange={setZipCode}
            onClear={clearZipCode}
            compact
          />
          {isValidZip && estimate && !estimate.isFree && (
            <span className="font-semibold">{estimate.displayAmount}</span>
          )}
        </div>
        <FreeShippingProgress subtotal={subtotal} />
      </div>
    );
  }

  // Card variant (default)
  return (
    <div className={`bg-white border border-neutral-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-neutral-900">Shipping Estimate</h3>
        {isValidZip && estimate && (
          <span className="text-xs text-neutral-500">
            {estimate.estimatedDays.min}–{estimate.estimatedDays.max} days
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ZipCodeInput
              value={zipCode}
              onChange={setZipCode}
              onClear={clearZipCode}
            />
          </div>
          {isValidZip && estimate && (
            <div className="text-right">
              <div className="text-lg font-bold text-neutral-900">
                {estimate.displayAmount}
              </div>
              {estimate.isEstimate && (
                <div className="text-xs text-neutral-400">estimated</div>
              )}
            </div>
          )}
        </div>

        <FreeShippingProgress subtotal={subtotal} />

        <p className="text-xs text-neutral-500">
          Free shipping on orders over {formatCurrency(FREE_SHIPPING_THRESHOLD)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ShippingEstimator;
