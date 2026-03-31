/**
 * SEO Types
 * 
 * Shared types for SEO page generation
 */

export type ProductType = "wheels" | "tires" | "packages";

export interface VehicleParams {
  year: string;
  make: string;
  model: string;
  trim?: string[];  // Optional catch-all for trim
}

export interface ResolvedVehicle {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  displayMake: string;
  displayModel: string;
  displayTrim: string | null;
}

export interface FitmentFacts {
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  offsetRange: { min: number; max: number } | null;
  oemWheelDiameters: number[];
  oemTireSizes: string[];
  hasStaggered: boolean;
}

export interface SEOPageData {
  vehicle: ResolvedVehicle;
  fitment: FitmentFacts | null;
  productType: ProductType;
  hasResults: boolean;
  resultCount: number;
  canonical: string;
}

export interface TopVehicle {
  year: number;
  make: string;
  model: string;
  priority: number; // 0.0 - 1.0
}
