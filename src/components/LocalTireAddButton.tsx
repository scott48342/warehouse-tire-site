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

      {/* Out-the-door total */}
      <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs font-bold text-green-800">Out the Door</div>
            <div className="text-[10px] text-green-600">Install + tax + fees</div>
          </div>
          <div className="text-xl font-bold text-green-800">${outTheDoorTotal.toFixed(2)}</div>
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
