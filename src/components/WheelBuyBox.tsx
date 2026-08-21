"use client";

import { useState } from "react";
import { QuantitySelector } from "./QuantitySelector";
import { AddToCartButton } from "./AddToCartButton";
import { FinancingBadge } from "./FinancingBadge";
import { WheelTrustStrip } from "./WheelPDPEnhancements";
import type { DBProfileForAccessories } from "@/hooks/useAccessoryFitment";

type InventoryStatus = {
  inStock: boolean;
  totalQty: number;
  inventoryType: string;
};

type WheelBuyBoxProps = {
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
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  hasVehicle: boolean;
  dbProfile?: DBProfileForAccessories | null;
  wheelCenterBore?: number;
  inventory?: InventoryStatus | null;
};

export function WheelBuyBox({
  sku,
  brand,
  model,
  finish,
  diameter,
  width,
  offset,
  boltPattern,
  imageUrl,
  unitPrice,
  vehicle,
  hasVehicle,
  dbProfile,
  wheelCenterBore,
  inventory,
}: WheelBuyBoxProps) {
  const [quantity, setQuantity] = useState(4);
  const total = unitPrice * quantity;
  const hasPrice = typeof unitPrice === "number" && Number.isFinite(unitPrice) && unitPrice > 0;
  
  // Inventory check: orderable types that we can sell
  const ORDERABLE_TYPES = new Set(["ST", "BW", "NW", "SO", "CS"]);
  const MIN_QTY = 4;
  const isInStock = inventory 
    ? (ORDERABLE_TYPES.has(inventory.inventoryType) && inventory.totalQty >= MIN_QTY)
    : true; // Default to true if no inventory data (legacy behavior / fallback)

  return (
    <div id="add-to-cart" className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        {hasPrice ? (
          <>
            <div className="text-3xl font-extrabold text-neutral-900">${unitPrice.toFixed(2)}</div>
            <div className="text-sm text-neutral-500">per wheel</div>
          </>
        ) : (
          <div className="text-xl font-bold text-neutral-700">Call for price</div>
        )}
      </div>
      
      {hasPrice && (
        <div className="mt-1 text-sm text-neutral-600">
          {quantity === 1 ? (
            <span>Single wheel</span>
          ) : (
            <>
              Set of {quantity}: <span className="font-bold text-green-700">${total.toFixed(2)}</span>
            </>
          )}
        </div>
      )}
      
      {/* Financing option - shows when total is $50-$30k */}
      {hasPrice && total >= 50 && (
        <FinancingBadge price={total} className="mt-2" />
      )}

      {isInStock ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 font-semibold">
          <span className="text-base">🚀</span>
          <span>In stock · Ships fast</span>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 font-semibold">
            <span className="text-base">⚠️</span>
            <span>Currently out of stock</span>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            This wheel is temporarily unavailable. Check back soon or browse similar styles.
          </p>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="mt-4">
        <QuantitySelector
          value={quantity}
          onChange={setQuantity}
          presets={[1, 2, 4, 5]}
          label="How many wheels?"
        />
      </div>
      
      <div className="mt-4">
        {isInStock ? (
          <AddToCartButton
            sku={sku}
            brand={brand}
            model={model}
            finish={finish}
            diameter={diameter}
            width={width}
            offset={offset}
            boltPattern={boltPattern}
            imageUrl={imageUrl}
            unitPrice={hasPrice ? unitPrice : 0}
            quantity={quantity}
            vehicle={vehicle}
            className="w-full"
            showPriceInButton={hasPrice}
            dbProfile={dbProfile}
            wheelCenterBore={wheelCenterBore}
          />
        ) : (
          <button
            disabled
            className="w-full rounded-xl bg-neutral-300 py-3 text-sm font-bold text-neutral-500 cursor-not-allowed"
          >
            Out of Stock
          </button>
        )}
      </div>
      
      {/* Trust strip */}
      <WheelTrustStrip hasVehicle={hasVehicle} />
    </div>
  );
}
