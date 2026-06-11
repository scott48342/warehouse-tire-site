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

    if (garageVehicle) {
      // Sync garage vehicle to VehicleMemory format
      setActiveVehicle({
        year: garageVehicle.year,
        make: garageVehicle.make,
        model: garageVehicle.model,
        trim: garageVehicle.trim,
        modification: garageVehicle.modification,
        wheelDia: garageVehicle.wheelDia,
      });
    } else {
      // No active vehicle in garage, clear VehicleMemory too
      clearActiveVehicle();
    }
  }, [garageVehicle, garageLoaded, setActiveVehicle, clearActiveVehicle]);

  // This component renders nothing - it's just for side effects
  return null;
}
