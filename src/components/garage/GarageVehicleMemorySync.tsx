"use client";

import { useEffect } from "react";
import { useGarage } from "@/contexts/GarageContext";
import { useVehicleMemory } from "@/contexts/VehicleMemoryContext";

/**
 * Sync component that bridges GarageContext to VehicleMemoryContext
 * 
 * When the garage's active vehicle changes, this component updates
 * VehicleMemoryContext so that Jake and other legacy components
 * can access the current vehicle.
 */
export function GarageVehicleMemorySync() {
  const { activeVehicle: garageVehicle, isLoaded: garageLoaded } = useGarage();
  const { setActiveVehicle, clearActiveVehicle } = useVehicleMemory();

  useEffect(() => {
    if (!garageLoaded) return;

    // Only sync FROM garage TO memory when garage HAS a vehicle
    // Don't clear memory when garage is empty - URL params may be the source of truth
    // (e.g., user landed on /tires?year=2024&make=Ford&model=F-150)
    if (garageVehicle) {
      setActiveVehicle({
        year: garageVehicle.year,
        make: garageVehicle.make,
        model: garageVehicle.model,
        trim: garageVehicle.trim,
        modification: garageVehicle.modification,
        wheelDia: garageVehicle.wheelDia,
      });
    }
    // NOTE: We intentionally do NOT call clearActiveVehicle() when garage is empty.
    // This prevents a loop where VehicleMemorySync saves from URL and this clears it.
  }, [garageVehicle, garageLoaded, setActiveVehicle]);

  // This component renders nothing - it's just for side effects
  return null;
}
