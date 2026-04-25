/**
 * Discount Banner
 * 
 * Shows active discount in cart and checkout.
 * 
 * @created 2026-04-25
 */

"use client";

import { useState } from "react";
import { useDiscount } from "@/lib/discounts/DiscountContext";

interface DiscountBannerProps {
  /** Subtotal to calculate discount amount */
  subtotal: number;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function DiscountBanner({ subtotal, compact = false }: DiscountBannerProps) {
  const { activeDiscount, calculateDiscount, removeDiscount } = useDiscount();
  
  if (!activeDiscount) return null;
  
  const discountAmount = calculateDiscount(subtotal);
  const hoursLeft = Math.max(0, Math.round((activeDiscount.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));
  
  if (compact) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-green-600 text-lg">🎉</span>
          <div>
            <p className="text-sm font-medium text-green-800">
              {activeDiscount.discountPercent}% First Order Savings Applied
            </p>
            <p className="text-xs text-green-600">
              Code: {activeDiscount.code}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-700">
            -${discountAmount.toFixed(2)}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">🎉</span>
          </div>
          <div>
            <p className="font-semibold text-green-800">
              Your {activeDiscount.discountPercent}% First Order Savings Has Been Applied!
            </p>
            <p className="text-sm text-green-600 mt-0.5">
              Code: <span className="font-mono font-medium">{activeDiscount.code}</span>
              {hoursLeft > 0 && (
                <span className="ml-2 text-green-500">• Expires in {hoursLeft}h</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-700">
            -${discountAmount.toFixed(2)}
          </p>
          <button
            onClick={removeDiscount}
            className="text-xs text-green-600 hover:text-green-800 underline mt-1"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Discount Row for order summary
 */
export function DiscountRow({ subtotal }: { subtotal: number }) {
  const { activeDiscount, calculateDiscount } = useDiscount();
  
  if (!activeDiscount) return null;
  
  const discountAmount = calculateDiscount(subtotal);
  
  return (
    <div className="flex justify-between items-center text-green-600">
      <span className="flex items-center gap-1">
        <span>🎉</span>
        <span>First Order Discount ({activeDiscount.discountPercent}%)</span>
      </span>
      <span className="font-medium">-${discountAmount.toFixed(2)}</span>
    </div>
  );
}

/**
 * Discount Code Input for manual entry
 */
export function DiscountCodeInput() {
  const { activeDiscount, applyDiscount, removeDiscount, isValidating } = useDiscount();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  if (activeDiscount) {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-green-600">✓</span>
          <span className="font-mono text-sm font-medium text-green-800">
            {activeDiscount.code}
          </span>
        </div>
        <button
          onClick={removeDiscount}
          className="text-xs text-green-600 hover:text-green-800"
        >
          Remove
        </button>
      </div>
    );
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!code.trim()) return;
    
    const result = await applyDiscount(code.trim());
    
    if (!result.success) {
      setError(result.error || "Invalid code");
    } else {
      setCode("");
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Discount code"
        className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        disabled={isValidating}
      />
      <button
        type="submit"
        disabled={isValidating || !code.trim()}
        className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isValidating ? "..." : "Apply"}
      </button>
      {error && (
        <p className="absolute mt-12 text-xs text-red-500">{error}</p>
      )}
    </form>
  );
}

export default DiscountBanner;
