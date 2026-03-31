"use client";

/**
 * Hook to get fitment-valid wheel diameters
 * 
 * For classic vehicles: Uses classic fitment API to get stock + upsize range
 * For modern vehicles: Uses OEM wheel sizes from fitment profile
 */

import { useState, useEffect, useMemo } from "react";
import { buildDiameterOptions, type DiameterOption } from "@/lib/fitment/diameterOptions";

export interface UseFitmentDiametersOptions {
  year?: number | string;
  make?: string;
  model?: string;
  /** OEM wheel sizes from dbProfile */
  oemWheelSizes?: Array<{ diameter?: number; width?: number }>;
  /** Inventory facets from wheel search */
  inventoryFacets?: Array<{ value: string; count?: number }>;
  /** Skip fetching (for SSR or when data is already available) */
  skip?: boolean;
}

export interface UseFitmentDiametersResult {
  /** Diameter options for the vehicle */
  diameters: DiameterOption[];
  /** Whether the vehicle is classic */
  isClassicVehicle: boolean;
  /** Stock wheel diameter */
  stockDiameter: number | null;
  /** Classic upsize range [min, max] */
  classicUpsizeRange: [number, number] | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
}

export function useFitmentDiameters({
  year,
  make,
  model,
  oemWheelSizes = [],
  inventoryFacets = [],
  skip = false,
}: UseFitmentDiametersOptions): UseFitmentDiametersResult {
  const [classicData, setClassicData] = useState<{
    isClassicVehicle: boolean;
    stockDiameter: number | null;
    stockDiameters: number[];
    upsizeRange: [number, number] | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  // Fetch classic fitment data
  useEffect(() => {
    if (skip || !year || !make || !model) {
      setIsLoading(false);
      return;
    }

    const fetchClassicData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          year: String(year),
          make,
          model,
        });

        const res = await fetch(`/api/classic/fitment?${params}`);

        if (res.status === 404) {
          // Not a classic vehicle
          setClassicData({
            isClassicVehicle: false,
            stockDiameter: null,
            stockDiameters: [],
            upsizeRange: null,
          });
          return;
        }

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        if (data.isClassicVehicle) {
          // Extract stock diameter from stock reference
          const stockRef = data.stockReference;
          let stockDia: number | null = null;
          const stockDiameters: number[] = [];

          if (stockRef?.wheelDiameter) {
            stockDia = stockRef.wheelDiameter;
            stockDiameters.push(stockRef.wheelDiameter);
          }

          // Get recommended range
          const recRange = data.recommendedRange?.diameter;
          const upsizeRange: [number, number] = [
            recRange?.min ?? 15,
            Math.max(recRange?.max ?? 18, 20), // Extend to 20" for classics
          ];

          setClassicData({
            isClassicVehicle: true,
            stockDiameter: stockDia,
            stockDiameters,
            upsizeRange,
          });
        } else {
          setClassicData({
            isClassicVehicle: false,
            stockDiameter: null,
            stockDiameters: [],
            upsizeRange: null,
          });
        }
      } catch (err: any) {
        console.error("[useFitmentDiameters] Error:", err);
        setError(err?.message || "Failed to fetch fitment data");
        setClassicData({
          isClassicVehicle: false,
          stockDiameter: null,
          stockDiameters: [],
          upsizeRange: null,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassicData();
  }, [year, make, model, skip]);

  // Build diameter options
  const result = useMemo((): UseFitmentDiametersResult => {
    const isClassic = classicData?.isClassicVehicle ?? false;
    
    // Extract OEM diameters from wheel sizes
    const oemDiameters: number[] = [];
    for (const size of oemWheelSizes) {
      if (size.diameter && Number.isFinite(size.diameter)) {
        const dia = Math.round(size.diameter);
        if (!oemDiameters.includes(dia)) {
          oemDiameters.push(dia);
        }
      }
    }

    // Determine stock diameters
    const stockDiameters = isClassic
      ? classicData?.stockDiameters ?? []
      : oemDiameters.length > 0
        ? [Math.min(...oemDiameters)] // Smallest OEM is typically "stock"
        : [];

    const diameters = buildDiameterOptions({
      isClassicVehicle: isClassic,
      stockDiameters,
      classicUpsizeRange: classicData?.upsizeRange ?? undefined,
      oemWheelSizes,
      inventoryFacets,
    });

    return {
      diameters,
      isClassicVehicle: isClassic,
      stockDiameter: classicData?.stockDiameter ?? (stockDiameters[0] ?? null),
      classicUpsizeRange: classicData?.upsizeRange ?? null,
      isLoading,
      error,
    };
  }, [classicData, oemWheelSizes, inventoryFacets, isLoading, error]);

  return result;
}

export default useFitmentDiameters;
