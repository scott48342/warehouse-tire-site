"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export type BuildVehicle = {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
};

export type BuildWheel = {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  finish?: string;
  diameter: string;
  width: string;
  rearWidth?: string;
  offset?: string;
  rearOffset?: string;
  boltPattern?: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number;
  fitmentClass?: "surefit" | "specfit" | "extended";
  staggered?: boolean;
};

export type BuildTire = {
  sku: string;
  rearSku?: string;
  brand: string;
  model: string;
  size: string;
  rearSize?: string;
  imageUrl?: string;
  unitPrice: number;
  setPrice: number;
  loadIndex?: string;
  speedRating?: string;
  staggered?: boolean;
};

export type BuildStep = "vehicle" | "wheels" | "tires" | "review";

export type BuildState = {
  step: BuildStep;
  vehicle: BuildVehicle | null;
  wheel: BuildWheel | null;
  tire: BuildTire | null;
  // Accessory estimates
  tpmsIncluded: boolean;
  hardwareIncluded: boolean;
  mountBalanceIncluded: boolean;
};

type BuildContextType = {
  state: BuildState;
  // Actions
  setVehicle: (vehicle: BuildVehicle) => void;
  setWheel: (wheel: BuildWheel) => void;
  setTire: (tire: BuildTire) => void;
  goToStep: (step: BuildStep) => void;
  clearWheel: () => void;
  clearTire: () => void;
  reset: () => void;
  // Computed
  totalPrice: number;
  monthlyPrice: number;
  savingsEstimate: number;
  isComplete: boolean;
};

// ============================================================================
// Initial State
// ============================================================================

const initialState: BuildState = {
  step: "vehicle",
  vehicle: null,
  wheel: null,
  tire: null,
  tpmsIncluded: true,
  hardwareIncluded: true,
  mountBalanceIncluded: true,
};

// ============================================================================
// Context
// ============================================================================

const BuildContext = createContext<BuildContextType | null>(null);

export function useBuild() {
  const context = useContext(BuildContext);
  if (!context) {
    throw new Error("useBuild must be used within a BuildProvider");
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function BuildProvider({ 
  children,
  initialVehicle,
}: { 
  children: ReactNode;
  initialVehicle?: BuildVehicle;
}) {
  const [state, setState] = useState<BuildState>(() => ({
    ...initialState,
    vehicle: initialVehicle || null,
    step: initialVehicle ? "wheels" : "vehicle",
  }));

  // Actions
  const setVehicle = useCallback((vehicle: BuildVehicle) => {
    setState(prev => ({
      ...prev,
      vehicle,
      step: "wheels",
      // Reset downstream selections when vehicle changes
      wheel: null,
      tire: null,
    }));
  }, []);

  const setWheel = useCallback((wheel: BuildWheel) => {
    setState(prev => ({
      ...prev,
      wheel,
      step: "tires",
      // Reset tire when wheel changes (tire needs to match wheel)
      tire: null,
    }));
  }, []);

  const setTire = useCallback((tire: BuildTire) => {
    setState(prev => ({
      ...prev,
      tire,
      step: "review",
    }));
  }, []);

  const goToStep = useCallback((step: BuildStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const clearWheel = useCallback(() => {
    setState(prev => ({
      ...prev,
      wheel: null,
      tire: null,
      step: "wheels",
    }));
  }, []);

  const clearTire = useCallback(() => {
    setState(prev => ({
      ...prev,
      tire: null,
      step: "tires",
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  // Computed values
  const wheelTotal = state.wheel?.setPrice || 0;
  const tireTotal = state.tire?.setPrice || 0;
  const tpmsEstimate = state.tpmsIncluded ? 280 : 0; // $70/sensor × 4
  const mountBalanceEstimate = state.mountBalanceIncluded ? 80 : 0;
  
  const totalPrice = wheelTotal + tireTotal + tpmsEstimate + mountBalanceEstimate;
  const monthlyPrice = totalPrice > 0 ? Math.round(totalPrice / 24) : 0;
  
  // Savings estimate: typical shop markup is ~20-30%
  const typicalRetailPrice = Math.round(totalPrice * 1.25);
  const savingsEstimate = typicalRetailPrice - totalPrice;
  
  const isComplete = !!(state.vehicle && state.wheel && state.tire);

  const value: BuildContextType = {
    state,
    setVehicle,
    setWheel,
    setTire,
    goToStep,
    clearWheel,
    clearTire,
    reset,
    totalPrice,
    monthlyPrice,
    savingsEstimate,
    isComplete,
  };

  return (
    <BuildContext.Provider value={value}>
      {children}
    </BuildContext.Provider>
  );
}
