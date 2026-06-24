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

// ─── FIELD MAP (update after API probe) ───────────────────────────────────────
// Maps our DB column names → API response field names.
// Common alternatives listed as comments for quick reference.
const FIELD_MAP = {
  sku:           "sku",           // alt: "part_number", "partNumber", "item_number"
  dealer_cost:   "dealer_cost",   // alt: "cost", "net_price", "netPrice", "dealer_price"
  map_price:     "map",           // alt: "map_price", "MAP", "mapPrice"
  qty:           "qty",           // alt: "quantity", "stock", "inventory_qty", "total_qty"
  warehouse:     "warehouse",     // alt: "location", "warehouse_code", "wh"
  available:     "available",     // alt: "is_available", "in_stock", "availability"
} as const;

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

async function fetchInventoryPage(
  apiKey: string,
  page?: number,
  pageSize = 1000
): Promise<ApiRecord[]> {
  const url = new URL(`${BASE_URL}/inventory`);
  if (page !== undefined) url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(pageSize));

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": apiKey,
      "Accept": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Wheel-1 API ${res.status}: ${body.substring(0, 200)}`);
  }

  const data = await res.json();

  // Handle both array and { data: [...] } envelope shapes
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data))    return data.data;
  if (Array.isArray(data.items))   return data.items;
  if (Array.isArray(data.results)) return data.results;

  throw new Error(`Unexpected API response shape: ${JSON.stringify(Object.keys(data))}`);
}

/**
 * Fetch ALL inventory records from the API.
 * Handles pagination automatically (fetches until empty page).
 */
export async function fetchAllInventory(apiKey: string): Promise<ApiRecord[]> {
  const all: ApiRecord[] = [];

  // Try paginated first; if page=1 returns all, great
  const page1 = await fetchInventoryPage(apiKey, undefined);

  // If no pagination params returned, assume single response
  if (page1.length < 1000) {
    console.log(`[wheel1-sync] Single-page response: ${page1.length} records`);
    return page1;
  }

  // Paginate
  all.push(...page1);
  let page = 2;
  while (true) {
    const batch = await fetchInventoryPage(apiKey, page);
    if (batch.length === 0) break;
    all.push(...batch);
    console.log(`[wheel1-sync] Page ${page}: ${batch.length} records (total so far: ${all.length})`);
    page++;
    // Respect rate limit: 100 req/min → ~600ms between requests
    await new Promise(r => setTimeout(r, 650));
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
 * Handles both single-warehouse (flat) and multi-warehouse (array) responses.
 */
export function normalizeRecord(raw: ApiRecord): Wheel1InventoryRecord | null {
  const sku = toString(getField(raw, FIELD_MAP.sku));
  if (!sku) return null;

  const dealer_cost = toNum(getField(raw, FIELD_MAP.dealer_cost));
  const map_price   = toNum(getField(raw, FIELD_MAP.map_price));

  // Warehouse handling: some APIs return per-warehouse rows, some aggregate
  const warehouseVal = getField(raw, FIELD_MAP.warehouse);
  const qtyVal       = getField(raw, FIELD_MAP.qty);

  let inventory_qty    = 0;
  let warehouse_stock: { warehouse: string; qty: number }[] | null = null;
  let primary_warehouse: string | null = null;

  if (Array.isArray(warehouseVal)) {
    // Multi-warehouse: [{ code: "TX", qty: 10 }, ...]
    warehouse_stock = warehouseVal.map((w: Record<string, unknown>) => ({
      warehouse: toString(w.code ?? w.warehouse ?? w.location) ?? "?",
      qty: toInt(w.qty ?? w.quantity ?? w.stock),
    }));
    inventory_qty = warehouse_stock.reduce((s, w) => s + w.qty, 0);
    primary_warehouse = warehouse_stock.sort((a, b) => b.qty - a.qty)[0]?.warehouse ?? null;
  } else if (warehouseVal && qtyVal !== undefined) {
    // Single-warehouse flat row
    const wh  = toString(warehouseVal) ?? "default";
    const qty = toInt(qtyVal);
    inventory_qty    = qty;
    warehouse_stock  = [{ warehouse: wh, qty }];
    primary_warehouse = wh;
  } else {
    // No warehouse, just a quantity
    inventory_qty = toInt(qtyVal);
  }

  return {
    sku,
    dealer_cost,
    map_price,
    inventory_qty,
    warehouse_stock,
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
