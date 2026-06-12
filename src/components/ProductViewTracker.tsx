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

interface ProductViewTrackerProps {
  sku: string;
  type: "wheel" | "tire" | "accessory" | "package";
  vehicle?: {
    year?: number;
    make?: string;
    model?: string;
  };
}

export function ProductViewTracker({ sku, type, vehicle }: ProductViewTrackerProps) {
  const tracked = useRef(false);
  
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    
    trackProductView(sku, type, vehicle);
    
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
