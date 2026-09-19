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
  /** Supplier source (e.g., "wheel1") — passed through to the cart item */
  source?: string;
  /** True when freight is baked into the unit price (Wheel-1 landed-cost) */
  freeShipping?: boolean;
  /**
   * Staggered set context (audit H2, 2026-09-18). When present the buy box
   * prices 2 front + 2 rear and adds both SKUs. If the rear price is unknown
   * we do NOT invent a set total from 4x the front price.
   */
  staggered?: {
    rearSku?: string;
    rearUnitPrice: number | null;
    rearDiameter?: string;
    rearWidth?: string;
    rearOffset?: string;
    rearFinish?: string;
    rearResolved: boolean;
  };
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
  source,
  freeShipping,
  staggered,
}: WheelBuyBoxProps) {
  const [rawQuantity, setQuantity] = useState(4);
  const isStaggered = Boolean(staggered);
  // A staggered set is always 2 front + 2 rear.
  const quantity = isStaggered ? 4 : rawQuantity;
  const hasFrontPrice = typeof unitPrice === "number" && Number.isFinite(unitPrice) && unitPrice > 0;
  const rearPrice = staggered?.rearUnitPrice;
  const hasRearPrice = typeof rearPrice === "number" && Number.isFinite(rearPrice) && rearPrice > 0;
  // Staggered: both prices required for any total. Square: front price only.
  const hasPrice = isStaggered ? hasFrontPrice && hasRearPrice : hasFrontPrice;
  const total = isStaggered
    ? (hasPrice ? unitPrice * 2 + (rearPrice as number) * 2 : 0)
    : unitPrice * quantity;
  // Cart stores one unitPrice x quantity per line; for a 2+2 set the blended
  // per-wheel price keeps the line total equal to the real set price.
  const cartUnitPrice = isStaggered && hasPrice ? total / 4 : unitPrice;
  const rearMissing = isStaggered && (!staggered?.rearSku || !staggered?.rearResolved);
  
  // Inventory check: orderable types that we can sell
  const ORDERABLE_TYPES = new Set(["ST", "BW", "NW", "SO", "CS"]);
  const MIN_QTY = 4;
  const isInStock = inventory 
    ? (ORDERABLE_TYPES.has(inventory.inventoryType) && inventory.totalQty >= MIN_QTY)
    : true; // Default to true if no inventory data (legacy behavior / fallback)

  return (
    <div id="add-to-cart" className="rounded-2xl border border-green-300 bg-gradient-to-br from-green-50/80 to-emerald-50/60 p-4 shadow-sm">
      <div className="flex items-baseline gap-2">
        {isStaggered ? (
          hasPrice ? (
            <>
              <div className="text-3xl font-extrabold text-neutral-900">${total.toFixed(2)}</div>
              <div className="text-sm text-neutral-500">staggered set (2 front + 2 rear)</div>
            </>
          ) : (
            <div className="text-xl font-bold text-neutral-700">Call for staggered set price</div>
          )
        ) : hasPrice ? (
          <>
            <div className="text-3xl font-extrabold text-neutral-900">${unitPrice.toFixed(2)}</div>
            <div className="text-sm text-neutral-500">per wheel</div>
          </>
        ) : (
          <div className="text-xl font-bold text-neutral-700">Call for price</div>
        )}
      </div>

      {isStaggered && hasPrice && (
        <div className="mt-1 text-sm text-neutral-600">
          2 front @ <span className="font-semibold">${unitPrice.toFixed(2)}</span>
          {" + "}2 rear @ <span className="font-semibold">${(rearPrice as number).toFixed(2)}</span>
          {staggered?.rearDiameter && staggered?.rearWidth && (
            <span className="text-neutral-500"> ({staggered.rearDiameter}&quot; x {staggered.rearWidth}&quot; rear)</span>
          )}
        </div>
      )}

      {isStaggered && !hasPrice && hasFrontPrice && (
        <div className="mt-1 text-sm text-neutral-600">
          Front wheels ${unitPrice.toFixed(2)} each. Rear pricing unavailable online, so we won&apos;t quote a set total here.
        </div>
      )}

      {!isStaggered && hasPrice && (
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

      {freeShipping && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
          <span>🚚</span>
          <span>Free Shipping — included in price</span>
        </div>
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

      {/* Quantity Selector - a staggered set is fixed at 2 + 2 */}
      {isStaggered ? (
        <div className="mt-4 text-sm text-neutral-700">
          <span className="font-semibold">Quantity:</span> 2 front + 2 rear (staggered set)
        </div>
      ) : (
        <div className="mt-4">
          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            presets={[1, 2, 4, 5]}
            label="How many wheels?"
          />
        </div>
      )}
      
      <div className="mt-4">
        {isStaggered && (rearMissing || !hasPrice) ? (
          <button
            disabled
            className="w-full rounded-xl bg-neutral-300 py-3 text-sm font-bold text-neutral-500 cursor-not-allowed"
            title={rearMissing ? "Rear wheel could not be resolved" : "Rear wheel price unavailable"}
          >
            {rearMissing ? "Rear wheel unavailable - call to order" : "Call to order staggered set"}
          </button>
        ) : isInStock ? (
          <AddToCartButton
            sku={sku}
            rearSku={isStaggered ? staggered?.rearSku : undefined}
            brand={brand}
            model={model}
            finish={finish}
            diameter={diameter}
            width={width}
            rearWidth={isStaggered ? staggered?.rearWidth : undefined}
            offset={offset}
            rearOffset={isStaggered ? staggered?.rearOffset : undefined}
            boltPattern={boltPattern}
            imageUrl={imageUrl}
            unitPrice={hasPrice ? cartUnitPrice : 0}
            quantity={quantity}
            staggered={isStaggered || undefined}
            frontUnitPrice={isStaggered ? unitPrice : undefined}
            rearUnitPrice={isStaggered && hasRearPrice ? (rearPrice as number) : undefined}
            rearFinish={isStaggered ? (staggered?.rearFinish ?? finish) : undefined}
            vehicle={vehicle}
            className="w-full"
            showPriceInButton={hasPrice}
            dbProfile={dbProfile}
            wheelCenterBore={wheelCenterBore}
            source={source}
            freeShipping={freeShipping}
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
