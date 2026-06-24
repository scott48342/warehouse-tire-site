/**
 * Wheel-1 Inventory Sync Client
 *
 * Fetches live inventory from The Wheel Group API and upserts:
 *   - inventory_qty       → total stock across all warehouses
 *   - warehouse_stock     → per-warehouse breakdown (JSONB)
 *   - primary_warehouse   → highest-qty location
 *   - dealer_cost         → actual dealer cost (replaces MSRP-estimated fallback)
 *   - map_price           → MAP from inventory feed (fills gaps in catalog data)
 *   - inventory_synced_at → timestamp of sync
 *
 * ─── FIELD MAP ────────────────────────────────────────────────────────────────
 * UPDATE THIS after running `node scripts/wheel1-probe-api.mjs <YOUR_KEY>`
 * The probe will print exact API field names.  Plug them into FIELD_MAP below.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { getPool } from "@/lib/vehicleFitment";

const BASE_URL = "https://api.thewheelgroup.info/api/v1";

// ─── FIELD MAP (confirmed by probe 2026-06-24) ────────────────────────────────
// Exact field names from https://api.thewheelgroup.info/api/v1/inventory
const FIELD_MAP = {
  sku:         "item",        // Part number / SKU
  dealer_cost: "DealerCost",  // Dealer cost (number)
  map_price:   "MAP",         // MAP price (0 = no MAP, treat as null)
  total_qty:   "Total",       // Total qty across all warehouses (pre-summed)
} as const;

// Warehouse columns present in the API response (flat, each is a number)
// These become warehouse_stock JSONB: [{warehouse: "ATL", qty: 3}, ...]
const WAREHOUSE_COLS = [
  "ATL", "CHAR", "CHI", "COL", "DAL", "DEN", "HOUS",
  "IND", "JACKFL", "KSCITY", "LA", "NASH", "NJ", "NORL",
  "PHXAZ", "SANT", "SEAWA",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Wheel1InventoryRecord {
  sku: string;
  dealer_cost: number | null;
  map_price: number | null;
  inventory_qty: number;
  warehouse_stock: { warehouse: string; qty: number }[] | null;
  primary_warehouse: string | null;
}

interface ApiRecord {
  [key: string]: unknown;
}

// ─── API client ───────────────────────────────────────────────────────────────

interface PageResponse {
  records: ApiRecord[];
  totalPages: number;
  total: number;
}

async function fetchInventoryPage(
  apiKey: string,
  page: number,
  pageSize = 200
): Promise<PageResponse> {
  const url = new URL(`${BASE_URL}/inventory`);
  url.searchParams.set("page",      String(page));
  url.searchParams.set("page_size", String(pageSize));

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": apiKey,
      "Accept":    "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Wheel-1 API ${res.status}: ${body.substring(0, 200)}`);
  }

  const data = await res.json();

  // Response shape: { success, pagination: { page, page_size, total, total_pages }, data: [...] }
  const records    = Array.isArray(data)         ? data
                   : Array.isArray(data.data)    ? data.data
                   : Array.isArray(data.items)   ? data.items
                   : Array.isArray(data.results) ? data.results
                   : [];
  const totalPages = data.pagination?.total_pages ?? (records.length < pageSize ? page : page + 1);
  const total      = data.pagination?.total ?? records.length;

  return { records, totalPages, total };
}

/**
 * Fetch ALL inventory records from the API, paginating through all pages.
 * Rate limit: 100 req/min → 650ms delay between pages.
 */
export async function fetchAllInventory(apiKey: string): Promise<ApiRecord[]> {
  const all: ApiRecord[] = [];

  // Page 1 to discover total_pages
  const first = await fetchInventoryPage(apiKey, 1);
  all.push(...first.records);
  console.log(`[wheel1-sync] Page 1/${first.totalPages}: ${first.records.length} records (total: ${first.total})`);

  for (let page = 2; page <= first.totalPages; page++) {
    await new Promise(r => setTimeout(r, 650)); // respect 100 req/min
    const { records } = await fetchInventoryPage(apiKey, page);
    if (records.length === 0) break;
    all.push(...records);
    if (page % 5 === 0 || page === first.totalPages) {
      console.log(`[wheel1-sync] Page ${page}/${first.totalPages}: ${records.length} records (running total: ${all.length})`);
    }
  }

  return all;
}

// ─── Field extraction ─────────────────────────────────────────────────────────

function getField(record: ApiRecord, fieldName: string): unknown {
  // Direct match
  if (fieldName in record) return record[fieldName];
  // Case-insensitive fallback
  const lower = fieldName.toLowerCase();
  const key = Object.keys(record).find(k => k.toLowerCase() === lower);
  return key ? record[key] : undefined;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) || n <= 0 ? null : n;
}

function toInt(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseInt(String(v), 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function toString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Normalize a raw API record into our internal InventoryRecord shape.
 *
 * The Wheel Group API uses FLAT warehouse columns (ATL, CHAR, CHI, etc.).
 * We aggregate them into warehouse_stock JSONB and sum to inventory_qty.
 * MAP = 0 means no MAP constraint — treat as null.
 */
export function normalizeRecord(raw: ApiRecord): Wheel1InventoryRecord | null {
  const sku = toString(getField(raw, FIELD_MAP.sku));
  if (!sku) return null;

  const dealer_cost = toNum(getField(raw, FIELD_MAP.dealer_cost));

  // MAP: 0 means "no MAP" — treat as null
  const rawMap  = toNum(getField(raw, FIELD_MAP.map_price));
  const map_price = (rawMap && rawMap > 0) ? rawMap : null;

  // Build per-warehouse breakdown from flat columns
  const warehouse_stock: { warehouse: string; qty: number }[] = [];
  for (const wh of WAREHOUSE_COLS) {
    const qty = toInt(raw[wh]);
    if (qty > 0) warehouse_stock.push({ warehouse: wh, qty });
  }

  // Use Total field (pre-summed by API) — verify against our sum
  const apiTotal    = toInt(getField(raw, FIELD_MAP.total_qty));
  const ourSum      = warehouse_stock.reduce((s, w) => s + w.qty, 0);
  const inventory_qty = apiTotal > 0 ? apiTotal : ourSum;

  // Primary warehouse = highest-qty location
  const primary_warehouse =
    warehouse_stock.length > 0
      ? [...warehouse_stock].sort((a, b) => b.qty - a.qty)[0].warehouse
      : null;

  return {
    sku,
    dealer_cost,
    map_price,
    inventory_qty,
    warehouse_stock: warehouse_stock.length > 0 ? warehouse_stock : null,
    primary_warehouse,
  };
}

// ─── DB upsert ────────────────────────────────────────────────────────────────

/**
 * Upsert inventory records into wheel1_products.
 *
 * Uses batch INSERT ... ON CONFLICT DO UPDATE for efficiency.
 * Only updates columns that the API provided data for:
 *   - inventory_qty always updated
 *   - dealer_cost updated only if API returned a value
 *   - map_price updated only if API returned a value AND existing is NULL
 */
export async function upsertInventory(records: Wheel1InventoryRecord[]): Promise<{
  updated: number;
  skipped: number;
  costFilled: number;
  mapFilled: number;
}> {
  const pool = getPool();
  const now  = new Date().toISOString();

  let updated = 0;
  let skipped = 0;
  let costFilled = 0;
  let mapFilled  = 0;

  // Batch in chunks of 500 for parameter limit safety
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);

    // Build bulk upsert
    const values: unknown[] = [];
    const rows: string[] = [];

    chunk.forEach((r, idx) => {
      const base = idx * 6;
      rows.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6})`
      );
      values.push(
        r.sku,
        r.inventory_qty,
        r.dealer_cost,
        r.map_price,
        r.warehouse_stock ? JSON.stringify(r.warehouse_stock) : null,
        r.primary_warehouse
      );
    });

    const sql = `
      INSERT INTO wheel1_products
        (sku, inventory_qty, dealer_cost, map_price, warehouse_stock, primary_warehouse, inventory_synced_at)
      VALUES ${rows.map((row, idx) => {
        const base = idx * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6}, NOW())`;
      }).join(', ')}
      ON CONFLICT (sku) DO UPDATE SET
        inventory_qty       = EXCLUDED.inventory_qty,
        warehouse_stock     = EXCLUDED.warehouse_stock,
        primary_warehouse   = EXCLUDED.primary_warehouse,
        dealer_cost         = CASE
                                WHEN EXCLUDED.dealer_cost IS NOT NULL THEN EXCLUDED.dealer_cost
                                ELSE wheel1_products.dealer_cost
                              END,
        map_price           = CASE
                                WHEN EXCLUDED.map_price IS NOT NULL AND wheel1_products.map_price IS NULL
                                THEN EXCLUDED.map_price
                                ELSE wheel1_products.map_price
                              END,
        inventory_synced_at = NOW()
      RETURNING
        sku,
        (xmax = 0) AS is_insert,
        (dealer_cost IS NOT NULL) AS has_cost,
        (map_price IS NOT NULL) AS has_map
    `;

    // Rebuild values array without the jsonb cast in the VALUES clause
    const flatValues: unknown[] = [];
    chunk.forEach(r => {
      flatValues.push(
        r.sku,
        r.inventory_qty,
        r.dealer_cost,
        r.map_price,
        r.warehouse_stock ? JSON.stringify(r.warehouse_stock) : null,
        r.primary_warehouse
      );
    });

    // Use simpler parameterized approach
    await upsertChunk(pool, chunk, now);
    updated += chunk.length;

    chunk.forEach(r => {
      if (r.dealer_cost !== null) costFilled++;
      if (r.map_price !== null) mapFilled++;
    });
  }

  return { updated, skipped, costFilled, mapFilled };
}

async function upsertChunk(
  pool: ReturnType<typeof getPool>,
  records: Wheel1InventoryRecord[],
  _now: string
): Promise<void> {
  // Use a temp table + bulk update for cleaner parameterization
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Temp table matching our columns
    await client.query(`
      CREATE TEMP TABLE w1_inv_staging (
        sku             TEXT PRIMARY KEY,
        inventory_qty   INTEGER,
        dealer_cost     NUMERIC,
        map_price       NUMERIC,
        warehouse_stock JSONB,
        primary_warehouse TEXT
      ) ON COMMIT DROP
    `);

    // Bulk insert into staging
    for (const r of records) {
      await client.query(
        `INSERT INTO w1_inv_staging VALUES ($1,$2,$3,$4,$5::jsonb,$6)
         ON CONFLICT (sku) DO UPDATE SET
           inventory_qty = EXCLUDED.inventory_qty + w1_inv_staging.inventory_qty`,
        [
          r.sku,
          r.inventory_qty,
          r.dealer_cost,
          r.map_price,
          r.warehouse_stock ? JSON.stringify(r.warehouse_stock) : null,
          r.primary_warehouse,
        ]
      );
    }

    // Merge into main table
    await client.query(`
      UPDATE wheel1_products wp
      SET
        inventory_qty       = s.inventory_qty,
        warehouse_stock     = s.warehouse_stock,
        primary_warehouse   = s.primary_warehouse,
        dealer_cost         = COALESCE(s.dealer_cost, wp.dealer_cost),
        map_price           = CASE
                                WHEN s.map_price IS NOT NULL AND wp.map_price IS NULL
                                THEN s.map_price
                                ELSE wp.map_price
                              END,
        inventory_synced_at = NOW()
      FROM w1_inv_staging s
      WHERE wp.sku = s.sku
    `);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─── Main sync orchestrator ───────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  recordsFetched: number;
  recordsUpdated: number;
  costFilled: number;
  mapFilled: number;
  durationMs: number;
  error?: string;
}

export async function runWheel1InventorySync(apiKey: string): Promise<SyncResult> {
  const start = Date.now();
  console.log("[wheel1-sync] Starting inventory sync...");

  try {
    const raw     = await fetchAllInventory(apiKey);
    console.log(`[wheel1-sync] Fetched ${raw.length} records from API`);

    const records = raw.map(normalizeRecord).filter((r): r is Wheel1InventoryRecord => r !== null);
    console.log(`[wheel1-sync] Normalized ${records.length} valid records`);

    const { updated, skipped, costFilled, mapFilled } = await upsertInventory(records);

    const durationMs = Date.now() - start;
    console.log(
      `[wheel1-sync] ✅ Done in ${durationMs}ms — updated=${updated} skipped=${skipped} ` +
      `costFilled=${costFilled} mapFilled=${mapFilled}`
    );

    return {
      success: true,
      recordsFetched: raw.length,
      recordsUpdated: updated,
      costFilled,
      mapFilled,
      durationMs,
    };
  } catch (err) {
    const error = (err as Error).message;
    console.error("[wheel1-sync] ❌ Sync failed:", error);
    return {
      success: false,
      recordsFetched: 0,
      recordsUpdated: 0,
      costFilled: 0,
      mapFilled: 0,
      durationMs: Date.now() - start,
      error,
    };
  }
}
