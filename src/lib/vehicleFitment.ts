/**
 * Vehicle Fitment Engine
 * Uses Wheel-Size API data as source of truth for strict wheel validation
 */
import pg from "pg";

const { Pool } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Vehicle = {
  id: number;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  slug: string | null; // Wheel-Size modification slug
  createdAt: Date;
  updatedAt: Date;
};

export type VehicleFitment = {
  id: number;
  vehicleId: number;
  boltPattern: string;       // e.g., "6x135"
  centerBore: number;        // mm, e.g., 87.1
  studHoles: number;         // e.g., 6
  pcd: number;               // mm, e.g., 135
  threadSize: string | null; // e.g., "M14x1.5"
  fastenerType: string | null; // "lug_nut" | "lug_bolt"
  torqueNm: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VehicleWheelSpec = {
  id: number;
  vehicleId: number;
  rimDiameter: number;       // inches, e.g., 17
  rimWidth: number;          // inches, e.g., 7.5
  offset: number | null;     // mm, e.g., 44 (can be null for some plus sizes)
  tireSize: string | null;   // e.g., "265/70R17"
  isStock: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FitmentProfile = {
  vehicle: Vehicle;
  fitment: VehicleFitment;
  wheelSpecs: VehicleWheelSpec[];
  // Derived allowed values
  allowedDiameters: number[];
  allowedWidths: number[];
  allowedOffsets: number[];
  boltPattern: string;
  centerBore: number;
};

export type FitmentClass = "surefit" | "specfit" | "excluded";

export type WheelValidation = {
  sku: string;
  boltPatternPass: boolean;
  centerBorePass: boolean;
  diameterPass: boolean;
  widthPass: boolean;
  offsetPass: boolean;
  fitmentClass: FitmentClass;
  exclusionReasons: string[];
};

export type WheelToValidate = {
  sku: string;
  boltPattern?: string;
  centerBore?: number;
  diameter?: number;
  width?: number;
  offset?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE CONNECTION
// ─────────────────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
  return pool;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureFitmentTables(db: pg.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      make VARCHAR(100) NOT NULL,
      model VARCHAR(100) NOT NULL,
      trim VARCHAR(100),
      search_trim VARCHAR(100),
      slug VARCHAR(255), -- Wheel-Size modification slug
      market_regions VARCHAR(255),
      imported_from VARCHAR(50),
      imported_at TIMESTAMP WITH TIME ZONE,
      import_status VARCHAR(20),
      last_import_error TEXT,
      last_import_attempt_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(year, make, model, trim)
    );

    CREATE TABLE IF NOT EXISTS vehicle_fitment (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      bolt_pattern VARCHAR(20) NOT NULL,
      center_bore DECIMAL(6,2) NOT NULL,
      stud_holes INTEGER NOT NULL,
      pcd DECIMAL(6,2) NOT NULL,
      thread_size VARCHAR(20),
      fastener_type VARCHAR(20),
      torque_nm INTEGER,
      imported_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(vehicle_id)
    );

    CREATE TABLE IF NOT EXISTS vehicle_wheel_specs (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      rim_diameter DECIMAL(4,1) NOT NULL,
      rim_width DECIMAL(4,2) NOT NULL,
      "offset" INTEGER,
      tire_size VARCHAR(30),
      is_stock BOOLEAN DEFAULT true,
      imported_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_year_make_model ON vehicles(year, make, model);
    CREATE INDEX IF NOT EXISTS idx_vehicles_year_make_model_slug ON vehicles(year, make, model, slug);
    CREATE INDEX IF NOT EXISTS idx_vehicle_wheel_specs_vehicle_id ON vehicle_wheel_specs(vehicle_id);

    -- Allow NULL offset for existing tables
    ALTER TABLE vehicle_wheel_specs ALTER COLUMN "offset" DROP NOT NULL;

    -- Add missing columns for existing deployments (safe no-ops if present)
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS search_trim VARCHAR(100);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS market_regions VARCHAR(255);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS imported_from VARCHAR(50);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS import_status VARCHAR(20);
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_import_error TEXT;
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_import_attempt_at TIMESTAMP WITH TIME ZONE;

    ALTER TABLE vehicle_fitment ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE vehicle_wheel_specs ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE;

    -- Ensure uniqueness for caching: year/make/model/modification_slug (vehicles.slug)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_year_make_model_slug_unique'
      ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_year_make_model_slug_unique UNIQUE (year, make, model, slug);
      END IF;
    END$$;
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertVehicle(
  db: pg.Pool,
  data: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    searchTrim?: string;
    slug?: string; // modification slug
    marketRegions?: string[];
    importedFrom?: string;
    importedAt?: Date;
    importStatus?: "pending" | "success" | "failed";
    lastImportError?: string;
    lastImportAttemptAt?: Date;
  }
): Promise<Vehicle> {
  // Prefer caching by (year, make, model, slug) when slug is present.
  // Fallback to legacy unique (year, make, model, trim) if slug is null.
  const marketRegions = data.marketRegions?.length ? data.marketRegions.join(",") : null;

  if (data.slug) {
    const result = await db.query<Vehicle>(
      `INSERT INTO vehicles (year, make, model, trim, search_trim, slug, market_regions, imported_from, imported_at, import_status, last_import_error, last_import_attempt_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), $10, $11, COALESCE($12, NOW()), NOW())
       ON CONFLICT (year, make, model, slug)
       DO UPDATE SET 
         trim = COALESCE($4, vehicles.trim),
         search_trim = COALESCE($5, vehicles.search_trim),
         market_regions = COALESCE($7, vehicles.market_regions),
         imported_from = COALESCE($8, vehicles.imported_from),
         imported_at = COALESCE(vehicles.imported_at, $9, NOW()),
         import_status = COALESCE($10, vehicles.import_status),
         last_import_error = $11,
         last_import_attempt_at = COALESCE($12, NOW()),
         updated_at = NOW()
       RETURNING id, year, make, model, trim, slug, created_at, updated_at`,
      [
        data.year,
        data.make,
        data.model,
        data.trim || null,
        // search_trim: what the user selected (e.g., XLT)
        data.searchTrim || null,
        data.slug,
        marketRegions,
        data.importedFrom || null,
        data.importedAt || null,
        data.importStatus || null,
        data.lastImportError || null,
        data.lastImportAttemptAt || null,
      ]
    );
    return result.rows[0];
  }

  const result = await db.query<Vehicle>(
    `INSERT INTO vehicles (year, make, model, trim, search_trim, slug, market_regions, imported_from, imported_at, import_status, last_import_error, last_import_attempt_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), $10, $11, COALESCE($12, NOW()), NOW())
     ON CONFLICT (year, make, model, trim) 
     DO UPDATE SET 
       search_trim = COALESCE($5, vehicles.search_trim),
       slug = COALESCE($6, vehicles.slug),
       market_regions = COALESCE($7, vehicles.market_regions),
       imported_from = COALESCE($8, vehicles.imported_from),
       imported_at = COALESCE(vehicles.imported_at, $9, NOW()),
       import_status = COALESCE($10, vehicles.import_status),
       last_import_error = $11,
       last_import_attempt_at = COALESCE($12, NOW()),
       updated_at = NOW()
     RETURNING id, year, make, model, trim, slug, created_at, updated_at`,
    [
      data.year,
      data.make,
      data.model,
      data.trim || null,
      data.searchTrim || null,
      data.slug || null,
      marketRegions,
      data.importedFrom || null,
      data.importedAt || null,
      data.importStatus || null,
      data.lastImportError || null,
      data.lastImportAttemptAt || null,
    ]
  );
  return result.rows[0];
}

export async function getVehicle(
  db: pg.Pool,
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<Vehicle | null> {
  const result = await db.query<Vehicle>(
    `SELECT id, year, make, model, trim, slug, created_at, updated_at
     FROM vehicles
     WHERE year = $1 AND make = $2 AND model = $3 
       AND (
         $4::text IS NULL OR -- no trim specified = match any
         trim = $4 OR 
         search_trim = $4
       )
     ORDER BY imported_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [year, make, model, trim ?? null]
  );
  return result.rows[0] || null;
}

export async function getVehicleBySlug(
  db: pg.Pool,
  year: number,
  make: string,
  model: string,
  slug: string
): Promise<Vehicle | null> {
  const result = await db.query<Vehicle>(
    `SELECT id, year, make, model, trim, slug, created_at, updated_at
     FROM vehicles
     WHERE year = $1 AND make = $2 AND model = $3 AND slug = $4
     ORDER BY imported_at DESC NULLS LAST, updated_at DESC
     LIMIT 1`,
    [year, make, model, slug]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FITMENT CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function upsertVehicleFitment(
  db: pg.Pool,
  vehicleId: number,
  data: {
    boltPattern: string;
    centerBore: number;
    studHoles: number;
    pcd: number;
    threadSize?: string;
    fastenerType?: string;
    torqueNm?: number;
  }
): Promise<VehicleFitment> {
  const result = await db.query<VehicleFitment>(
    `INSERT INTO vehicle_fitment (vehicle_id, bolt_pattern, center_bore, stud_holes, pcd, thread_size, fastener_type, torque_nm, imported_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), NOW())
     ON CONFLICT (vehicle_id)
     DO UPDATE SET 
       bolt_pattern = $2, center_bore = $3, stud_holes = $4, pcd = $5,
       thread_size = $6, fastener_type = $7, torque_nm = $8,
       imported_at = COALESCE(vehicle_fitment.imported_at, $9, NOW()),
       updated_at = NOW()
     RETURNING *`,
    [
      vehicleId,
      data.boltPattern,
      data.centerBore,
      data.studHoles,
      data.pcd,
      data.threadSize || null,
      data.fastenerType || null,
      data.torqueNm || null,
      new Date(),
    ]
  );
  return result.rows[0];
}

export async function getVehicleFitment(db: pg.Pool, vehicleId: number): Promise<VehicleFitment | null> {
  const result = await db.query<VehicleFitment>(
    `SELECT id, vehicle_id as "vehicleId", bolt_pattern as "boltPattern", 
            center_bore as "centerBore", stud_holes as "studHoles", pcd,
            thread_size as "threadSize", fastener_type as "fastenerType", 
            torque_nm as "torqueNm", created_at as "createdAt", updated_at as "updatedAt"
     FROM vehicle_fitment WHERE vehicle_id = $1`,
    [vehicleId]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WHEEL SPECS CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function clearVehicleWheelSpecs(db: pg.Pool, vehicleId: number): Promise<void> {
  await db.query(`DELETE FROM vehicle_wheel_specs WHERE vehicle_id = $1`, [vehicleId]);
}

export async function insertVehicleWheelSpec(
  db: pg.Pool,
  vehicleId: number,
  spec: {
    rimDiameter: number;
    rimWidth: number;
    offset: number | null | undefined;
    tireSize?: string;
    isStock?: boolean;
  }
): Promise<VehicleWheelSpec> {
  const result = await db.query<VehicleWheelSpec>(
    `INSERT INTO vehicle_wheel_specs (vehicle_id, rim_diameter, rim_width, "offset", tire_size, is_stock, imported_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))
     RETURNING *`,
    [
      vehicleId,
      spec.rimDiameter,
      spec.rimWidth,
      spec.offset ?? null,
      spec.tireSize || null,
      spec.isStock ?? true,
      new Date(),
    ]
  );
  return result.rows[0];
}

export async function getVehicleWheelSpecs(db: pg.Pool, vehicleId: number): Promise<VehicleWheelSpec[]> {
  const result = await db.query<VehicleWheelSpec>(
    `SELECT id, vehicle_id as "vehicleId", rim_diameter as "rimDiameter", 
            rim_width as "rimWidth", "offset", tire_size as "tireSize", 
            is_stock as "isStock", created_at as "createdAt", updated_at as "updatedAt"
     FROM vehicle_wheel_specs WHERE vehicle_id = $1`,
    [vehicleId]
  );
  return result.rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3: BUILD FITMENT PROFILE (RUNTIME)
// ─────────────────────────────────────────────────────────────────────────────

export async function buildFitmentProfile(
  db: pg.Pool,
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<FitmentProfile | null> {
  const vehicle = await getVehicle(db, year, make, model, trim);
  if (!vehicle) return null;

  const fitment = await getVehicleFitment(db, vehicle.id);
  if (!fitment) return null;

  const wheelSpecs = await getVehicleWheelSpecs(db, vehicle.id);

  // Derive unique allowed values from wheel specs
  const allowedDiameters = [...new Set(wheelSpecs.map((s) => Number(s.rimDiameter)))].sort((a, b) => a - b);
  const allowedWidths = [...new Set(wheelSpecs.map((s) => Number(s.rimWidth)))].sort((a, b) => a - b);
  const allowedOffsets = [...new Set(wheelSpecs.map((s) => Number(s.offset)))].sort((a, b) => a - b);

  return {
    vehicle,
    fitment,
    wheelSpecs,
    allowedDiameters,
    allowedWidths,
    allowedOffsets,
    boltPattern: fitment.boltPattern,
    centerBore: Number(fitment.centerBore),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 & 5: VALIDATE WHEEL & CLASSIFY FITMENT
// ─────────────────────────────────────────────────────────────────────────────

export function evaluateWheel(wheel: WheelToValidate, profile: FitmentProfile): WheelValidation {
  const exclusionReasons: string[] = [];

  // Normalize bolt patterns for comparison (e.g., "6X135" vs "6x135")
  const normalizeBoltPattern = (bp: string) => bp.toUpperCase().replace(/\s/g, "");
  
  // Handle multi-drill patterns (e.g., "6X135/6X139.7")
  const wheelBoltPatterns = (wheel.boltPattern || "").split("/").map(normalizeBoltPattern);
  const vehicleBoltPattern = normalizeBoltPattern(profile.boltPattern);
  
  const boltPatternPass = wheelBoltPatterns.some((wbp) => wbp === vehicleBoltPattern);
  if (!boltPatternPass) {
    exclusionReasons.push(`Bolt pattern mismatch: wheel=${wheel.boltPattern}, vehicle=${profile.boltPattern}`);
  }

  // Center bore: wheel must be >= vehicle hub
  const centerBorePass = wheel.centerBore != null && wheel.centerBore >= profile.centerBore - 0.5;
  if (!centerBorePass) {
    exclusionReasons.push(`Center bore too small: wheel=${wheel.centerBore}, vehicle=${profile.centerBore}`);
  }

  // Diameter must be in allowed list
  const diameterPass = wheel.diameter != null && profile.allowedDiameters.includes(wheel.diameter);
  if (!diameterPass) {
    exclusionReasons.push(`Diameter not allowed: wheel=${wheel.diameter}, allowed=${profile.allowedDiameters.join(",")}`);
  }

  // Width: if allowed list is empty, skip check; otherwise must match
  const widthPass = profile.allowedWidths.length === 0 || 
    (wheel.width != null && profile.allowedWidths.some((w) => Math.abs(w - wheel.width!) < 0.1));
  if (!widthPass) {
    exclusionReasons.push(`Width not allowed: wheel=${wheel.width}, allowed=${profile.allowedWidths.join(",")}`);
  }

  // Offset: if allowed list is empty, skip check; otherwise must match (with small tolerance)
  const OFFSET_TOLERANCE = 5; // mm
  const offsetPass = profile.allowedOffsets.length === 0 ||
    (wheel.offset != null && profile.allowedOffsets.some((o) => Math.abs(o - wheel.offset!) <= OFFSET_TOLERANCE));
  if (!offsetPass) {
    exclusionReasons.push(`Offset not allowed: wheel=${wheel.offset}, allowed=${profile.allowedOffsets.join(",")} (±${OFFSET_TOLERANCE}mm)`);
  }

  // Determine fitment class
  let fitmentClass: FitmentClass;
  if (exclusionReasons.length > 0) {
    fitmentClass = "excluded";
  } else if (
    wheel.boltPattern != null &&
    wheel.centerBore != null &&
    wheel.diameter != null &&
    wheel.width != null &&
    wheel.offset != null
  ) {
    fitmentClass = "surefit";
  } else {
    fitmentClass = "specfit";
  }

  return {
    sku: wheel.sku,
    boltPatternPass,
    centerBorePass,
    diameterPass,
    widthPass,
    offsetPass,
    fitmentClass,
    exclusionReasons,
  };
}

/**
 * Validate a batch of wheels against a fitment profile
 * Returns only passing wheels with their validation data attached
 */
export function validateWheels(
  wheels: WheelToValidate[],
  profile: FitmentProfile,
  options: { debug?: boolean } = {}
): Array<WheelToValidate & { validation: WheelValidation }> {
  const results: Array<WheelToValidate & { validation: WheelValidation }> = [];

  for (const wheel of wheels) {
    const validation = evaluateWheel(wheel, profile);

    if (options.debug) {
      console.log(`[fitment] ${wheel.sku}:`, validation);
    }

    // Only include non-excluded wheels
    if (validation.fitmentClass !== "excluded") {
      results.push({ ...wheel, validation });
    }
  }

  return results;
}
