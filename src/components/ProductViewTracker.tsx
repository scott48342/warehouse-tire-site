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
  }, [sku, type, vehicle]);
  
  return null;
}

export default ProductViewTracker;
