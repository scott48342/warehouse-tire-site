"use client";

/**
 * Hook for fetching classic fitment data
 * 
 * Use this hook to check if a vehicle is classic and get its fitment data.
 * Returns null for modern vehicles.
 * 
 * USAGE:
 * ```tsx
 * const { classicData, isLoading, isClassic } = useClassicFitment({
 *   year: 1969,
 *   make: "Chevrolet",
 *   model: "Camaro"
 * });
 * 
 * if (isClassic && classicData) {
 *   return <ClassicModeSection vehicleName="1969 Chevrolet Camaro" classicData={classicData} />;
 * }
 * ```
 */

import { useState, useEffect } from "react";
import type { ClassicApiResponse } from "@/components/classic/ClassicModeSection";

export interface UseClassicFitmentOptions {
  year: number;
  make: string;
  model: string;
  /** Skip the fetch (useful for conditional loading) */
  skip?: boolean;
}

export interface UseClassicFitmentResult {
  /** Classic API response (null for modern vehicles) */
  classicData: ClassicApiResponse | null;
  /** Whether the request is in progress */
  isLoading: boolean;
  /** Whether this is a classic vehicle */
  isClassic: boolean;
  /** Error message if request failed */
  error: string | null;
}

export function useClassicFitment({
  year,
  make,
  model,
  skip = false,
}: UseClassicFitmentOptions): UseClassicFitmentResult {
  const [classicData, setClassicData] = useState<ClassicApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(!skip);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (skip || !year || !make || !model) {
      setIsLoading(false);
      return;
    }

    const fetchClassicFitment = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          year: String(year),
          make,
          model,
        });

        const response = await fetch(`/api/classic/fitment?${params}`);

        if (response.status === 404) {
          // Not a classic vehicle - this is expected for modern vehicles
          setClassicData(null);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data: ClassicApiResponse = await response.json();

        if (data.isClassicVehicle) {
          setClassicData(data);
        } else {
          setClassicData(null);
        }
      } catch (err: any) {
        console.error("[useClassicFitment] Error:", err);
        setError(err?.message || "Failed to fetch classic fitment data");
        setClassicData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClassicFitment();
  }, [year, make, model, skip]);

  return {
    classicData,
    isLoading,
    isClassic: classicData?.isClassicVehicle === true,
    error,
  };
}

/**
 * Server-side function to fetch classic fitment data
 * For use in server components and generateMetadata
 * 
 * NOTE: This is a wrapper around getClassicFitment from classicLookup.
 * Import directly from classicLookup for server components.
 */
export async function fetchClassicFitmentServer(
  year: number,
  make: string,
  model: string
): Promise<ClassicApiResponse | null> {
  try {
    // Import server-side lookup function
    const { getClassicFitment } = await import("./classicLookup");
    
    const result = await getClassicFitment(year, make, model);
    
    if (!result || !result.isClassicVehicle) {
      return null;
    }
    
    return result as ClassicApiResponse;
  } catch (err) {
    console.error("[fetchClassicFitmentServer] Error:", err);
    return null;
  }
}

export default useClassicFitment;
