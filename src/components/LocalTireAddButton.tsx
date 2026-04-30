"use client";

import { useState } from "react";
import { useCart, type CartTireItem } from "@/lib/cart/CartContext";
import { getOutTheDoorTotal, getOutTheDoorBreakdown } from "@/lib/localPricing";

type LocalTireAddButtonProps = {
  sku: string;
  brand: string;
  model: string;
  size: string;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  unitPrice: number;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  source?: string;
};

const QTY_OPTIONS = [1, 2, 3, 4] as const;

export function LocalTireAddButton({
  sku,
  brand,
  model,
  size,
  loadIndex,
  speedRating,
  imageUrl,
  unitPrice,
  vehicle,
  source,
}: LocalTireAddButtonProps) {
  const { addItem, hasWheels } = useCart();
  const [quantity, setQuantity] = useState<number>(4);
  const [isAdding, setIsAdding] = useState(false);

  const isPackageFlow = hasWheels();

  const handleAdd = () => {
    setIsAdding(true);
    setTimeout(() => {
      addItem({
        type: "tire",
        sku,
        brand,
        model,
        size,
        loadIndex,
        speedRating,
        imageUrl,
        unitPrice,
        quantity,
        vehicle,
        source,
      });
      setIsAdding(false);
    }, 150);
  };

  // Calculate out-the-door total for selected quantity
  const outTheDoorTotal = getOutTheDoorTotal(unitPrice, quantity);
  const breakdown = getOutTheDoorBreakdown(unitPrice, quantity);

  const buttonStyles = isPackageFlow
    ? "flex-1 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-800 hover:bg-green-100 transition-colors disabled:opacity-60"
    : "flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-60";

  return (
    <div className="space-y-3 pt-3 border-t border-neutral-100">
      {/* Per-tire price */}
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-extrabold text-neutral-900">${unitPrice.toFixed(2)}</span>
          <span className="text-sm text-neutral-500 ml-1">/ea</span>
        </div>
        {/* Quantity Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">Qty:</span>
          <div className="flex gap-1">
            {QTY_OPTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setQuantity(q)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                  quantity === q
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Out-the-door price breakdown - constrained to card width */}
      <div className="w-full max-w-full box-border bg-green-50 border border-green-200 rounded-lg p-3 overflow-hidden">
        <div className="w-full space-y-1 text-[11px]">
          {/* Each row: flex with gap, label truncates, value stays visible */}
          <div className="flex justify-between items-baseline gap-2 min-w-0 text-neutral-600">
            <span className="truncate min-w-0">Tires ({quantity}×${unitPrice.toFixed(0)})</span>
            <span className="whitespace-nowrap flex-shrink-0 text-right">${breakdown.tiresTotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 min-w-0 text-neutral-600">
            <span className="truncate min-w-0">Install</span>
            <span className="whitespace-nowrap flex-shrink-0 text-right">${breakdown.installTotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 min-w-0 text-neutral-600">
            <span className="truncate min-w-0">Tax</span>
            <span className="whitespace-nowrap flex-shrink-0 text-right">${breakdown.taxTotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between items-baseline gap-2 min-w-0 text-neutral-600">
            <span className="truncate min-w-0">Fees</span>
            <span className="whitespace-nowrap flex-shrink-0 text-right">${breakdown.recyclingTotal.toFixed(0)}</span>
          </div>
        </div>
        {/* Total row */}
        <div className="flex justify-between items-center gap-2 min-w-0 font-bold text-green-800 border-t border-green-300 pt-2 mt-2">
          <span className="text-xs whitespace-nowrap">Out the Door</span>
          <span className="text-base whitespace-nowrap flex-shrink-0">${outTheDoorTotal.toFixed(0)}</span>
        </div>
      </div>

      {/* Add to Cart Button */}
      <button
        onClick={handleAdd}
        disabled={isAdding}
        className={buttonStyles + " w-full"}
      >
        {isAdding ? (
          <span className="flex items-center justify-center gap-1.5">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Adding...
          </span>
        ) : isPackageFlow ? (
          <span>✓ Add {quantity} to Package</span>
        ) : (
          <span>Add {quantity} — ${outTheDoorTotal.toFixed(0)} total</span>
        )}
      </button>
    </div>
  );
}
