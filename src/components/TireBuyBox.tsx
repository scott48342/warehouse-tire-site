"use client";

import { useState } from "react";
import { QuantitySelector } from "./QuantitySelector";
import { AddTiresToCartButton } from "./AddTiresToCartButton";
import { FinancingBadge } from "./FinancingBadge";
import { EnhancedTrustStrip } from "./TirePDPEnhancements";
import { InstallTimeIndicator } from "./InstallTimeIndicator";
import { useShopContext } from "@/contexts/ShopContextProvider";
import { getOutTheDoorBreakdown } from "@/lib/localPricing";

type TireBuyBoxProps = {
  sku: string;
  brand: string;
  model: string;
  size: string;
  loadIndex?: string;
  speedRating?: string;
  imageUrl?: string;
  unitPrice: number | null;
  vehicle?: {
    year: string;
    make: string;
    model: string;
    trim?: string;
    modification?: string;
  };
  hasVehicle?: boolean;
  hasWarranty?: boolean;
  source?: string;
  delivery: {
    text: string;
    color: string;
    icon: string;
    urgency: string | null;
  };
};

function fmtMoney(v: number) {
  return `$${v.toFixed(2)}`;
}

export function TireBuyBox({
  sku,
  brand,
  model,
  size,
  loadIndex,
  speedRating,
  imageUrl,
  unitPrice,
  vehicle,
  hasVehicle = false,
  hasWarranty = true,
  source,
  delivery,
}: TireBuyBoxProps) {
  const [quantity, setQuantity] = useState(4);
  const { isLocal } = useShopContext();
  const hasPrice = unitPrice != null && unitPrice > 0;
  const total = hasPrice ? unitPrice * quantity : 0;
  // Local mode shows the full out-the-door breakdown so the cart total isn't a surprise
  const otd = hasPrice && isLocal ? getOutTheDoorBreakdown(unitPrice, quantity) : null;

  return (
    <div id="add-to-cart" className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
      {/* Local mode: show dynamic same-day/next-day install indicator */}
      {isLocal && (
        <div className="mb-3">
          <InstallTimeIndicator variant="badge" />
        </div>
      )}
      
      {!isLocal && delivery.urgency && (
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
          <span>⚡</span>
          <span>{delivery.urgency}</span>
        </div>
      )}

      <div className="flex items-baseline gap-2">
        {hasPrice ? (
          <>
            <div className="text-3xl font-extrabold text-neutral-900">{fmtMoney(unitPrice)}</div>
            <div className="text-sm text-neutral-500">per tire</div>
          </>
        ) : (
          <div className="text-xl font-bold text-neutral-700">Call for pricing</div>
        )}
      </div>
      
      {hasPrice && !isLocal && (
        <div className="mt-1 text-sm text-neutral-600">
          {quantity === 1 ? (
            <span>Single tire</span>
          ) : (
            <>
              Set of {quantity}: <span className="font-bold text-green-700">{fmtMoney(total)}</span>
            </>
          )}
        </div>
      )}

      {/* Local mode: out-the-door breakdown (matches desktop, prevents cart sticker shock) */}
      {hasPrice && isLocal && otd && (
        <div className="mt-3 rounded-xl border border-green-200 bg-white/70 p-3 text-sm">
          <div className="flex items-center justify-between text-neutral-600">
            <span>Tires ({quantity}×{fmtMoney(unitPrice)})</span>
            <span className="font-medium text-neutral-800">{fmtMoney(otd.tiresTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-neutral-600">
            <span>Install</span>
            <span className="font-medium text-neutral-800">{fmtMoney(otd.installTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-neutral-600">
            <span>Tax</span>
            <span className="font-medium text-neutral-800">{fmtMoney(otd.taxTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-neutral-600">
            <span>Disposal</span>
            <span className="font-medium text-neutral-800">{fmtMoney(otd.recyclingTotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-green-200 pt-2 text-base font-extrabold text-green-800">
            <span>Out the Door</span>
            <span>{fmtMoney(otd.outTheDoorTotal)}</span>
          </div>
        </div>
      )}
      
      {/* Financing option - shows when total is $50-$30k */}
      {hasPrice && (isLocal && otd ? otd.outTheDoorTotal : total) >= 50 && (
        <FinancingBadge price={isLocal && otd ? otd.outTheDoorTotal : total} className="mt-2" />
      )}

      <div className={`mt-3 flex items-center gap-2 text-sm ${delivery.color}`}>
        <span className="text-base">{delivery.icon}</span>
        <span>{delivery.text}</span>
      </div>

      {/* Quantity Selector - only show when we have a price */}
      {hasPrice && (
        <div className="mt-4">
          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            presets={[1, 2, 4, 5]}
            label="How many tires?"
          />
        </div>
      )}
      
      {hasPrice && (
        <div className="mt-4">
          <AddTiresToCartButton
            sku={sku}
            brand={brand}
            model={model}
            size={size}
            loadIndex={loadIndex}
            speedRating={speedRating}
            imageUrl={imageUrl}
            unitPrice={unitPrice}
            quantity={quantity}
            vehicle={vehicle}
            source={source}
            variant="primary"
            className="w-full"
          />
        </div>
      )}
      
      {/* Compact trust line */}
      <EnhancedTrustStrip hasVehicle={hasVehicle} hasWarranty={hasWarranty} />
    </div>
  );
}
