"use client";

/**
 * useAccessoryFitment Hook
 * 
 * Calculates accessory fitment (lug nuts, hub rings) based on:
 * - Vehicle dbProfile data
 * - Selected wheel specs
 * 
 * Usage:
 *   const { fitment, isLoading, error } = useAccessoryFitment(dbProfile, selectedWheel);
 */

import { useMemo } from "react";
import {
  getAccessoryFitment,
  extractVehicleFitmentData,
  formatThreadSize,
  formatHubRingSpec,
  type AccessoryFitmentResult,
  type VehicleFitmentData,
  type WheelData,
  type LugNutSpec,
  type HubRingSpec,
} from "@/lib/fitment/accessories";
import type { CartAccessoryItem, AccessoryRecommendationState } from "@/lib/cart/accessoryTypes";

export interface DBProfileForAccessories {
  threadSize?: string | null;
  seatType?: string | null;
  centerBoreMm?: number | null;
  boltPattern?: string | null;
}

export interface WheelForAccessories {
  sku: string;
  centerBore?: number;
  seatType?: string;
  boltPattern?: string;
}

export interface UseAccessoryFitmentResult {
  /** Full fitment calculation result */
  fitment: AccessoryFitmentResult | null;
  /** Accessory items ready to add to cart */
  recommendedItems: CartAccessoryItem[];
  /** Required accessories only */
  requiredItems: CartAccessoryItem[];
  /** State object for storing in cart/package */
  state: AccessoryRecommendationState | null;
  /** Whether vehicle data is missing */
  hasVehicleData: boolean;
  /** Human-readable summary */
  summary: {
    lugNuts: string;
    hubRings: string;
  };
}

/**
 * Calculate accessory fitment for a vehicle + wheel combination
 */
export function useAccessoryFitment(
  dbProfile: DBProfileForAccessories | null | undefined,
  wheel: WheelForAccessories | null | undefined
): UseAccessoryFitmentResult {
  return useMemo(() => {
    // No wheel selected
    if (!wheel) {
      return {
        fitment: null,
        recommendedItems: [],
        requiredItems: [],
        state: null,
        hasVehicleData: false,
        summary: {
          lugNuts: "Select a wheel to see lug nut requirements",
          hubRings: "Select a wheel to see hub ring requirements",
        },
      };
    }

    // Extract vehicle data
    const vehicleData = extractVehicleFitmentData(dbProfile || null);
    const hasVehicleData = Boolean(
      vehicleData.threadSize || vehicleData.centerBoreMm
    );

    // Calculate fitment
    const fitment = getAccessoryFitment(vehicleData, {
      sku: wheel.sku,
      centerBore: wheel.centerBore,
      seatType: wheel.seatType,
      boltPattern: wheel.boltPattern,
    });

    // Convert to cart items
    const recommendedItems: CartAccessoryItem[] = [];
    const requiredItems: CartAccessoryItem[] = [];

    // Lug nuts
    if (fitment.lugNuts.status === "required" && fitment.lugNuts.spec) {
      const spec = fitment.lugNuts.spec as LugNutSpec;
      const item: CartAccessoryItem = {
        type: "accessory",
        category: "lug_nut",
        // Placeholder SKU; will be replaced by WheelPros Gorilla kit SKU via server lookup.
        sku: `LUGKIT-${formatThreadSize(spec)}`,
        name: `Standard Lug Kit — Included`,
        unitPrice: 0, // Included
        quantity: 1,
        required: true,
        reason: fitment.lugNuts.reason,
        wheelSku: wheel.sku,
        spec: {
          threadSize: formatThreadSize(spec),
          seatType: spec.seatType,
        },
      };
      recommendedItems.push(item);
      requiredItems.push(item);
    }

    // Hub rings
    if (fitment.hubRings.status === "required" && fitment.hubRings.spec) {
      const spec = fitment.hubRings.spec as HubRingSpec;
      const item: CartAccessoryItem = {
        type: "accessory",
        category: "hub_ring",
        sku: `HR-${spec.outerDiameter.toFixed(0)}-${spec.innerDiameter.toFixed(0)}`,
        name: `Hub Rings — Included (${formatHubRingSpec(spec)})`,
        unitPrice: 0, // Included
        quantity: 1,
        required: true,
        reason: fitment.hubRings.reason,
        wheelSku: wheel.sku,
        spec: {
          outerDiameter: spec.outerDiameter,
          innerDiameter: spec.innerDiameter,
        },
      };
      recommendedItems.push(item);
      requiredItems.push(item);
    }

    // Map status to AccessoryRecommendationState types
    const mapLugStatus = (s: string): "required" | "recommended" | "optional" | "skipped" => {
      if (s === "required" || s === "recommended" || s === "optional" || s === "skipped") return s;
      return "optional";
    };
    const mapHubStatus = (s: string): "required" | "not_needed" | "optional" | "skipped" => {
      if (s === "required" || s === "skipped") return s;
      return "not_needed";
    };

    // Build state object
    const state: AccessoryRecommendationState = {
      wheelSku: wheel.sku,
      lugNuts: {
        status: mapLugStatus(fitment.lugNuts.status),
        reason: fitment.lugNuts.reason,
        items: recommendedItems.filter((i) => i.category === "lug_nut"),
      },
      hubRings: {
        status: mapHubStatus(fitment.hubRings.status),
        reason: fitment.hubRings.reason,
        items: recommendedItems.filter((i) => i.category === "hub_ring"),
      },
      timestamp: fitment.timestamp,
    };

    // Build summary strings
    const summary = {
      lugNuts:
        fitment.lugNuts.status === "required"
          ? `${(fitment.lugNuts.spec as LugNutSpec)?.quantity || 20} ${(fitment.lugNuts.spec as LugNutSpec)?.seatType || "conical"} lug nuts required`
          : fitment.lugNuts.status === "skipped"
            ? "Lug nut info not available for this vehicle"
            : "Lug nuts included",
      hubRings:
        fitment.hubRings.status === "required"
          ? `Hub rings required (${formatHubRingSpec(fitment.hubRings.spec as HubRingSpec)})`
          : fitment.hubRings.status === "optional"
            ? "Hub rings not needed - wheel matches vehicle"
            : "Hub ring info not available",
    };

    console.log("[useAccessoryFitment] Calculated:", {
      wheel: wheel.sku,
      hasVehicleData,
      lugNuts: fitment.lugNuts.status,
      hubRings: fitment.hubRings.status,
      requiredCount: requiredItems.length,
    });

    return {
      fitment,
      recommendedItems,
      requiredItems,
      state,
      hasVehicleData,
      summary,
    };
  }, [dbProfile, wheel]);
}

/**
 * Non-hook version for use in async callbacks
 * (Hooks can't be called inside useEffect/setTimeout)
 */
export function calculateAccessoryFitment(
  dbProfile: DBProfileForAccessories | null | undefined,
  wheel: WheelForAccessories | null | undefined
): UseAccessoryFitmentResult {
  // No wheel selected
  if (!wheel) {
    return {
      fitment: null,
      recommendedItems: [],
      requiredItems: [],
      state: null,
      hasVehicleData: false,
      summary: {
        lugNuts: "Select a wheel to see lug nut requirements",
        hubRings: "Select a wheel to see hub ring requirements",
      },
    };
  }

  // Extract vehicle data
  const vehicleData = extractVehicleFitmentData(dbProfile || null);
  const hasVehicleData = Boolean(
    vehicleData.threadSize || vehicleData.centerBoreMm
  );

  // Calculate fitment
  const fitment = getAccessoryFitment(vehicleData, {
    sku: wheel.sku,
    centerBore: wheel.centerBore,
    seatType: wheel.seatType,
    boltPattern: wheel.boltPattern,
  });

  // Convert to cart items
  const recommendedItems: CartAccessoryItem[] = [];
  const requiredItems: CartAccessoryItem[] = [];

  // Lug nuts (REQUIRED install hardware: included $0 line, real SKU resolved later)
  if (fitment.lugNuts.status === "required" && fitment.lugNuts.spec) {
    const spec = fitment.lugNuts.spec as LugNutSpec;
    const threadLabel = formatThreadSize(spec);
    const item: CartAccessoryItem = {
      type: "accessory",
      category: "lug_nut",
      // Placeholder SKU; will be replaced by WheelPros/Gorilla kit SKU via server lookup.
      sku: `LUGKIT-${threadLabel}`,
      name: `Standard Lug Kit — Included`,
      unitPrice: 0,
      quantity: 1,
      required: true,
      reason: fitment.lugNuts.reason,
      wheelSku: wheel.sku,
      spec: {
        threadSize: threadLabel,
        seatType: spec.seatType,
      },
      meta: {
        placeholder: true,
      },
    };
    recommendedItems.push(item);
    requiredItems.push(item);
  }

  // Hub rings (REQUIRED install hardware: always included $0)
  if (fitment.hubRings.status === "required" && fitment.hubRings.spec) {
    const spec = fitment.hubRings.spec as HubRingSpec;
    const item: CartAccessoryItem = {
      type: "accessory",
      category: "hub_ring",
      sku: `HR-${spec.outerDiameter.toFixed(0)}-${spec.innerDiameter.toFixed(0)}`,
      name: `Hub Rings — Included (${formatHubRingSpec(spec)})`,
      unitPrice: 0,
      quantity: 1,
      required: true,
      reason: fitment.hubRings.reason,
      wheelSku: wheel.sku,
      spec: {
        outerDiameter: spec.outerDiameter,
        innerDiameter: spec.innerDiameter,
      },
      meta: {
        included: true,
      },
    };
    recommendedItems.push(item);
    requiredItems.push(item);
  }

  // Map status to AccessoryRecommendationState types
  const mapLugStatus = (s: string): "required" | "recommended" | "optional" | "skipped" => {
    if (s === "required" || s === "recommended" || s === "optional" || s === "skipped") return s;
    return "optional";
  };
  const mapHubStatus = (s: string): "required" | "not_needed" | "optional" | "skipped" => {
    if (s === "required" || s === "skipped") return s;
    return "not_needed";
  };

  // Build state object
  const state: AccessoryRecommendationState = {
    wheelSku: wheel.sku,
    lugNuts: {
      status: mapLugStatus(fitment.lugNuts.status),
      reason: fitment.lugNuts.reason,
      items: recommendedItems.filter((i) => i.category === "lug_nut"),
    },
    hubRings: {
      status: mapHubStatus(fitment.hubRings.status),
      reason: fitment.hubRings.reason,
      items: recommendedItems.filter((i) => i.category === "hub_ring"),
    },
    timestamp: fitment.timestamp,
  };

  // Build summary strings
  const summary = {
    lugNuts:
      fitment.lugNuts.status === "required"
        ? `${(fitment.lugNuts.spec as LugNutSpec)?.quantity || 20} ${(fitment.lugNuts.spec as LugNutSpec)?.seatType || "conical"} lug nuts required`
        : fitment.lugNuts.status === "skipped"
          ? "Lug nut info not available for this vehicle"
          : "Lug nuts included",
    hubRings:
      fitment.hubRings.status === "required"
        ? `Hub rings required (${formatHubRingSpec(fitment.hubRings.spec as HubRingSpec)})`
        : fitment.hubRings.status === "optional"
          ? "Hub rings not needed - wheel matches vehicle"
          : "Hub ring info not available",
  };

  console.log("[calculateAccessoryFitment] Result:", {
    wheel: wheel.sku,
    hasVehicleData,
    lugNuts: fitment.lugNuts.status,
    hubRings: fitment.hubRings.status,
    requiredCount: requiredItems.length,
  });

  return {
    fitment,
    recommendedItems,
    requiredItems,
    state,
    hasVehicleData,
    summary,
  };
}

export default useAccessoryFitment;
