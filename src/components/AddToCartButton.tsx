"use client";

import { useState } from "react";
import { useCart, type CartWheelItem } from "@/lib/cart/CartContext";
import { calculateAccessoryFitment, type DBProfileForAccessories, type WheelForAccessories } from "@/hooks/useAccessoryFitment";

type AddToCartButtonProps = {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  finish?: string;
  diameter?: string;
  width?: string;
  rearWidth?: string;
  offset?: string;
  rearOffset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  fitmentClass?: "surefit" | "specfit" | "extended";
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
  variant?: "primary" | "secondary";
  showPriceInButton?: boolean;
  /** DB fitment profile for accessory calculation */
  dbProfile?: DBProfileForAccessories | null;
  /** Wheel center bore in mm (for hub ring calculation) */
  wheelCenterBore?: number;
  /** Wheel seat type override (conical, ball, flat, mag) */
  wheelSeatType?: string;
};

export function AddToCartButton({
  sku,
  rearSku,
  brand,
  model,
  finish,
  diameter,
  width,
  rearWidth,
  offset,
  rearOffset,
  boltPattern,
  imageUrl,
  unitPrice,
  fitmentClass,
  vehicle,
  staggered,
  quantity = 4,
  className = "",
  variant = "primary",
  showPriceInButton = true,
  dbProfile,
  wheelCenterBore,
  wheelSeatType,
}: AddToCartButtonProps) {
  const { addItem, addAccessories, setAccessoryState, replaceAccessorySku } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);

    // ═══════════════════════════════════════════════════════════════════════
    // ACCESSORY FITMENT - Calculate and auto-add required accessories
    // ═══════════════════════════════════════════════════════════════════════
    console.log("[AddToCartButton] Accessory fitment triggered on wheel add:", {
      sku,
      hasDbProfile: !!dbProfile,
      hasVehicle: !!vehicle,
    });

    // Check if we have vehicle data for accessory calculation
    const hasVehicleData = Boolean(
      dbProfile?.threadSize || dbProfile?.centerBoreMm
    );

    if (!hasVehicleData && vehicle) {
      console.warn("[AddToCartButton] WARNING: Vehicle data missing for accessory fitment", {
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        missingFields: {
          threadSize: !dbProfile?.threadSize,
          centerBoreMm: !dbProfile?.centerBoreMm,
          seatType: !dbProfile?.seatType,
        },
      });
    }

    const item: CartWheelItem = {
      type: "wheel",
      sku,
      rearSku,
      brand,
      model,
      finish,
      diameter,
      width,
      rearWidth,
      offset,
      rearOffset,
      boltPattern,
      imageUrl,
      unitPrice,
      quantity,
      fitmentClass,
      vehicle,
      staggered,
      source: "wheelpros", // All wheels come from WheelPros
    };

    // Small delay for visual feedback
    setTimeout(() => {
      addItem(item);

      // Calculate and add accessories if we have profile data
      if (dbProfile) {
        const wheelForFitment: WheelForAccessories = {
          sku,
          centerBore: wheelCenterBore,
          seatType: wheelSeatType,
          boltPattern,
        };

        const fitmentResult = calculateAccessoryFitment(dbProfile, wheelForFitment);
        
        if (fitmentResult.state) {
          setAccessoryState(fitmentResult.state);
        }

        // Auto-add required accessories
        if (fitmentResult.requiredItems.length > 0) {
          // Replace lug kit placeholder SKU with real Gorilla kit SKU + NIP cost (server-side lookup)
          const lug = fitmentResult.requiredItems.find((i) => i.category === "lug_nut");
          if (lug?.spec?.threadSize) {
            const placeholderSku = lug.sku;
            const qs = new URLSearchParams({
              threadSize: lug.spec.threadSize,
            });
            if (lug.spec.seatType) qs.set("seatType", lug.spec.seatType);

            fetch(`/api/accessories/lugkits?${qs.toString()}`, {
              headers: { Accept: "application/json" },
            })
              .then((r) => r.json().catch(() => null).then((j) => ({ ok: r.ok, j })))
              .then(({ ok, j }) => {
                if (ok && j?.choice?.sku) {
                  const next = {
                    ...lug,
                    sku: String(j.choice.sku),
                    // Keep customer-facing behavior as included, but store real SKU + cost basis.
                    meta: {
                      ...(lug.meta || {}),
                      placeholder: false,
                      source: "wheelpros",
                      brandCode: j.choice.brandCode,
                      nipCost: j.choice.nip,
                      msrp: j.choice.msrp,
                      title: j.choice.title,
                      threadKey: j.choice.threadKey,
                    },
                  };
                  replaceAccessorySku(placeholderSku, next);
                }
              })
              .catch(() => {});
          }

          console.log(
            "[AddToCartButton] Auto-adding required accessories:",
            fitmentResult.requiredItems.map((i) => `${i.category}: ${i.name}`)
          );
          addAccessories(fitmentResult.requiredItems);
        }

        // Log accessory decisions
        if (fitmentResult.fitment) {
          const lugStatus = fitmentResult.fitment.lugNuts.status;
          const hubStatus = fitmentResult.fitment.hubRings.status;
          
          console.log(`[AddToCartButton] Lug nuts: ${lugStatus === 'required' ? 'ADDED' : 'SKIPPED'} - ${fitmentResult.fitment.lugNuts.reason}`);
          console.log(`[AddToCartButton] Hub rings: ${hubStatus === 'required' ? 'ADDED' : 'SKIPPED'} - ${fitmentResult.fitment.hubRings.reason}`);
        }
      } else if (vehicle) {
        console.log("[AddToCartButton] Skipping accessory fitment - no dbProfile available");
      }

      setIsAdding(false);
    }, 150);
  };

  const total = unitPrice * quantity;

  const baseStyles = "flex h-12 items-center justify-center rounded-xl px-4 text-sm font-extrabold transition-all";
  const variantStyles = variant === "primary"
    ? "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]"
    : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button
      onClick={handleAddToCart}
      disabled={isAdding}
      className={`${baseStyles} ${variantStyles} ${className} ${isAdding ? "opacity-70" : ""}`}
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
      ) : (
        <span>
          Add Wheels — Set of {quantity}
          {showPriceInButton && Number.isFinite(total) && total > 0 ? ` • $${total.toFixed(2)}` : ""}
        </span>
      )}
    </button>
  );
}
