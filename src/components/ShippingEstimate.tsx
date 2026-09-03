"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  calculateShipping,
  isValidZipCode,
  normalizeZipCode,
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
  // Track last submitted ZIP to avoid duplicate onChange calls
  const lastSubmittedRef = useRef(value);

  useEffect(() => {
    setLocalValue(value);
    lastSubmittedRef.current = value;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 5);
    setLocalValue(raw);
    
    // Auto-submit when 5 digits entered
    if (raw.length === 5 && raw !== lastSubmittedRef.current) {
      lastSubmittedRef.current = raw;
      onChange(raw);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Only call onChange if this is a NEW value (not already submitted)
    if (localValue.length === 5 && localValue !== lastSubmittedRef.current) {
      lastSubmittedRef.current = localValue;
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

// NOTE (2026-08-31): FreeShippingProgress and FreeShippingBadge were removed
// along with the site-wide $1,500 free-shipping offer. All orders now pay
// calculated shipping.

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

        <p className="text-xs text-neutral-500">
          Shipping calculated by destination and order size. Oversized &amp; LT tires may include a handling surcharge.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ShippingEstimator;
