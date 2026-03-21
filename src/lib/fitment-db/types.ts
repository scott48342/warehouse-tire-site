/**
 * Shared types for DB-first fitment profile
 * Used by both API and frontend
 */

export interface OEMWheelSize {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize: string | null;
  axle: "front" | "rear" | "both";
  isStock: boolean;
}

// Internal types used by normalize.ts (different structure for import processing)
export interface OemWheelSize {
  diameter: number;
  width: number;
  offset: number;
  is_front: boolean;
  is_rear: boolean;
  is_staggered: boolean;
}

export interface OemTireSize {
  width: number;
  aspect_ratio: number;
  diameter: number;
  load_index: string | null;
  speed_rating: string | null;
  is_front: boolean;
  is_rear: boolean;
}

export interface DBFitmentProfile {
  // Identity
  modificationId: string;
  displayTrim: string;
  
  // Wheel specs
  boltPattern: string | null;
  centerBoreMm: number | null;
  threadSize: string | null;
  seatType: string | null;
  
  // Offset range
  offsetRange: {
    min: number | null;
    max: number | null;
  };
  
  // OEM sizes
  oemWheelSizes: OEMWheelSize[];
  oemTireSizes: string[];
  
  // Source
  source: "db" | "api";
}

/**
 * Response shape from /api/wheels/fitment-search
 */
export interface FitmentSearchResponse {
  results: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  facets: Record<string, any>;
  fitment: {
    mode: string;
    modeAutoDetected: boolean;
    vehicleType?: "truck" | "suv" | "car";
    envelope: {
      boltPattern: string;
      centerBore: number;
      oem: {
        diameter: [number, number];
        width: [number, number];
        offset: [number, number];
      };
      allowed: {
        diameter: [number, number];
        width: [number, number];
        offset: [number, number];
      };
    };
    vehicle: {
      year: number;
      make: string;
      model: string;
      trim?: string;
    };
    staggered?: {
      isStaggered: boolean;
      reason: string;
      frontSpec?: {
        diameter: number;
        width: number;
        offset: number | null;
        tireSize: string | null;
      };
      rearSpec?: {
        diameter: number;
        width: number;
        offset: number | null;
        tireSize: string | null;
      };
    };
    // NEW: DB-first profile (primary source of truth)
    dbProfile?: DBFitmentProfile;
  };
  summary: {
    fromWheelPros: number;
    afterFitmentFilter: number;
    total: number;
    surefit: number;
    specfit: number;
    extended: number;
    excluded: number;
  };
  timing?: {
    totalMs: number;
    profileMs: number;
    envelopeMs: number;
    wpMs: number;
    validateMs: number;
  };
}
