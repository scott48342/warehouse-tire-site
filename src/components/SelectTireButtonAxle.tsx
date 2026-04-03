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

export function SelectTireButtonAxle({
  wheelSku,
  axle,
  tire,
}: {
  wheelSku: string;
  axle: "front" | "rear";
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

  const param = axle === "rear" ? "tireSkuRear" : "tireSkuFront";
  const currentSku = sp.get(param) || "";
  const active = Boolean(tire?.sku && currentSku && tire.sku === currentSku);

  // Check if tire is actually in cart
  const tiresInCart = getTires();
  const tireInCart = tiresInCart.some(t => t.sku === tire.sku);

  return (
    <button
      type="button"
      onClick={() => {
        console.log(`[SelectTireButtonAxle] ${axle} tire selection clicked:`, {
          sku: tire.sku,
          brand: tire.brand,
          title: tire.title,
          price: tire.price,
          axle,
          wheelSku,
        });

        // Store in localStorage for cross-page persistence
        try {
          localStorage.setItem(`wt_selected_tire_${axle}`, JSON.stringify(tire));
        } catch {
          // ignore
        }

        // ═══════════════════════════════════════════════════════════════════
        // FIX: Actually add tire to cart (was missing before!)
        // ═══════════════════════════════════════════════════════════════════
        
        // For staggered setups, we want separate front/rear tires
        // Remove previous tire for this axle if different
        const existingTires = getTires();
        const previousAxleTire = existingTires.find(t => {
          // Check if this tire was previously selected for this axle
          // by checking localStorage
          try {
            const stored = localStorage.getItem(`wt_selected_tire_${axle}`);
            if (stored) {
              const storedTire = JSON.parse(stored);
              return t.sku === storedTire.sku && t.sku !== tire.sku;
            }
          } catch {}
          return false;
        });

        if (previousAxleTire) {
          console.log(`[SelectTireButtonAxle] Removing previous ${axle} tire:`, previousAxleTire.sku);
          removeItem(previousAxleTire.sku, "tire");
        }

        // Add tire to cart
        if (!tireInCart) {
          console.log(`[SelectTireButtonAxle] Adding ${axle} tire to cart:`, tire.sku, "vehicle:", vehicle);
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
            quantity: axle === "front" ? 2 : 2, // 2 per axle for staggered
            staggered: true,
            vehicle: vehicle || undefined,
            source: tire.source,
          });
          console.log(`[SelectTireButtonAxle] ${axle} tire added to cart successfully`);
        } else {
          console.log(`[SelectTireButtonAxle] ${axle} tire already in cart, skipping add`);
        }

        // Update URL state
        const next = new URLSearchParams(sp.toString());
        next.set("wheelSku", wheelSku);
        next.set(param, tire.sku);
        // After selecting front, nudge user to rear
        if (axle === "front") next.set("axle", "rear");
        router.replace(`/tires?${next.toString()}`);
      }}
      className={
        "rounded-xl px-4 py-3 text-center text-sm font-extrabold transition " +
        (active && tireInCart
          ? "bg-neutral-900 text-white"
          : "bg-red-600 text-white hover:bg-red-700")
      }
    >
      {active && tireInCart
        ? `✓ ${axle === "rear" ? "Rear" : "Front"} Selected`
        : axle === "rear"
          ? "Select rear tire"
          : "Select front tire"}
    </button>
  );
}
