"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";

export type SelectedTire = {
  sku: string;
  brand?: string;
  title?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  speed?: string;
  loadIndex?: string;
  season?: string;
  runFlat?: boolean;
  xl?: boolean;
  /** Supplier source (e.g., "tireweb:atd", "km", "wheelpros") for internal tracking */
  source?: string;
};

export function SelectTireButton({
  wheelSku,
  tire,
}: {
  wheelSku: string;
  tire: SelectedTire;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const { addItem, getTires, removeItem, getWheels } = useCart();
  
  // Get vehicle info from URL params or from wheels in cart
  const wheels = getWheels();
  const wheelVehicle = wheels[0]?.vehicle;
  const urlVehicle = sp.get("year") && sp.get("make") && sp.get("model") ? {
    year: sp.get("year")!,
    make: sp.get("make")!,
    model: sp.get("model")!,
    trim: sp.get("trim") || undefined,
    modification: sp.get("modification") || undefined,
  } : null;
  const vehicle = wheelVehicle || urlVehicle;

  const currentTireSku = sp.get("tireSku") || "";
  const active = Boolean(tire?.sku && currentTireSku && tire.sku === currentTireSku);
  
  // Also check if tire is actually in cart
  const tiresInCart = getTires();
  const tireInCart = tiresInCart.some(t => t.sku === tire.sku);

  return (
    <button
      type="button"
      onClick={() => {
        console.log("[SelectTireButton] Tire selection clicked:", {
          sku: tire.sku,
          brand: tire.brand,
          title: tire.title,
          price: tire.price,
          wheelSku,
        });

        // Store in localStorage for cross-page persistence
        try {
          localStorage.setItem("wt_selected_tire", JSON.stringify(tire));
        } catch {
          // ignore
        }

        // ═══════════════════════════════════════════════════════════════════
        // FIX: Actually add tire to cart (was missing before!)
        // ═══════════════════════════════════════════════════════════════════
        
        // Remove any existing tires from this selection (prevent duplicates)
        const existingTires = getTires();
        for (const existingTire of existingTires) {
          if (existingTire.sku !== tire.sku) {
            console.log("[SelectTireButton] Removing previous tire selection:", existingTire.sku);
            removeItem(existingTire.sku, "tire");
          }
        }

        // Add tire to cart
        if (!tireInCart) {
          console.log("[SelectTireButton] Adding tire to cart:", tire.sku, "vehicle:", vehicle);
          addItem({
            type: "tire",
            sku: tire.sku,
            brand: tire.brand || "Tire",
            model: tire.title || tire.sku,
            size: tire.size || "",
            loadIndex: tire.loadIndex,
            speedRating: tire.speed,
            imageUrl: tire.imageUrl,
            unitPrice: tire.price || 0,
            quantity: 4,
            vehicle: vehicle || undefined,
            source: tire.source,
          });
          console.log("[SelectTireButton] Tire added to cart successfully");
        } else {
          console.log("[SelectTireButton] Tire already in cart, skipping add");
        }

        // Update URL state for visual feedback
        const next = new URLSearchParams(sp.toString());
        next.set("wheelSku", wheelSku);
        next.set("tireSku", tire.sku);
        router.replace(`/tires?${next.toString()}`);
      }}
      className={
        "flex h-13 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-250 " +
        (active && tireInCart
          ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white cursor-default shadow-md shadow-emerald-500/25"
          : "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-600 active:scale-[0.99] shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/25")
      }
    >
      {active && tireInCart ? (
        <>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          Added to Package
        </>
      ) : (
        <>
          ✓ Add 4 to Package
          {tire.price != null && (
            <span className="opacity-90 font-bold">
              • ${(tire.price * 4).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          )}
        </>
      )}
    </button>
  );
}
