"use client";

import { useState } from "react";
import { QuantitySelector } from "./QuantitySelector";
import { AddToCartButton } from "./AddToCartButton";
import { FinancingBadge } from "./FinancingBadge";
import { WheelTrustStrip } from "./WheelPDPEnhancements";
import type { DBProfileForAccessories } from "@/hooks/useAccessoryFitment";

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
}: WheelBuyBoxProps) {
  const [quantity, setQuantity] = useState(4);
  const total = unitPrice * quantity;
  const hasPrice = typeof unitPrice === "number" && Number.isFinite(unitPrice) && unitPrice > 0;

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

      <div className="mt-3 flex items-center gap-2 text-sm text-green-700 font-semibold">
        <span className="text-base">🚀</span>
        <span>In stock · Ships fast</span>
      </div>

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
      </div>
      
      {/* Trust strip */}
      <WheelTrustStrip hasVehicle={hasVehicle} />
    </div>
  );
}
