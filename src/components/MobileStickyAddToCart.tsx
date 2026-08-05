"use client";

/**
 * MobileStickyAddToCart - Fixed mobile sticky CTA that actually adds to cart
 * 
 * Replaces the broken anchor link with a real add-to-cart button.
 * Shows on mobile only (hidden on md and up).
 */

import { useState } from "react";
import { useCart, type CartTireItem, type CartWheelItem } from "@/lib/cart/CartContext";
import { useShopContext } from "@/contexts/ShopContextProvider";
import { getOutTheDoorTotal } from "@/lib/localPricing";

interface TireProps {
  type: "tire";
  sku: string;
  brand: string;
  model: string;
  size: string;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity?: number;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  source?: string;
}

interface WheelProps {
  type: "wheel";
  sku: string;
  brand: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  offset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  quantity?: number;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
}

type MobileStickyAddToCartProps = TireProps | WheelProps;

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

export function MobileStickyAddToCart(props: MobileStickyAddToCartProps) {
  const { addItem } = useCart();
  const { isLocal } = useShopContext();
  const [isAdding, setIsAdding] = useState(false);
  
  const quantity = props.quantity || (props.type === "tire" ? 4 : 4);
  const hasPrice = props.unitPrice != null && props.unitPrice > 0;
  
  const handleAddToCart = () => {
    if (!hasPrice || isAdding) return;
    
    setIsAdding(true);
    
    if (props.type === "tire") {
      const item: CartTireItem = {
        type: "tire",
        sku: props.sku,
        brand: props.brand,
        model: props.model,
        size: props.size,
        loadIndex: props.loadIndex,
        speedRating: props.speedRating,
        imageUrl: props.imageUrl,
        unitPrice: props.unitPrice,
        quantity,
        vehicle: props.vehicle,
        source: props.source,
      };
      setTimeout(() => {
        addItem(item);
        setIsAdding(false);
      }, 150);
    } else {
      const item: CartWheelItem = {
        type: "wheel",
        sku: props.sku,
        brand: props.brand,
        model: props.model,
        finish: props.finish,
        diameter: props.diameter,
        width: props.width,
        offset: props.offset,
        boltPattern: props.boltPattern,
        imageUrl: props.imageUrl,
        unitPrice: props.unitPrice,
        quantity,
        vehicle: props.vehicle,
      };
      setTimeout(() => {
        addItem(item);
        setIsAdding(false);
      }, 150);
    }
  };
  
  if (!hasPrice) return null;
  
  // Local tire orders include install/tax/fees — show out-the-door so the cart total
  // matches what's on screen and there's no sticker shock.
  const isLocalTire = isLocal && props.type === "tire";
  const total = isLocalTire ? getOutTheDoorTotal(props.unitPrice, quantity, props.type === "tire" ? props.size : undefined) : props.unitPrice * quantity;
  const label = props.type === "tire" ? "per tire" : "per wheel";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white p-3 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-neutral-900">
            {fmtMoney(props.unitPrice)}
          </div>
          <div className="text-[11px] text-neutral-500">{label}</div>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={isAdding}
          className="flex-1 max-w-[200px] h-11 rounded-xl bg-[var(--brand-red)] px-4 flex items-center justify-center text-sm font-extrabold text-white active:scale-[0.98] transition-all disabled:opacity-70"
        >
          {isAdding ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding...
            </span>
          ) : (
            <>Add {quantity} — {fmtMoney(total)}{isLocalTire ? " OTD" : ""}</>
          )}
        </button>
      </div>
    </div>
  );
}
