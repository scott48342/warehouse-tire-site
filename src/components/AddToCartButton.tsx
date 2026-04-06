"use client";

import { useState, useCallback } from "react";
import { useCart, type CartWheelItem } from "@/lib/cart/CartContext";
import { calculateAccessoryFitment, type DBProfileForAccessories, type WheelForAccessories } from "@/hooks/useAccessoryFitment";
import { AccessoryAttachModal, buildAccessoryOptions, type AccessoryOption } from "@/components/AccessoryAttachModal";
import type { CartAccessoryItem } from "@/lib/cart/accessoryTypes";

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
  const [showAccessoryModal, setShowAccessoryModal] = useState(false);
  const [accessoryOptions, setAccessoryOptions] = useState<AccessoryOption[]>([]);
  const [pendingWheelItem, setPendingWheelItem] = useState<CartWheelItem | null>(null);

  // Add wheel to cart (called after accessory decision)
  const addWheelToCart = useCallback((wheelItem: CartWheelItem) => {
    addItem(wheelItem);
  }, [addItem]);

  // Handle accessory confirmation from modal
  const handleAccessoryConfirm = useCallback((selectedItems: CartAccessoryItem[]) => {
    if (pendingWheelItem) {
      // Add the wheel first
      addWheelToCart(pendingWheelItem);
      
      // Then add selected accessories
      if (selectedItems.length > 0) {
        console.log("[AddToCartButton] User selected accessories:", selectedItems.map(i => `${i.category}: ${i.name}`));
        
        // Handle lug kit SKU replacement (same as before)
        const lug = selectedItems.find((i) => i.category === "lug_nut" || i.category === "lug_bolt");
        if (lug?.spec?.threadSize) {
          const placeholderSku = lug.sku;
          const qs = new URLSearchParams({ threadSize: lug.spec.threadSize });
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

        addAccessories(selectedItems);
      }
      
      setPendingWheelItem(null);
    }
    setIsAdding(false);
  }, [pendingWheelItem, addWheelToCart, addAccessories, replaceAccessorySku]);

  // Handle skip from modal - add wheel only
  const handleAccessorySkip = useCallback(() => {
    if (pendingWheelItem) {
      addWheelToCart(pendingWheelItem);
      console.log("[AddToCartButton] User skipped accessories");
      setPendingWheelItem(null);
    }
    setIsAdding(false);
  }, [pendingWheelItem, addWheelToCart]);

  const handleAddToCart = () => {
    setIsAdding(true);

    // ═══════════════════════════════════════════════════════════════════════
    // ACCESSORY FITMENT - Calculate and auto-add required accessories
    // ═══════════════════════════════════════════════════════════════════════
    console.log("[AddToCartButton] Accessory fitment triggered on wheel add:", {
      sku,
      hasDbProfile: !!dbProfile,
      hasVehicle: !!vehicle,
      wheelCenterBore: wheelCenterBore ?? "(not provided)",
      dbProfile: dbProfile ? {
        threadSize: dbProfile.threadSize ?? "(null)",
        seatType: dbProfile.seatType ?? "(null)",
        centerBoreMm: dbProfile.centerBoreMm ?? "(null)",
        boltPattern: dbProfile.boltPattern ?? "(null)",
      } : null,
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

    // Calculate accessories if we have profile data
    if (dbProfile) {
      const wheelForFitment: WheelForAccessories = {
        sku,
        centerBore: wheelCenterBore,
        seatType: wheelSeatType,
        boltPattern,
      };

      const fitmentResult = calculateAccessoryFitment(dbProfile, wheelForFitment);
      
      // Log detailed fitment result
      console.log("[AddToCartButton] Fitment calculation result:", {
        wheelSku: sku,
        requiredItems: fitmentResult.requiredItems.map(i => ({
          category: i.category,
          sku: i.sku,
          name: i.name,
        })),
      });
      
      if (fitmentResult.state) {
        setAccessoryState(fitmentResult.state);
      }

      // If we have accessories to offer, show the modal
      if (fitmentResult.requiredItems.length > 0) {
        const options = buildAccessoryOptions(fitmentResult.requiredItems);
        
        // Store pending wheel and show modal
        setPendingWheelItem(item);
        setAccessoryOptions(options);
        setShowAccessoryModal(true);
        
        console.log("[AddToCartButton] Showing accessory modal with options:", options.map(o => o.label));
        return; // Don't add to cart yet - wait for modal decision
      }
    }

    // No accessories or no profile - add wheel directly
    setTimeout(() => {
      addWheelToCart(item);
      setIsAdding(false);
    }, 150);
  };

  const total = unitPrice * quantity;

  const baseStyles = "flex h-12 items-center justify-center rounded-xl px-4 text-sm font-extrabold transition-all";
  const variantStyles = variant === "primary"
    ? "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-lg shadow-red-600/30 hover:shadow-xl hover:shadow-red-600/40"
    : "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <>
      <button
        onClick={handleAddToCart}
        disabled={isAdding || showAccessoryModal}
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
          {showPriceInButton && Number.isFinite(total) && total > 0 
            ? `Add Set of ${quantity} — $${total.toFixed(2)}`
            : `Add Set of ${quantity} to Cart`
          }
        </span>
      )}
      </button>

      {/* Accessory Attach Modal */}
      <AccessoryAttachModal
        isOpen={showAccessoryModal}
        onClose={() => {
          setShowAccessoryModal(false);
          setIsAdding(false);
        }}
        accessories={accessoryOptions}
        onConfirm={handleAccessoryConfirm}
        onSkip={handleAccessorySkip}
        wheelInfo={{
          name: `${brand} ${model}`,
          quantity,
        }}
      />
    </>
  );
}
