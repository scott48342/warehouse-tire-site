"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useVehicleMemory } from "@/contexts/VehicleMemoryContext";

/**
 * VehicleMemorySync - Syncs URL vehicle params to VehicleMemoryContext
 * 
 * Use this component in pages that display vehicle-specific content.
 * It ensures that when a user lands on a page with vehicle params in the URL
 * (from SEO links, shared links, etc.), the vehicle is saved to memory.
 * 
 * This enables:
 * - Header vehicle indicator shows the current vehicle
 * - Returning visitors see the same vehicle on future visits
 * - Analytics track vehicle selections consistently
 */
export function VehicleMemorySync() {
  const searchParams = useSearchParams();
  const { activeVehicle, setActiveVehicle, isLoaded } = useVehicleMemory();

  useEffect(() => {
    // Wait for vehicle memory to load from localStorage
    if (!isLoaded) return;

    const year = searchParams.get("year");
    const make = searchParams.get("make");
    const model = searchParams.get("model");
    const trim = searchParams.get("trim") || undefined;
    const modification = searchParams.get("modification") || undefined;
    const wheelDiaStr = searchParams.get("wheelDia");
    const wheelDia = wheelDiaStr ? parseInt(wheelDiaStr, 10) : undefined;

    // Only sync if we have a complete vehicle in URL
    if (!year || !make || !model) return;

    // Check if this is different from the current active vehicle
    const isDifferent = 
      activeVehicle?.year !== year ||
      activeVehicle?.make !== make ||
      activeVehicle?.model !== model ||
      activeVehicle?.modification !== modification;

    // Only update if different (prevents duplicate analytics events)
    if (isDifferent) {
      setActiveVehicle({
        year,
        make,
        model,
        trim,
        modification,
        wheelDia,
      });
    }
  }, [searchParams, activeVehicle, setActiveVehicle, isLoaded]);

  // This component renders nothing - it's purely for side effects
  return null;
}
