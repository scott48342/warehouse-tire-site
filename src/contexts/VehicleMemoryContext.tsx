"use client";

import { createContext, useContext, useCallback, ReactNode, useMemo } from "react";
import { useGarage, type GarageVehicle } from "@/contexts/GarageContext";

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE MEMORY - COMPATIBILITY ADAPTER
// 
// This context now derives from GarageContext (single source of truth).
// It maintains backward-compatible API for existing consumers (Jake, header, etc.)
// but no longer independently persists to localStorage.
//
// MIGRATION NOTE (2026-08-21):
// Previously this context wrote SavedVehicle objects to wt_active_vehicle.
// GarageContext wrote ID strings to the same key, causing collisions.
// Now: GarageContext owns all vehicle persistence, this is just an adapter.
// ═══════════════════════════════════════════════════════════════════════════════

export type SavedVehicle = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string; // aka vehicle_id / modification_id
  wheelDia?: number;
  savedAt: number;
  version: number;
};

type VehicleMemoryContextValue = {
  /** The currently active/saved vehicle, or null if none */
  activeVehicle: SavedVehicle | null;
  /** Whether the vehicle has been loaded from storage (prevents flash) */
  isLoaded: boolean;
  /** Save a vehicle as the active vehicle */
  setActiveVehicle: (vehicle: Omit<SavedVehicle, "savedAt" | "version">) => void;
  /** Clear the active vehicle */
  clearActiveVehicle: () => void;
  /** Build URL params for the active vehicle */
  buildVehicleParams: () => URLSearchParams;
  /** Check if we have a complete vehicle selection */
  hasCompleteVehicle: boolean;
};

const VehicleMemoryContext = createContext<VehicleMemoryContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Convert GarageVehicle to SavedVehicle for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════════

function garageVehicleToSavedVehicle(gv: GarageVehicle | null): SavedVehicle | null {
  if (!gv) return null;
  return {
    year: gv.year,
    make: gv.make,
    model: gv.model,
    trim: gv.trim,
    modification: gv.modification,
    wheelDia: gv.wheelDia,
    savedAt: gv.lastActiveAt,
    version: 1,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider - Adapter over GarageContext
// ═══════════════════════════════════════════════════════════════════════════════

export function VehicleMemoryProvider({ children }: { children: ReactNode }) {
  // Get state and actions from GarageContext (our source of truth)
  const {
    activeVehicle: garageActiveVehicle,
    isLoaded,
    setActiveVehicleByData,
    clearActiveVehicle: garageClearActive,
    buildVehicleParams,
    hasCompleteVehicle,
  } = useGarage();

  // Convert GarageVehicle → SavedVehicle for backward-compatible API
  const activeVehicle = useMemo(
    () => garageVehicleToSavedVehicle(garageActiveVehicle),
    [garageActiveVehicle]
  );

  // setActiveVehicle delegates to GarageContext
  // This adds to garage (if needed) and sets as active
  const setActiveVehicle = useCallback(
    (vehicle: Omit<SavedVehicle, "savedAt" | "version">) => {
      setActiveVehicleByData({
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        modification: vehicle.modification,
        wheelDia: vehicle.wheelDia,
      });
    },
    [setActiveVehicleByData]
  );

  // clearActiveVehicle delegates to GarageContext
  const clearActiveVehicle = useCallback(() => {
    garageClearActive();
  }, [garageClearActive]);

  return (
    <VehicleMemoryContext.Provider
      value={{
        activeVehicle,
        isLoaded,
        setActiveVehicle,
        clearActiveVehicle,
        buildVehicleParams,
        hasCompleteVehicle,
      }}
    >
      {children}
    </VehicleMemoryContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useVehicleMemory() {
  const context = useContext(VehicleMemoryContext);
  if (!context) {
    throw new Error("useVehicleMemory must be used within VehicleMemoryProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility: Format vehicle display string
// ═══════════════════════════════════════════════════════════════════════════════

export function formatVehicleDisplay(vehicle: SavedVehicle | null): string {
  if (!vehicle) return "";
  const parts = [vehicle.year, vehicle.make, vehicle.model];
  if (vehicle.trim && vehicle.trim !== "Base") {
    parts.push(vehicle.trim);
  }
  return parts.filter(Boolean).join(" ");
}
