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
        "rounded-xl px-4 py-3 text-center text-sm font-extrabold transition " +
        (active && tireInCart
          ? "bg-neutral-900 text-white"
          : "bg-red-600 text-white hover:bg-red-700")
      }
    >
      {active && tireInCart ? "✓ Selected" : "Select tire"}
    </button>
  );
}
