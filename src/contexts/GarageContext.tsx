"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { trackGarageVehicleSave, trackGarageVehicleRestore } from "@/lib/analytics/tracker";

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-VEHICLE GARAGE
// Allows customers to save multiple vehicles and switch between them
// ═══════════════════════════════════════════════════════════════════════════════

const GARAGE_KEY = "wt_garage";
const ACTIVE_ID_KEY = "wt_garage_active_id";  // NEW dedicated key for active ID
const LEGACY_ACTIVE_KEY = "wt_active_vehicle"; // DEPRECATED - read-only for migration
const GARAGE_VERSION = 1;
const MAX_VEHICLES = 10;

export type GarageVehicle = {
  id: string;                    // Unique ID for the vehicle
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;         // aka vehicle_id / modification_id
  wheelDia?: number;
  nickname?: string;             // Custom user nickname
  addedAt: number;               // Timestamp when added
  lastActiveAt: number;          // Timestamp when last made active
};

type Garage = {
  vehicles: GarageVehicle[];
  version: number;
};

type GarageContextValue = {
  /** All vehicles in the garage */
  garage: GarageVehicle[];
  /** The currently active vehicle, or null if none */
  activeVehicle: GarageVehicle | null;
  /** Whether the garage has been loaded from storage */
  isLoaded: boolean;
  /** Add a vehicle to the garage (and optionally set as active) */
  addVehicle: (vehicle: Omit<GarageVehicle, "id" | "addedAt" | "lastActiveAt">, setActive?: boolean) => GarageVehicle | null;
  /** Remove a vehicle from the garage */
  removeVehicle: (vehicleId: string) => boolean;
  /** Set a vehicle as the active vehicle */
  setActiveVehicle: (vehicleId: string) => boolean;
  /** Set active vehicle by vehicle data (for URL sync) - adds to garage if needed */
  setActiveVehicleByData: (vehicle: Omit<GarageVehicle, "id" | "addedAt" | "lastActiveAt" | "nickname">) => GarageVehicle | null;
  /** Clear the active vehicle (but keep in garage) */
  clearActiveVehicle: () => void;
  /** Update a vehicle's nickname */
  updateNickname: (vehicleId: string, nickname: string) => boolean;
  /** Check if a vehicle is already in the garage */
  isInGarage: (year: string, make: string, model: string, modification?: string) => GarageVehicle | null;
  /** Build URL params for the active vehicle */
  buildVehicleParams: () => URLSearchParams;
  /** Check if we have a complete active vehicle */
  hasCompleteVehicle: boolean;
  /** Number of vehicles in garage */
  vehicleCount: number;
  /** Replace entire garage (for server sync) */
  replaceGarage: (vehicles: GarageVehicle[], activeId?: string | null) => void;
};

const GarageContext = createContext<GarageContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// Storage helpers
// ═══════════════════════════════════════════════════════════════════════════════

function generateId(): string {
  return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function readGarage(): Garage {
  if (typeof window === "undefined") return { vehicles: [], version: GARAGE_VERSION };
  try {
    const raw = localStorage.getItem(GARAGE_KEY);
    if (!raw) return { vehicles: [], version: GARAGE_VERSION };
    const data = JSON.parse(raw) as Garage;
    if (data.version !== GARAGE_VERSION) {
      console.log("[Garage] Migrating from version", data.version, "to", GARAGE_VERSION);
    }
    return { vehicles: data.vehicles || [], version: GARAGE_VERSION };
  } catch (err) {
    console.warn("[Garage] Failed to read:", err);
    return { vehicles: [], version: GARAGE_VERSION };
  }
}

function writeGarage(garage: Garage): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(GARAGE_KEY, JSON.stringify(garage));
    return true;
  } catch (err) {
    console.warn("[Garage] Failed to write:", err);
    return false;
  }
}

/**
 * Read active vehicle ID from storage
 * Priority: new key > legacy key (for migration)
 */
function readActiveId(): string | null {
  if (typeof window === "undefined") return null;
  
  // 1. Try the new dedicated key first
  try {
    const newKeyRaw = localStorage.getItem(ACTIVE_ID_KEY);
    if (newKeyRaw) {
      const parsed = JSON.parse(newKeyRaw);
      if (typeof parsed === "string" && parsed.startsWith("v_")) {
        return parsed;
      }
    }
  } catch {
    // Continue to legacy
  }
  
  // 2. Fall back to legacy key for migration
  return readLegacyActiveId();
}

/**
 * Read active ID from legacy wt_active_vehicle key
 * Handles both formats: string ID or SavedVehicle object
 */
function readLegacyActiveId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_ACTIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    
    // Format 1: String ID (GarageContext wrote this)
    if (typeof data === "string" && data.startsWith("v_")) {
      return data;
    }
    
    // Format 2: Object with id field
    if (data?.id && typeof data.id === "string" && data.id.startsWith("v_")) {
      return data.id;
    }
    
    // Format 3: SavedVehicle object without id (VehicleMemoryContext format)
    // Will be handled by readLegacySavedVehicle() instead
    return null;
  } catch {
    return null;
  }
}

/**
 * Read legacy SavedVehicle object from wt_active_vehicle
 * Only returns data if it's the old VehicleMemoryContext format
 */
function readLegacySavedVehicle(): GarageVehicle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_ACTIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    
    // Check if it's old SavedVehicle format (has year/make/model but no garage id)
    if (
      data?.year && 
      data?.make && 
      data?.model && 
      !(typeof data.id === "string" && data.id.startsWith("v_"))
    ) {
      return {
        id: generateId(),
        year: String(data.year),
        make: String(data.make),
        model: String(data.model),
        trim: data.trim ? String(data.trim) : undefined,
        modification: data.modification ? String(data.modification) : undefined,
        wheelDia: typeof data.wheelDia === "number" ? data.wheelDia : undefined,
        addedAt: data.savedAt || Date.now(),
        lastActiveAt: Date.now(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write active vehicle ID to the NEW dedicated key only
 * Does NOT write to legacy key
 */
function writeActiveId(id: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (id) {
      localStorage.setItem(ACTIVE_ID_KEY, JSON.stringify(id));
    } else {
      localStorage.removeItem(ACTIVE_ID_KEY);
    }
    return true;
  } catch (err) {
    console.warn("[Garage] Failed to write active ID:", err);
    return false;
  }
}

/**
 * Find a vehicle in the garage by canonical identity
 * Uses modification as primary key when available, falls back to YMM
 */
function findMatchingVehicle(
  vehicles: GarageVehicle[],
  target: { year: string; make: string; model: string; modification?: string }
): GarageVehicle | null {
  // First try exact match with modification
  if (target.modification) {
    const exactMatch = vehicles.find(v =>
      v.year === target.year &&
      v.make === target.make &&
      v.model === target.model &&
      v.modification === target.modification
    );
    if (exactMatch) return exactMatch;
  }
  
  // Fall back to YMM match (for legacy data without modification)
  // Only match if NEITHER has modification (to avoid collapsing different trims)
  const ymmMatch = vehicles.find(v =>
    v.year === target.year &&
    v.make === target.make &&
    v.model === target.model &&
    !v.modification &&
    !target.modification
  );
  
  return ymmMatch || null;
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
  
  console.log(`[Garage] Analytics: ${event}`, data);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export function GarageProvider({ children }: { children: ReactNode }) {
  const [garage, setGarage] = useState<GarageVehicle[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const storedGarage = readGarage();
    let vehicles = storedGarage.vehicles;
    let activeVehicleId = readActiveId();

    // Handle legacy SavedVehicle migration from wt_active_vehicle
    const legacySavedVehicle = readLegacySavedVehicle();
    if (legacySavedVehicle) {
      // Check if this vehicle already exists in garage (deterministic deduplication)
      const existingMatch = findMatchingVehicle(vehicles, legacySavedVehicle);
      
      if (existingMatch) {
        // Vehicle already in garage - just set it as active
        activeVehicleId = existingMatch.id;
        console.log("[Garage] Legacy vehicle matched existing:", existingMatch.id);
      } else {
        // New vehicle - add to garage
        vehicles = [...vehicles, legacySavedVehicle];
        activeVehicleId = legacySavedVehicle.id;
        writeGarage({ vehicles, version: GARAGE_VERSION });
        console.log("[Garage] Legacy vehicle migrated:", legacySavedVehicle.id);
        trackEvent("garage_legacy_migrated", {
          vehicle: `${legacySavedVehicle.year} ${legacySavedVehicle.make} ${legacySavedVehicle.model}`,
        });
      }
      
      // Write to new key location
      writeActiveId(activeVehicleId);
    }

    setGarage(vehicles);
    
    // Validate active ID exists in garage
    if (activeVehicleId && vehicles.find(v => v.id === activeVehicleId)) {
      setActiveId(activeVehicleId);
      writeActiveId(activeVehicleId); // Ensure new key is populated
    } else if (vehicles.length > 0) {
      // Default to most recently active
      const sorted = [...vehicles].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
      const fallbackId = sorted[0].id;
      setActiveId(fallbackId);
      writeActiveId(fallbackId);
    }

    setIsLoaded(true);

    if (vehicles.length > 0) {
      trackEvent("garage_loaded", {
        vehicle_count: vehicles.length,
        has_active: !!activeVehicleId,
      });
    }
  }, []);

  const activeVehicle = garage.find(v => v.id === activeId) || null;

  const addVehicle = useCallback((
    vehicle: Omit<GarageVehicle, "id" | "addedAt" | "lastActiveAt">,
    setActive = true
  ): GarageVehicle | null => {
    // Check if already in garage using canonical matching
    const existing = findMatchingVehicle(garage, vehicle);

    if (existing) {
      // Update last active and set active if requested
      if (setActive) {
        const updated = garage.map(v =>
          v.id === existing.id ? { ...v, lastActiveAt: Date.now() } : v
        );
        setGarage(updated);
        writeGarage({ vehicles: updated, version: GARAGE_VERSION });
        setActiveId(existing.id);
        writeActiveId(existing.id);
        trackEvent("garage_vehicle_activated", {
          vehicle: `${existing.year} ${existing.make} ${existing.model}`,
          method: "add_existing",
        });
      }
      return existing;
    }

    // Check max limit
    if (garage.length >= MAX_VEHICLES) {
      console.warn("[Garage] Maximum vehicle limit reached");
      return null;
    }

    const newVehicle: GarageVehicle = {
      ...vehicle,
      id: generateId(),
      addedAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    const updated = [...garage, newVehicle];
    setGarage(updated);
    writeGarage({ vehicles: updated, version: GARAGE_VERSION });

    if (setActive) {
      setActiveId(newVehicle.id);
      writeActiveId(newVehicle.id);
    }

    trackEvent("garage_vehicle_added", {
      vehicle: `${newVehicle.year} ${newVehicle.make} ${newVehicle.model}`,
      trim: newVehicle.trim,
      garage_size: updated.length,
      set_active: setActive,
    });
    
    // Track in funnel events for conversion dashboard
    trackGarageVehicleSave(newVehicle);

    return newVehicle;
  }, [garage]);

  /**
   * Set active vehicle by vehicle data (used for URL sync)
   * Adds to garage if not present, returns the garage vehicle
   */
  const setActiveVehicleByData = useCallback((
    vehicle: Omit<GarageVehicle, "id" | "addedAt" | "lastActiveAt" | "nickname">
  ): GarageVehicle | null => {
    // This delegates to addVehicle which handles deduplication
    return addVehicle(vehicle, true);
  }, [addVehicle]);

  const removeVehicle = useCallback((vehicleId: string): boolean => {
    const vehicle = garage.find(v => v.id === vehicleId);
    if (!vehicle) return false;

    const updated = garage.filter(v => v.id !== vehicleId);
    setGarage(updated);
    writeGarage({ vehicles: updated, version: GARAGE_VERSION });

    // If removing active vehicle, switch to another
    if (activeId === vehicleId) {
      if (updated.length > 0) {
        const sorted = [...updated].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
        const newActiveId = sorted[0].id;
        setActiveId(newActiveId);
        writeActiveId(newActiveId);
      } else {
        setActiveId(null);
        writeActiveId(null);
      }
    }

    trackEvent("garage_vehicle_removed", {
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      garage_size: updated.length,
      was_active: activeId === vehicleId,
    });

    return true;
  }, [garage, activeId]);

  const setActiveVehicleById = useCallback((vehicleId: string): boolean => {
    const vehicle = garage.find(v => v.id === vehicleId);
    if (!vehicle) return false;

    const previousActive = activeVehicle;

    // Update last active time
    const updated = garage.map(v =>
      v.id === vehicleId ? { ...v, lastActiveAt: Date.now() } : v
    );
    setGarage(updated);
    writeGarage({ vehicles: updated, version: GARAGE_VERSION });

    setActiveId(vehicleId);
    writeActiveId(vehicleId);

    trackEvent("garage_vehicle_switched", {
      from: previousActive ? `${previousActive.year} ${previousActive.make} ${previousActive.model}` : null,
      to: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    });
    
    // Track in funnel events for conversion dashboard
    trackGarageVehicleRestore(vehicle);

    return true;
  }, [garage, activeVehicle]);

  const clearActiveVehicle = useCallback(() => {
    if (activeVehicle) {
      trackEvent("garage_active_cleared", {
        vehicle: `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`,
      });
    }
    setActiveId(null);
    writeActiveId(null);
  }, [activeVehicle]);

  const updateNickname = useCallback((vehicleId: string, nickname: string): boolean => {
    const vehicle = garage.find(v => v.id === vehicleId);
    if (!vehicle) return false;

    const updated = garage.map(v =>
      v.id === vehicleId ? { ...v, nickname: nickname.trim() || undefined } : v
    );
    setGarage(updated);
    writeGarage({ vehicles: updated, version: GARAGE_VERSION });

    trackEvent("garage_nickname_updated", {
      vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
      has_nickname: !!nickname.trim(),
    });

    return true;
  }, [garage]);

  const isInGarage = useCallback((
    year: string,
    make: string,
    model: string,
    modification?: string
  ): GarageVehicle | null => {
    return findMatchingVehicle(garage, { year, make, model, modification });
  }, [garage]);

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

  /**
   * Replace entire garage with new vehicles (used for server sync)
   * Atomic operation that replaces local state with server state
   */
  const replaceGarage = useCallback((vehicles: GarageVehicle[], newActiveId?: string | null) => {
    setGarage(vehicles);
    writeGarage({ vehicles, version: GARAGE_VERSION });
    
    // Determine active ID
    let finalActiveId: string | null = null;
    if (newActiveId && vehicles.find(v => v.id === newActiveId)) {
      finalActiveId = newActiveId;
    } else if (vehicles.length > 0) {
      // Fall back to most recently active
      const sorted = [...vehicles].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
      finalActiveId = sorted[0].id;
    }
    
    setActiveId(finalActiveId);
    writeActiveId(finalActiveId);
    
    console.log("[Garage] Replaced:", {
      count: vehicles.length,
      activeId: finalActiveId,
    });
  }, []);

  const hasCompleteVehicle = Boolean(
    activeVehicle?.year && 
    activeVehicle?.make && 
    activeVehicle?.model
  );

  return (
    <GarageContext.Provider
      value={{
        garage,
        activeVehicle,
        isLoaded,
        addVehicle,
        removeVehicle,
        setActiveVehicle: setActiveVehicleById,
        setActiveVehicleByData,
        clearActiveVehicle,
        updateNickname,
        isInGarage,
        buildVehicleParams,
        hasCompleteVehicle,
        vehicleCount: garage.length,
        replaceGarage,
      }}
    >
      {children}
    </GarageContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useGarage() {
  const context = useContext(GarageContext);
  if (!context) {
    throw new Error("useGarage must be used within GarageProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility: Format vehicle display string
// ═══════════════════════════════════════════════════════════════════════════════

export function formatGarageVehicle(vehicle: GarageVehicle | null): string {
  if (!vehicle) return "";
  if (vehicle.nickname) return vehicle.nickname;
  const parts = [vehicle.year, vehicle.make, vehicle.model];
  if (vehicle.trim && vehicle.trim !== "Base") {
    parts.push(vehicle.trim);
  }
  return parts.filter(Boolean).join(" ");
}

export function formatVehicleShort(vehicle: GarageVehicle | null): string {
  if (!vehicle) return "";
  if (vehicle.nickname) return vehicle.nickname;
  return `${vehicle.year} ${vehicle.model}`;
}
