/**
 * Wheel-Size API Client
 * https://developer.wheel-size.com/
 * 
 * Used to fetch authoritative vehicle fitment data
 * 
 * IMPORTANT LEARNINGS:
 * - All slugs must be LOWERCASE
 * - search/by_model REQUIRES a modification slug to return data
 * - Modifications are organized by ENGINE TYPE, not trim level (XLT/Lariat/etc)
 * - For US market, filter modifications by region "usdm"
 */

const BASE_URL = "https://api.wheel-size.com/v2/";

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
  name_en?: string;
  regions?: string[];
};

export type WheelSizeModel = {
  slug: string;
  name: string;
  name_en?: string;
  regions?: string[];
  year_ranges?: string[];
};

export type WheelSizeYear = {
  slug: string;
  name: string | number;
};

export type WheelSizeModification = {
  slug: string;
  name: string;
  trim?: string;
  body?: string;
  regions?: string[];
  generation?: {
    name: string;
    slug: string;
    start: number;
    end: number | null;
  };
  engine?: {
    fuel?: string;
    capacity?: string;
    type?: string;
    power?: {
      hp?: number;
      kW?: number;
      PS?: number;
    };
  };
  start_year?: number;
  end_year?: number;
};

export type WheelSizeTechnical = {
  bolt_pattern: string;
  centre_bore: string | number;
  stud_holes: number;
  pcd: number;
  wheel_fasteners?: {
    type?: string;
    thread_size?: string;
  };
  wheel_tightening_torque?: string;
  rear_axis_bolt_pattern?: string;
  rear_axis_centre_bore?: string | number | null;
  rear_axis_stud_holes?: number | null;
  rear_axis_pcd?: number | null;
};

export type WheelSizeWheelSetup = {
  is_stock: boolean;
  showing_fp_only: boolean;
  front: {
    rim: string;
    rim_diameter: number;
    rim_width: number;
    rim_offset: number | null;
    tire: string;
    tire_full?: string;
    tire_pressure?: { bar: number | null; psi: number | null; kPa: number | null } | null;
  };
  rear?: {
    rim: string;
    rim_diameter: number | null;
    rim_width: number | null;
    rim_offset: number | null;
    tire: string;
    tire_full?: string;
    tire_pressure?: { bar: number | null; psi: number | null; kPa: number | null } | null;
  };
};

export type WheelSizeVehicleData = {
  slug: string;
  name: string;
  trim?: string;
  body?: string;
  make: { slug: string; name: string };
  model: { slug: string; name: string };
  generation?: {
    name: string;
    slug: string;
    start: number;
    end: number | null;
  };
  start_year?: number;
  end_year?: number;
  regions?: string[];
  technical?: WheelSizeTechnical;
  wheels?: WheelSizeWheelSetup[];
};

// ─────────────────────────────────────────────────────────────────────────────
// API HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert to Wheel-Size slug format (lowercase, trimmed)
 */
function toSlug(name: string): string {
  return name.toLowerCase().trim();
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", getApiKey());
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }

  const safeUrl = url.toString().replace(/user_key=[^&]+/, "user_key=***");
  console.log(`[wheelSizeApi] GET ${safeUrl}`);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`[wheelSizeApi] Error ${res.status}: ${text.slice(0, 500)}`);
    throw new Error(`Wheel-Size API error: ${res.status} ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error(`[wheelSizeApi] JSON parse error: ${text.slice(0, 500)}`);
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all makes
 */
export async function getMakes(): Promise<WheelSizeMake[]> {
  const data = await apiGet<{ data: WheelSizeMake[] }>("makes/");
  return data.data || [];
}

/**
 * Find a make by name (case-insensitive)
 */
export async function findMake(makeName: string): Promise<WheelSizeMake | null> {
  const makes = await getMakes();
  const needle = toSlug(makeName);
  return makes.find(m => 
    m.slug === needle || 
    m.name.toLowerCase() === needle ||
    m.name_en?.toLowerCase() === needle
  ) || null;
}

/**
 * Get models for a make (pass slug, not display name)
 */
export async function getModels(makeSlug: string): Promise<WheelSizeModel[]> {
  const data = await apiGet<{ data: WheelSizeModel[] }>("models/", { 
    make: toSlug(makeSlug) 
  });
  return data.data || [];
}

/**
 * Find a model by name within a make (case-insensitive, handles hyphen variations)
 */
export async function findModel(makeSlug: string, modelName: string): Promise<WheelSizeModel | null> {
  const models = await getModels(makeSlug);
  const needle = toSlug(modelName);
  const needleNoHyphen = needle.replace(/-/g, "");
  
  return models.find(m => {
    const slug = m.slug?.toLowerCase() || "";
    const name = m.name?.toLowerCase() || "";
    return slug === needle || 
           slug === needleNoHyphen ||
           name === needle ||
           name === needleNoHyphen;
  }) || null;
}

/**
 * Get years for a make/model
 */
export async function getYears(makeSlug: string, modelSlug: string): Promise<number[]> {
  const data = await apiGet<{ data: WheelSizeYear[] }>("years/", { 
    make: toSlug(makeSlug), 
    model: toSlug(modelSlug) 
  });
  return (data.data || []).map(y => 
    typeof y.name === "number" ? y.name : parseInt(String(y.name), 10)
  ).filter(y => !isNaN(y));
}

/**
 * Get modifications (engine/trim variants) for a year/make/model
 */
export async function getModifications(
  makeSlug: string,
  modelSlug: string,
  year: number
): Promise<WheelSizeModification[]> {
  const data = await apiGet<{ data: WheelSizeModification[] }>("modifications/", {
    make: toSlug(makeSlug),
    model: toSlug(modelSlug),
    year: String(year),
  });
  return data.data || [];
}

/**
 * Get modifications filtered for US market (usdm region)
 */
export async function getUSModifications(
  makeSlug: string,
  modelSlug: string,
  year: number
): Promise<WheelSizeModification[]> {
  const mods = await getModifications(makeSlug, modelSlug, year);
  return mods.filter(m => m.regions?.includes("usdm"));
}

/**
 * Get full vehicle data for a specific modification
 * THIS IS THE MAIN FUNCTION FOR GETTING FITMENT DATA
 * 
 * @param makeSlug - lowercase make slug (e.g., "ford")
 * @param modelSlug - lowercase model slug (e.g., "f-150") 
 * @param year - year as number
 * @param modificationSlug - REQUIRED modification slug from getModifications()
 */
export async function getVehicleData(
  makeSlug: string,
  modelSlug: string,
  year: number,
  modificationSlug: string
): Promise<WheelSizeVehicleData | null> {
  if (!modificationSlug) {
    console.error("[wheelSizeApi] getVehicleData requires modificationSlug parameter");
    return null;
  }

  try {
    const data = await apiGet<{ data: WheelSizeVehicleData[] }>("search/by_model/", {
      make: toSlug(makeSlug),
      model: toSlug(modelSlug),
      year: String(year),
      modification: modificationSlug,
    });

    return data.data?.[0] || null;
  } catch (err) {
    console.error("[wheelSizeApi] getVehicleData error:", err);
    return null;
  }
}

/**
 * HIGH-LEVEL: Get all vehicle data for a year/make/model
 * Returns data for all available modifications (engine variants)
 * Optionally filter to US market only
 */
export async function getAllVehicleData(
  make: string,
  model: string,
  year: number,
  options?: { usMarketOnly?: boolean }
): Promise<{
  makeSlug: string;
  modelSlug: string;
  year: number;
  modifications: WheelSizeModification[];
  vehicles: WheelSizeVehicleData[];
}> {
  // Step 1: Resolve make slug
  const foundMake = await findMake(make);
  if (!foundMake) {
    throw new Error(`Make "${make}" not found in Wheel-Size API`);
  }
  const makeSlug = foundMake.slug;

  // Step 2: Resolve model slug
  const foundModel = await findModel(makeSlug, model);
  if (!foundModel) {
    throw new Error(`Model "${model}" not found for make "${make}"`);
  }
  const modelSlug = foundModel.slug;

  // Step 3: Check year exists
  const years = await getYears(makeSlug, modelSlug);
  if (!years.includes(year)) {
    throw new Error(`Year ${year} not available for ${make} ${model}. Available: ${years.slice(0, 10).join(", ")}...`);
  }

  // Step 4: Get modifications
  let modifications = await getModifications(makeSlug, modelSlug, year);
  if (options?.usMarketOnly) {
    modifications = modifications.filter(m => m.regions?.includes("usdm"));
  }

  if (modifications.length === 0) {
    throw new Error(`No modifications found for ${year} ${make} ${model}${options?.usMarketOnly ? " (US market)" : ""}`);
  }

  // Step 5: Fetch vehicle data for each modification
  const vehicles: WheelSizeVehicleData[] = [];
  for (const mod of modifications) {
    const data = await getVehicleData(makeSlug, modelSlug, year, mod.slug);
    if (data) {
      vehicles.push(data);
    }
  }

  return {
    makeSlug,
    modelSlug,
    year,
    modifications,
    vehicles,
  };
}

/**
 * Search by tire size to get potential wheel/tire combinations
 */
export async function searchByTire(tireSize: string): Promise<WheelSizeVehicleData[]> {
  const data = await apiGet<{ data: WheelSizeVehicleData[] }>("search/by_tire/", {
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

  const data = await apiGet<{ data: WheelSizeVehicleData[] }>("search/by_rim/", params);
  return data.data || [];
}
