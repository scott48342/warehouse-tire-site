import pg from "pg";

const { Pool } = pg;

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

let pool: pg.Pool | null = null;
export function getPool() {
  if (pool) return pool;
  pool = new Pool({
    connectionString: required("POSTGRES_URL"),
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  return pool;
}

export type StateTaxRate = {
  stateCode: string;
  stateName: string;
  taxRate: number; // decimal, e.g., 0.06 for 6%
  updatedAt: Date;
};

/**
 * Default state sales tax rates (base state rate only).
 * These are approximate and should be customized in admin.
 * Note: Some states have no sales tax, some have variable local taxes.
 */
export const DEFAULT_STATE_TAX_RATES: Record<string, number> = {
  AL: 0.04,    // Alabama - 4% state (locals add more)
  AK: 0.00,    // Alaska - no state sales tax
  AZ: 0.056,   // Arizona - 5.6%
  AR: 0.065,   // Arkansas - 6.5%
  CA: 0.0725,  // California - 7.25%
  CO: 0.029,   // Colorado - 2.9%
  CT: 0.0635,  // Connecticut - 6.35%
  DE: 0.00,    // Delaware - no sales tax
  DC: 0.06,    // DC - 6%
  FL: 0.06,    // Florida - 6%
  GA: 0.04,    // Georgia - 4%
  HI: 0.04,    // Hawaii - 4% GET
  ID: 0.06,    // Idaho - 6%
  IL: 0.0625,  // Illinois - 6.25%
  IN: 0.07,    // Indiana - 7%
  IA: 0.06,    // Iowa - 6%
  KS: 0.065,   // Kansas - 6.5%
  KY: 0.06,    // Kentucky - 6%
  LA: 0.0445,  // Louisiana - 4.45%
  ME: 0.055,   // Maine - 5.5%
  MD: 0.06,    // Maryland - 6%
  MA: 0.0625,  // Massachusetts - 6.25%
  MI: 0.06,    // Michigan - 6%
  MN: 0.06875, // Minnesota - 6.875%
  MS: 0.07,    // Mississippi - 7%
  MO: 0.04225, // Missouri - 4.225%
  MT: 0.00,    // Montana - no sales tax
  NE: 0.055,   // Nebraska - 5.5%
  NV: 0.0685,  // Nevada - 6.85%
  NH: 0.00,    // New Hampshire - no sales tax
  NJ: 0.06625, // New Jersey - 6.625%
  NM: 0.05125, // New Mexico - 5.125% GRT
  NY: 0.04,    // New York - 4% state (locals add more)
  NC: 0.0475,  // North Carolina - 4.75%
  ND: 0.05,    // North Dakota - 5%
  OH: 0.0575,  // Ohio - 5.75%
  OK: 0.045,   // Oklahoma - 4.5%
  OR: 0.00,    // Oregon - no sales tax
  PA: 0.06,    // Pennsylvania - 6%
  RI: 0.07,    // Rhode Island - 7%
  SC: 0.06,    // South Carolina - 6%
  SD: 0.045,   // South Dakota - 4.5%
  TN: 0.07,    // Tennessee - 7%
  TX: 0.0625,  // Texas - 6.25%
  UT: 0.061,   // Utah - 6.1%
  VT: 0.06,    // Vermont - 6%
  VA: 0.053,   // Virginia - 5.3%
  WA: 0.065,   // Washington - 6.5%
  WV: 0.06,    // West Virginia - 6%
  WI: 0.05,    // Wisconsin - 5%
  WY: 0.04,    // Wyoming - 4%
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/**
 * Ensure the state_tax_rates table exists and is populated with defaults.
 */
export async function ensureStateTaxTable(db: pg.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS state_tax_rates (
      state_code TEXT PRIMARY KEY,
      state_name TEXT NOT NULL,
      tax_rate NUMERIC(6,5) NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Seed with defaults if empty
  const { rows } = await db.query(`SELECT COUNT(*) as count FROM state_tax_rates`);
  if (parseInt(rows[0]?.count || "0") === 0) {
    const values: string[] = [];
    const params: (string | number)[] = [];
    let idx = 1;

    for (const [code, rate] of Object.entries(DEFAULT_STATE_TAX_RATES)) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, NOW())`);
      params.push(code, STATE_NAMES[code] || code, rate);
      idx += 3;
    }

    if (values.length > 0) {
      await db.query({
        text: `INSERT INTO state_tax_rates (state_code, state_name, tax_rate, updated_at) VALUES ${values.join(", ")} ON CONFLICT (state_code) DO NOTHING`,
        values: params,
      });
    }
  }
}

/**
 * Get tax rate for a specific state.
 * Returns 0 if state not found (safe default).
 */
export async function getStateTaxRate(db: pg.Pool, stateCode: string): Promise<number> {
  await ensureStateTaxTable(db);
  const code = stateCode.toUpperCase().trim();
  
  const { rows } = await db.query({
    text: `SELECT tax_rate FROM state_tax_rates WHERE state_code = $1 LIMIT 1`,
    values: [code],
  });

  const rate = Number(rows[0]?.tax_rate);
  return Number.isFinite(rate) ? rate : 0;
}

/**
 * Set tax rate for a specific state.
 */
export async function setStateTaxRate(db: pg.Pool, stateCode: string, taxRate: number): Promise<void> {
  await ensureStateTaxTable(db);
  const code = stateCode.toUpperCase().trim();
  const rate = Number(taxRate);

  if (!Number.isFinite(rate) || rate < 0 || rate > 0.25) {
    throw new Error("Invalid tax rate (must be between 0 and 0.25)");
  }

  const name = STATE_NAMES[code] || code;

  await db.query({
    text: `
      INSERT INTO state_tax_rates (state_code, state_name, tax_rate, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (state_code) DO UPDATE SET
        tax_rate = EXCLUDED.tax_rate,
        updated_at = NOW()
    `,
    values: [code, name, rate],
  });
}

/**
 * List all state tax rates.
 */
export async function listStateTaxRates(db: pg.Pool): Promise<StateTaxRate[]> {
  await ensureStateTaxTable(db);

  const { rows } = await db.query({
    text: `SELECT state_code, state_name, tax_rate, updated_at FROM state_tax_rates ORDER BY state_name ASC`,
    values: [],
  });

  return rows.map((r: any) => ({
    stateCode: r.state_code,
    stateName: r.state_name,
    taxRate: Number(r.tax_rate),
    updatedAt: new Date(r.updated_at),
  }));
}

/**
 * Bulk update multiple state tax rates.
 */
export async function bulkUpdateStateTaxRates(
  db: pg.Pool,
  rates: Array<{ stateCode: string; taxRate: number }>
): Promise<void> {
  await ensureStateTaxTable(db);

  for (const { stateCode, taxRate } of rates) {
    await setStateTaxRate(db, stateCode, taxRate);
  }
}
