"use client";

/**
 * ProductViewTracker Component
 * 
 * Client component that tracks product views.
 * Use in server-rendered PDPs to track views without making the page a client component.
 * 
 * Usage:
 *   <ProductViewTracker sku="ABC123" type="wheel" vehicle={{ year: 2024, make: "Ford", model: "F-150" }} />
 */

import { useEffect, useRef } from "react";
import { trackProductView } from "./FunnelTracker";
import { clarityEvent, claritySetTag } from "./MicrosoftClarity";
import { ga4ViewItem } from "@/lib/ga4";

interface ProductViewTrackerProps {
  sku: string;
  type: "wheel" | "tire" | "accessory" | "package";
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
  };
  /** Optional product details for GA4 view_item (additive; safe to omit). */
  name?: string;
  brand?: string;
  price?: number;
}

export function ProductViewTracker({ sku, type, vehicle, name, brand, price }: ProductViewTrackerProps) {
  const tracked = useRef(false);
  
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    
    trackProductView(sku, type, vehicle);

    // GA4 standard ecommerce event (additive; no-ops without gtag)
    ga4ViewItem({
      item: {
        item_id: sku,
        item_name: name,
        item_brand: brand,
        item_category: type,
        price: typeof price === "number" ? price : undefined,
        quantity: 1,
      },
      value: typeof price === "number" ? price : undefined,
    });
    
    // Microsoft Clarity tracking - tag session for filtering
    clarityEvent(`product_view_${type}`);
    claritySetTag('product_type', type);
    if (vehicle?.make) {
      claritySetTag('vehicle_make', vehicle.make);
    }
  }, [sku, type, vehicle]);
  
  return null;
}

export default ProductViewTracker;
