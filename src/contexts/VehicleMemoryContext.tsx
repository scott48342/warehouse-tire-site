"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE MEMORY MVP
// Persists customer's selected vehicle across sessions
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "wt_active_vehicle";
const STORAGE_VERSION = 1;

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
// Storage helpers
// ═══════════════════════════════════════════════════════════════════════════════

function readVehicle(): SavedVehicle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SavedVehicle;
    // Validate required fields
    if (!data?.year || !data?.make || !data?.model) return null;
    // Version check for future migrations
    if (data.version !== STORAGE_VERSION) {
      // Future: migrate old versions here
      console.log("[VehicleMemory] Migrating from version", data.version, "to", STORAGE_VERSION);
    }
    return data;
  } catch (err) {
    console.warn("[VehicleMemory] Failed to read:", err);
    return null;
  }
}

function writeVehicle(vehicle: SavedVehicle): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicle));
    return true;
  } catch (err) {
    console.warn("[VehicleMemory] Failed to write:", err);
    return false;
  }
}

function clearVehicle(): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn("[VehicleMemory] Failed to clear:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics helpers
// ═══════════════════════════════════════════════════════════════════════════════

function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  
  // gtag (Google Analytics 4)
  if (typeof (window as any).gtag === "function") {
    (window as any).gtag("event", event, data);
  }
  
  // Console log for debugging
  console.log(`[VehicleMemory] Analytics: ${event}`, data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export function VehicleMemoryProvider({ children }: { children: ReactNode }) {
  const [activeVehicle, setActiveVehicleState] = useState<SavedVehicle | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const stored = readVehicle();
    if (stored) {
      setActiveVehicleState(stored);
      trackEvent("vehicle_restored", {
        year: stored.year,
        make: stored.make,
        model: stored.model,
        trim: stored.trim,
        days_since_saved: Math.floor((Date.now() - stored.savedAt) / (1000 * 60 * 60 * 24)),
      });
    }
    setIsLoaded(true);
  }, []);

  const setActiveVehicle = useCallback((vehicle: Omit<SavedVehicle, "savedAt" | "version">) => {
    // ═══════════════════════════════════════════════════════════════════════════
    // DUPLICATE PREVENTION: Don't save/track if vehicle is the same
    // This prevents duplicate analytics events from VehicleMemorySync
    // ═══════════════════════════════════════════════════════════════════════════
    const isSameVehicle = activeVehicle !== null &&
      activeVehicle.year === vehicle.year &&
      activeVehicle.make === vehicle.make &&
      activeVehicle.model === vehicle.model &&
      activeVehicle.modification === vehicle.modification;
    
    if (isSameVehicle) {
      // Skip save if same vehicle (prevents duplicate events)
      return;
    }
    
    const saved: SavedVehicle = {
      ...vehicle,
      savedAt: Date.now(),
      version: STORAGE_VERSION,
    };
    
    const isChange = activeVehicle !== null;
    
    if (writeVehicle(saved)) {
      setActiveVehicleState(saved);
      trackEvent(isChange ? "vehicle_changed" : "vehicle_saved", {
        year: saved.year,
        make: saved.make,
        model: saved.model,
        trim: saved.trim,
        modification: saved.modification,
        wheel_diameter: saved.wheelDia,
      });
    }
  }, [activeVehicle]);

  const clearActiveVehicle = useCallback(() => {
    if (activeVehicle && clearVehicle()) {
      trackEvent("vehicle_cleared", {
        year: activeVehicle.year,
        make: activeVehicle.make,
        model: activeVehicle.model,
      });
      setActiveVehicleState(null);
    }
  }, [activeVehicle]);

  const buildVehicleParams = useCallback(() => {
    const params = new URLSearchParams();
    if (!activeVehicle) return params;
    
    if (activeVehicle.year) params.set("year", activeVehicle.year);
    if (activeVehicle.make) params.set("make", activeVehicle.make);
    if (activeVehicle.model) params.set("model", activeVehicle.model);
    if (activeVehicle.trim) params.set("trim", activeVehicle.trim);
    if (activeVehicle.modification) params.set("modification", activeVehicle.modification);
    
    return params;
  }, [activeVehicle]);

  const hasCompleteVehicle = Boolean(
    activeVehicle?.year && 
    activeVehicle?.make && 
    activeVehicle?.model
  );

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
