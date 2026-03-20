/**
 * Wheel-Size API Client
 * https://developer.wheel-size.com/
 * 
 * Used to fetch authoritative vehicle fitment data
 */

const BASE_URL = "https://api.wheel-size.com/v2";

function getApiKey(): string {
  const key = process.env.WHEELSIZE_API_KEY;
  if (!key) throw new Error("Missing WHEELSIZE_API_KEY environment variable");
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES (based on Wheel-Size API responses)
// ─────────────────────────────────────────────────────────────────────────────

export type WheelSizeMake = {
  slug: string;
  name: string;
};

export type WheelSizeModel = {
  slug: string;
  name: string;
};

export type WheelSizeYear = {
  slug: string;
  name: string; // year as string
};

export type WheelSizeModification = {
  slug: string;
  name: string;
  trim?: string;
  generation?: {
    name: string;
    slug: string;
    start_year: number;
    end_year: number | null;
  };
  body?: string;
  engine?: {
    power_hp?: number;
    fuel?: string;
  };
};

export type WheelSizeWheelSetup = {
  showing_fp_only: boolean;
  is_stock: boolean;
  front: {
    tire: string;           // e.g., "265/70R17"
    tire_pressure: { kpa: number | null; psi: number | null; bar: number | null } | null;
    rim: string;            // e.g., "7.5Jx17 ET44"
    rim_diameter: number;   // e.g., 17
    rim_width: number;      // e.g., 7.5
    rim_offset: number;     // e.g., 44
  };
  rear?: {
    tire: string;
    tire_pressure: { kpa: number | null; psi: number | null; bar: number | null } | null;
    rim: string;
    rim_diameter: number;
    rim_width: number;
    rim_offset: number;
  };
};

export type WheelSizeTechnical = {
  bolt_pattern: string;         // e.g., "6x135"
  centre_bore: number;          // e.g., 87.1
  stud_holes: number;           // e.g., 6
  pcd: number;                  // e.g., 135
  thread_size?: string;         // e.g., "M14x1.5"
  fastener_type?: string;       // "lug_nut" | "lug_bolt"
  wheel_tightening_torque?: number; // Nm
};

export type WheelSizeVehicleData = {
  slug: string;
  market: string;
  body: string;
  make: WheelSizeMake;
  model: WheelSizeModel;
  generation: {
    name: string;
    slug: string;
    start_year: number;
    end_year: number | null;
  };
  years: number[];
  trim?: string;
  technical?: WheelSizeTechnical;
  wheels?: WheelSizeWheelSetup[];
};

// ─────────────────────────────────────────────────────────────────────────────
// API CALLS
// ─────────────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wheel-Size API error: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Get all makes
 */
export async function getMakes(): Promise<WheelSizeMake[]> {
  const data = await apiGet<{ data: WheelSizeMake[] }>("/makes/");
  return data.data || [];
}

/**
 * Get models for a make
 */
export async function getModels(make: string): Promise<WheelSizeModel[]> {
  const data = await apiGet<{ data: WheelSizeModel[] }>("/models/", { make });
  return data.data || [];
}

/**
 * Get years for a make/model
 */
export async function getYears(make: string, model: string): Promise<WheelSizeYear[]> {
  const data = await apiGet<{ data: WheelSizeYear[] }>("/years/", { make, model });
  return data.data || [];
}

/**
 * Get modifications (trims) for a year/make/model
 */
export async function getModifications(
  make: string,
  model: string,
  year: number
): Promise<WheelSizeModification[]> {
  const data = await apiGet<{ data: WheelSizeModification[] }>("/modifications/", {
    make,
    model,
    year: String(year),
  });
  return data.data || [];
}

/**
 * Get full vehicle data including technical specs and wheel setups
 * This is the main call for importing fitment data
 */
export async function getVehicleData(
  make: string,
  model: string,
  year: number,
  modification?: string
): Promise<WheelSizeVehicleData | null> {
  try {
    const params: Record<string, string> = {
      make,
      model,
      year: String(year),
    };
    if (modification) params.modification = modification;

    const data = await apiGet<{ data: WheelSizeVehicleData[] }>("/search/by_model/", params);
    
    // Return first matching result
    return data.data?.[0] || null;
  } catch (err) {
    console.error("[wheelSizeApi] getVehicleData error:", err);
    return null;
  }
}

/**
 * Search by tire size to get potential wheel/tire combinations
 */
export async function searchByTire(tireSize: string): Promise<WheelSizeVehicleData[]> {
  const data = await apiGet<{ data: WheelSizeVehicleData[] }>("/search/by_tire/", {
    tire: tireSize,
  });
  return data.data || [];
}

/**
 * Search by rim size to get potential vehicles that use it
 */
export async function searchByRim(
  diameter: number,
  width: number,
  offset?: number
): Promise<WheelSizeVehicleData[]> {
  const params: Record<string, string> = {
    diameter: String(diameter),
    width: String(width),
  };
  if (offset !== undefined) params.offset = String(offset);

  const data = await apiGet<{ data: WheelSizeVehicleData[] }>("/search/by_rim/", params);
  return data.data || [];
}
