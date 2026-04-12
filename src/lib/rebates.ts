import pg from "pg";

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type SiteRebate = {
  id: string;
  source: string;
  brand: string | null;
  headline: string;
  learn_more_url: string | null;
  form_url: string | null;
  ends_text: string | null;
  expires_at: string | null;
  enabled: boolean;
  updated_at: string;
  // Extended fields for precise targeting
  rebate_amount: string | null;           // "$80" or "Up to $100"
  rebate_type: string | null;             // "mail-in", "instant"
  eligible_skus: string[] | null;         // Exact SKU matches
  eligible_models: string[] | null;       // Model name patterns (case-insensitive)
  eligible_sizes: string[] | null;        // Tire sizes
  brand_wide: boolean;                    // If true, applies to all brand tires (only when no SKUs/models/sizes)
  requirements: string | null;            // "Set of 4 tires required"
  start_date: string | null;              // When rebate starts
  internal_notes: string | null;          // Admin notes
};

export type TireForRebateMatch = {
  sku: string;
  brand: string;
  model: string;
  size: string;
};

export type RebateMatch = {
  rebate: SiteRebate;
  matchType: "sku" | "model" | "brand-wide";
};

export const REBATE_SOURCE_TIRERACK = "tirerack";
export const REBATE_SOURCE_DISCOUNTTIRE = "discounttire";

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

// ════════════════════════════════════════════════════════════════════════════════
// DATE PARSING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Parse end date from text like "March 1 – June 30" or "April 7 - April 20"
 * Returns the END date as a Date object (end of day), or null if unparseable
 */
export function parseExpiresAt(endsText: string | null | undefined): Date | null {
  if (!endsText) return null;
  
  const months: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  };
  
  // Match "Month Day" pattern at the end (after dash/en-dash)
  const match = endsText.match(/[\u2013\-–]\s*([A-Za-z]+)\s+(\d{1,2})/i);
  if (!match) return null;
  
  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2], 10);
  const monthNum = months[monthStr];
  
  if (monthNum === undefined || isNaN(day)) return null;
  
  // Assume current year, or next year if the date has passed
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, monthNum, day, 23, 59, 59, 999);
  
  // If the date is more than 2 months in the past, assume next year
  if (candidate < new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) {
    year++;
  }
  
  return new Date(year, monthNum, day, 23, 59, 59, 999);
}

// ════════════════════════════════════════════════════════════════════════════════
// DATABASE SCHEMA
// ════════════════════════════════════════════════════════════════════════════════

export async function ensureRebatesTable(db: pg.Pool) {
  await db.query(`
    create table if not exists site_rebates (
      id text primary key,
      source text not null,
      brand text,
      headline text not null,
      learn_more_url text,
      form_url text,
      ends_text text,
      enabled boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists site_rebates_enabled_brand_idx on site_rebates (enabled, brand);
  `);
  
  // Add extended columns if they don't exist
  await db.query(`
    alter table site_rebates add column if not exists expires_at timestamptz;
    alter table site_rebates add column if not exists rebate_amount text;
    alter table site_rebates add column if not exists rebate_type text;
    alter table site_rebates add column if not exists eligible_skus text[];
    alter table site_rebates add column if not exists eligible_models text[];
    alter table site_rebates add column if not exists eligible_sizes text[];
    alter table site_rebates add column if not exists brand_wide boolean default true;
    alter table site_rebates add column if not exists requirements text;
    alter table site_rebates add column if not exists start_date timestamptz;
    alter table site_rebates add column if not exists internal_notes text;
  `);
}

// ════════════════════════════════════════════════════════════════════════════════
// REBATE MATCHING LOGIC
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Match a tire against a rebate using strict priority:
 * 1. SKU-level match (exact)
 * 2. Brand + Model + Size match
 * 3. Brand-wide match (only if brand_wide=true AND no SKUs/models/sizes specified)
 * 
 * Returns null if no match, or the match type if matched.
 */
export function matchTireToRebate(
  tire: TireForRebateMatch,
  rebate: SiteRebate
): "sku" | "model" | "brand-wide" | null {
  const tireBrand = (tire.brand || "").toLowerCase().trim();
  const rebateBrand = (rebate.brand || "").toLowerCase().trim();
  
  // Brand must match for any rebate type
  if (!tireBrand || !rebateBrand || tireBrand !== rebateBrand) {
    return null;
  }
  
  const hasSkus = rebate.eligible_skus && rebate.eligible_skus.length > 0;
  const hasModels = rebate.eligible_models && rebate.eligible_models.length > 0;
  const hasSizes = rebate.eligible_sizes && rebate.eligible_sizes.length > 0;
  
  // 1. SKU-level match (highest priority)
  if (hasSkus) {
    const tireSku = (tire.sku || "").toLowerCase().trim();
    const skuMatch = rebate.eligible_skus!.some(
      sku => sku.toLowerCase().trim() === tireSku
    );
    if (skuMatch) return "sku";
    // If SKUs specified but no match, this rebate doesn't apply
    return null;
  }
  
  // 2. Brand + Model + Size match
  if (hasModels || hasSizes) {
    const tireModel = (tire.model || "").toLowerCase().trim();
    const tireSize = (tire.size || "").toLowerCase().trim();
    
    // Model match: tire model must contain one of the eligible model patterns
    let modelMatch = !hasModels; // If no models specified, consider it a match
    if (hasModels) {
      modelMatch = rebate.eligible_models!.some(
        pattern => tireModel.includes(pattern.toLowerCase().trim())
      );
    }
    
    // Size match: tire size must match one of the eligible sizes
    let sizeMatch = !hasSizes; // If no sizes specified, consider it a match
    if (hasSizes) {
      sizeMatch = rebate.eligible_sizes!.some(
        size => size.toLowerCase().trim() === tireSize
      );
    }
    
    if (modelMatch && sizeMatch) return "model";
    return null;
  }
  
  // 3. Brand-wide match (only if explicitly enabled and no other targeting)
  if (rebate.brand_wide === true) {
    return "brand-wide";
  }
  
  return null;
}

/**
 * Find all matching rebates for a tire, sorted by specificity.
 * Only returns active, non-expired rebates.
 */
export function findMatchingRebates(
  tire: TireForRebateMatch,
  rebates: SiteRebate[]
): RebateMatch[] {
  const now = new Date();
  const matches: RebateMatch[] = [];
  
  for (const rebate of rebates) {
    // Skip disabled rebates
    if (!rebate.enabled) continue;
    
    // Skip expired rebates
    if (rebate.expires_at && new Date(rebate.expires_at) < now) continue;
    
    // Skip not-yet-started rebates
    if (rebate.start_date && new Date(rebate.start_date) > now) continue;
    
    const matchType = matchTireToRebate(tire, rebate);
    if (matchType) {
      matches.push({ rebate, matchType });
    }
  }
  
  // Sort by specificity: sku > model > brand-wide
  const priority = { "sku": 1, "model": 2, "brand-wide": 3 };
  matches.sort((a, b) => priority[a.matchType] - priority[b.matchType]);
  
  return matches;
}

/**
 * Get the best matching rebate for a tire (most specific).
 */
export function getBestMatchingRebate(
  tire: TireForRebateMatch,
  rebates: SiteRebate[]
): RebateMatch | null {
  const matches = findMatchingRebates(tire, rebates);
  return matches.length > 0 ? matches[0] : null;
}

// ════════════════════════════════════════════════════════════════════════════════
// DATABASE OPERATIONS
// ════════════════════════════════════════════════════════════════════════════════

const REBATE_COLUMNS = `
  id, source, brand, headline, learn_more_url, form_url, ends_text, expires_at, 
  enabled, updated_at, rebate_amount, rebate_type, eligible_skus, eligible_models, 
  eligible_sizes, brand_wide, requirements, start_date, internal_notes
`;

export async function listRebates(db: pg.Pool): Promise<SiteRebate[]> {
  await ensureRebatesTable(db);
  const { rows } = await db.query({
    text: `
      select ${REBATE_COLUMNS}
      from site_rebates
      order by enabled desc, expires_at asc nulls last, updated_at desc
      limit 500
    `,
    values: [],
  });
  return rows as SiteRebate[];
}

export async function upsertManualRebate(
  db: pg.Pool,
  {
    brand,
    headline,
    learnMoreUrl,
    formUrl,
    endsText,
    enabled,
    rebateAmount,
    rebateType,
    eligibleSkus,
    eligibleModels,
    eligibleSizes,
    brandWide,
    requirements,
    startDate,
    internalNotes,
  }: {
    brand: string;
    headline: string;
    learnMoreUrl?: string;
    formUrl?: string;
    endsText?: string;
    enabled?: boolean;
    rebateAmount?: string;
    rebateType?: string;
    eligibleSkus?: string[];
    eligibleModels?: string[];
    eligibleSizes?: string[];
    brandWide?: boolean;
    requirements?: string;
    startDate?: string;
    internalNotes?: string;
  }
) {
  await ensureRebatesTable(db);

  const b = String(brand || "").trim();
  const h = String(headline || "").trim();
  const lm = learnMoreUrl ? String(learnMoreUrl).trim() : null;
  const fu = formUrl ? String(formUrl).trim() : null;
  const et = endsText ? String(endsText).trim() : null;
  const en = enabled === true;
  
  // Parse the end date for auto-expiration
  const expiresAt = parseExpiresAt(et);
  
  // Extended fields
  const ra = rebateAmount ? String(rebateAmount).trim() : null;
  const rt = rebateType ? String(rebateType).trim() : null;
  const skus = eligibleSkus?.filter(s => s.trim()) || null;
  const models = eligibleModels?.filter(s => s.trim()) || null;
  const sizes = eligibleSizes?.filter(s => s.trim()) || null;
  const bw = brandWide !== false; // Default to true for backward compatibility
  const req = requirements ? String(requirements).trim() : null;
  const sd = startDate ? new Date(startDate) : null;
  const notes = internalNotes ? String(internalNotes).trim() : null;

  if (!b) throw new Error("brand_required");
  if (!h) throw new Error("headline_required");

  // Brand-level ID: one manual rebate per brand (you can update it).
  const id = `manual:${b.toLowerCase()}`;

  await db.query({
    text: `
      insert into site_rebates (
        id, source, brand, headline, learn_more_url, form_url, ends_text, expires_at, enabled,
        rebate_amount, rebate_type, eligible_skus, eligible_models, eligible_sizes, 
        brand_wide, requirements, start_date, internal_notes
      )
      values ($1, 'manual', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      on conflict (id) do update set
        brand = excluded.brand,
        headline = excluded.headline,
        learn_more_url = excluded.learn_more_url,
        form_url = excluded.form_url,
        ends_text = excluded.ends_text,
        expires_at = excluded.expires_at,
        enabled = excluded.enabled,
        rebate_amount = excluded.rebate_amount,
        rebate_type = excluded.rebate_type,
        eligible_skus = excluded.eligible_skus,
        eligible_models = excluded.eligible_models,
        eligible_sizes = excluded.eligible_sizes,
        brand_wide = excluded.brand_wide,
        requirements = excluded.requirements,
        start_date = excluded.start_date,
        internal_notes = excluded.internal_notes,
        updated_at = now()
    `,
    values: [id, b, h, lm, fu, et, expiresAt, en, ra, rt, skus, models, sizes, bw, req, sd, notes],
  });

  return { id };
}

export async function listActiveRebates(db: pg.Pool): Promise<SiteRebate[]> {
  await ensureRebatesTable(db);
  const { rows } = await db.query({
    text: `
      select ${REBATE_COLUMNS}
      from site_rebates
      where enabled = true
        and (expires_at is null or expires_at > now())
        and (start_date is null or start_date <= now())
      order by expires_at asc nulls last, updated_at desc
      limit 500
    `,
    values: [],
  });
  return rows as SiteRebate[];
}

/**
 * Get rebates matching specific tires (batch operation for SRP).
 * Returns a map of tire SKU -> best matching rebate.
 */
export async function getMatchingRebatesForTires(
  db: pg.Pool,
  tires: TireForRebateMatch[]
): Promise<Map<string, RebateMatch>> {
  const activeRebates = await listActiveRebates(db);
  const result = new Map<string, RebateMatch>();
  
  for (const tire of tires) {
    const match = getBestMatchingRebate(tire, activeRebates);
    if (match) {
      result.set(tire.sku, match);
    }
  }
  
  return result;
}
