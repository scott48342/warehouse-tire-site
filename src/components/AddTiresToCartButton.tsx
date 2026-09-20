"use client";

import { useState } from "react";
import { useCart, type CartTireItem } from "@/lib/cart/CartContext";
import { useShopContext } from "@/contexts/ShopContextProvider";
import { getOutTheDoorTotal } from "@/lib/localPricing";

type AddTiresToCartButtonProps = {
  sku: string;
  rearSku?: string;
  /** Staggered set: per-tire front / rear prices (2 + 2). Checkout re-prices server-side. */
  frontUnitPrice?: number;
  rearUnitPrice?: number;
  brand: string;
  model: string;
  size: string;
  rearSize?: string;
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
  staggered?: boolean;
  quantity?: number;
  className?: string;
  variant?: "primary" | "secondary" | "compact";
  showPriceInButton?: boolean;
  /** Supplier source (e.g., "tireweb:atd", "km") - for internal tracking */
  source?: string;
  /** Tire weight in pounds - for accurate shipping calculation */
  weightLbs?: number;
};

export function AddTiresToCartButton({
  sku,
  rearSku,
  frontUnitPrice,
  rearUnitPrice,
  brand,
  model,
  size,
  rearSize,
  loadIndex,
  speedRating,
  imageUrl,
  unitPrice,
  vehicle,
  staggered,
  quantity = 4,
  className = "",
  variant = "primary",
  showPriceInButton = true,
  source,
  weightLbs,
}: AddTiresToCartButtonProps) {
  const { addItem } = useCart();
  const { isLocal } = useShopContext();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);

    const item: CartTireItem = {
      type: "tire",
      sku,
      rearSku,
      brand,
      model,
      size,
      rearSize,
      frontUnitPrice: staggered && rearSku ? frontUnitPrice : undefined,
      rearUnitPrice: staggered && rearSku ? rearUnitPrice : undefined,
      loadIndex,
      speedRating,
      imageUrl,
      unitPrice,
      quantity,
      vehicle,
      staggered,
      source,
      weightLbs,
    };

    setTimeout(() => {
      addItem(item);
      setIsAdding(false);
    }, 150);
  };

  // Staggered set: exact 2 x front + 2 x rear (2026-09-20), never 4 x the blended unit.
  const isStaggeredSet = Boolean(staggered && rearSku && frontUnitPrice != null && rearUnitPrice != null);
  const setTotal = isStaggeredSet ? Math.round((2 * (frontUnitPrice as number) + 2 * (rearUnitPrice as number)) * 100) / 100 : unitPrice * quantity;
  // In local mode the button reflects the out-the-door total (install + tax + fees) so the price
  // doesn't jump when the item lands in the cart. Staggered: each axle priced with ITS OWN size
  // (install tiers differ by size), 2 + 2 - never the front size x4. Server totals remain authority.
  const total = isLocal
    ? (isStaggeredSet
        ? Math.round((getOutTheDoorTotal(frontUnitPrice as number, 2, size) + getOutTheDoorTotal(rearUnitPrice as number, 2, rearSize)) * 100) / 100
        : getOutTheDoorTotal(unitPrice, quantity, size))
    : setTotal;
  const otdSuffix = isLocal ? " out the door" : "";
  const setLabel = isStaggeredSet ? "Add Staggered Set (2 front + 2 rear)" : `Add Set of ${quantity}`;

  const baseStyles = {
    primary: "flex h-12 items-center justify-center rounded-2xl px-5 text-sm font-extrabold bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-500 hover:to-red-700 hover:brightness-105 active:scale-[0.98] transition-all duration-250 ease-out shadow-md shadow-red-600/20 hover:shadow-lg hover:shadow-red-600/30 hover:scale-[1.015]",
    secondary: "flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 hover:border-neutral-300 transition-all duration-200",
    compact: "flex h-9 items-center justify-center rounded-lg px-3 text-xs font-bold border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-all duration-200",
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={isAdding}
      className={`${baseStyles[variant]} ${className} ${isAdding ? "opacity-70" : ""}`}
    >
      {isAdding ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Adding...
        </span>
      ) : variant === "compact" ? (
        <span>
          + Add Set of {quantity}
          {showPriceInButton && Number.isFinite(total) && total > 0 ? (
            <span className="ml-1 text-neutral-500">${total.toFixed(0)}</span>
          ) : null}
        </span>
      ) : (
        <span>
          {showPriceInButton && Number.isFinite(total) && total > 0 
            ? `${setLabel} — $${total.toFixed(2)}${otdSuffix}`
            : `${setLabel} to Cart`
          }
        </span>
      )}
    </button>
  );
}

const QTY_OPTIONS = [1, 2, 3, 4] as const;

// Simplified quick-add for tire cards with inline quantity selector
export function QuickAddTireButton({
  sku,
  brand,
  model,
  size,
  loadIndex,
  speedRating,
  imageUrl,
  unitPrice,
  vehicle,
  quantity: defaultQuantity = 4,
  source,
}: {
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
  quantity?: number;
  /** Supplier source for internal tracking */
  source?: string;
}) {
  const { addItem, hasWheels } = useCart();
  const { isLocal } = useShopContext();
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState<number>(defaultQuantity);
  
  // Check if this is a package flow (user has wheels in cart)
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

  // For local mode, show out-the-door price (includes install, tax, recycling)
  const total = isLocal ? getOutTheDoorTotal(unitPrice, quantity, size) : unitPrice * quantity;

  // Use wheel card style: red gradient CTA with price inline (matches WheelsStyleCard)
  const buttonStyles = isPackageFlow
    ? "flex h-13 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-250 bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 active:scale-[0.99] shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-60"
    : "flex h-13 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-250 bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 active:scale-[0.99] shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/25 disabled:opacity-60";

  return (
    <div className="space-y-2">
      {/* Quantity Selector Row — compact to fit 88px CTA panel */}
      <div className="flex items-center justify-center gap-1">
        {QTY_OPTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuantity(q)}
            className={`w-6 h-6 rounded-md text-xs font-bold transition-all flex-shrink-0 ${
              quantity === q
                ? "bg-red-600 text-white shadow-sm"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            }`}
            title={`Qty: ${q}`}
          >
            {q}
          </button>
        ))}
      </div>
      
      {/* Add to Cart Button - Wheel card style CTA */}
      <button
        onClick={handleAdd}
        disabled={isAdding}
        className={buttonStyles}
      >
        {isAdding ? (
          <>
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Adding...
          </>
        ) : isPackageFlow ? (
          <>
            ✓ Add {quantity} to Package
            {Number.isFinite(total) && total > 0 && (
              <span className="opacity-90 font-bold">
                • ${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </>
        ) : (
          <>
            Add Set of {quantity}
            {Number.isFinite(total) && total > 0 && (
              <span className="opacity-90 font-bold">
                – ${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
