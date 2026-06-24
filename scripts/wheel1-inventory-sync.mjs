/**
 * Wheel-1 Inventory Sync — Standalone Script
 *
 * Fetches live inventory from The Wheel Group API and upserts into
 * wheel1_products (qty, dealer_cost, MAP, warehouse).
 *
 * Usage:
 *   node scripts/wheel1-inventory-sync.mjs [--dry-run] [--verbose]
 *
 * Environment variables required:
 *   WHEEL1_API_KEY    - API key from The Wheel Group
 *   POSTGRES_URL      - Database connection string
 *
 * Schedule: run via cron / Vercel Cron every 4 hours.
 *
 * Rate limit: 100 req/min → script uses ~650ms delay between pages.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const BASE_URL = 'https://api.thewheelgroup.info/api/v1';

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const VERBOSE     = args.includes('--verbose');
const API_KEY     = process.env.WHEEL1_API_KEY;

if (!API_KEY) {
  console.error('❌ WHEEL1_API_KEY not set in .env.local');
  console.error('   Add: WHEEL1_API_KEY=your_key_here');
  process.exit(1);
}

// ─── FIELD MAP (confirmed by probe 2026-06-24) ───────────────────────────
const FIELD_MAP = {
  sku:         'item',        // Part number / SKU
  dealer_cost: 'DealerCost', // Dealer cost (number)
  map_price:   'MAP',        // MAP (0 = no MAP, treated as null)
  total_qty:   'Total',      // Total qty across all warehouses (pre-summed)
};

// 17 warehouse columns present in the flat API response
const WAREHOUSE_COLS = [
  'ATL', 'CHAR', 'CHI', 'COL', 'DAL', 'DEN', 'HOUS',
  'IND', 'JACKFL', 'KSCITY', 'LA', 'NASH', 'NJ', 'NORL',
  'PHXAZ', 'SANT', 'SEAWA',
];

// ─── DB ───────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getField(record, name) {
  if (name in record) return record[name];
  const lower = name.toLowerCase();
  const key = Object.keys(record).find(k => k.toLowerCase() === lower);
  return key ? record[key] : undefined;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) || n <= 0 ? null : n;
}

function toInt(v) {
  if (v == null || v === '') return 0;
  const n = parseInt(String(v), 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function toStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchInventory() {
  console.log('📡 Fetching inventory from Wheel Group API (paginated 200/page)...');
  const records = [];

  // Page 1 — discover total_pages
  const first = await fetchPage(1);
  records.push(...first.batch);
  console.log(`  Page 1/${first.totalPages}: ${first.batch.length} records (API total: ${first.total})`);

  for (let page = 2; page <= first.totalPages; page++) {
    await new Promise(r => setTimeout(r, 650)); // respect 100 req/min
    const { batch } = await fetchPage(page);
    if (batch.length === 0) break;
    records.push(...batch);
    if (page % 5 === 0 || page === first.totalPages) {
      console.log(`  Page ${page}/${first.totalPages}: ${batch.length} records (running: ${records.length})`);
    }
  }

  return records;
}

async function fetchPage(page) {
  const url = new URL(`${BASE_URL}/inventory`);
  url.searchParams.set('page',      String(page));
  url.searchParams.set('page_size', '200');

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': API_KEY, 'Accept': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body.substring(0, 300)}`);
  }

  const data  = await res.json();
  const batch = Array.isArray(data) ? data : (data.data ?? data.items ?? data.results ?? []);
  const totalPages = data.pagination?.total_pages ?? 1;
  const total      = data.pagination?.total ?? batch.length;
  return { batch, totalPages, total };
}

// ─── Normalize ────────────────────────────────────────────────────────────────

function normalize(raw) {
  const sku = toStr(getField(raw, FIELD_MAP.sku));
  if (!sku) return null;

  const dealer_cost = toNum(getField(raw, FIELD_MAP.dealer_cost));

  // MAP = 0 means "no MAP" — treat as null
  const rawMap  = toNum(getField(raw, FIELD_MAP.map_price));
  const map_price = (rawMap && rawMap > 0) ? rawMap : null;

  // Build warehouse breakdown from flat columns
  const warehouses = WAREHOUSE_COLS
    .map(wh => ({ warehouse: wh, qty: toInt(raw[wh]) }))
    .filter(w => w.qty > 0);

  // Use API's pre-summed Total; fall back to our sum
  const apiTotal = toInt(getField(raw, FIELD_MAP.total_qty));
  const qty      = apiTotal > 0 ? apiTotal : warehouses.reduce((s, w) => s + w.qty, 0);

  const primaryWh = warehouses.length > 0
    ? [...warehouses].sort((a, b) => b.qty - a.qty)[0].warehouse
    : null;

  return {
    sku,
    dealer_cost,
    map_price,
    qty,
    warehouses:   warehouses.length > 0 ? warehouses : null,
    primary_wh:   primaryWh,
  };
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

async function upsertBatch(records) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would upsert ${records.length} records`);
    return { updated: records.length, costFilled: 0, mapFilled: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TEMP TABLE w1_inv_staging (
        sku               TEXT PRIMARY KEY,
        inventory_qty     INTEGER NOT NULL DEFAULT 0,
        dealer_cost       NUMERIC,
        map_price         NUMERIC,
        warehouse_stock   JSONB,
        primary_warehouse TEXT
      ) ON COMMIT DROP
    `);

    // Insert into staging (API returns one row per SKU — no de-dup needed)
    for (const r of records) {
      if (!r) continue;
      await client.query(
        `INSERT INTO w1_inv_staging
           (sku, inventory_qty, dealer_cost, map_price, warehouse_stock, primary_warehouse)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (sku) DO UPDATE SET
           inventory_qty = EXCLUDED.inventory_qty`,
        [
          r.sku,
          r.qty,
          r.dealer_cost,
          r.map_price,
          r.warehouses ? JSON.stringify(r.warehouses) : null,
          r.primary_wh,
        ]
      );
    }

    // Count pre-update state for reporting
    const pre = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE wp.dealer_cost IS NULL AND s.dealer_cost IS NOT NULL) as cost_to_fill,
        COUNT(*) FILTER (WHERE wp.map_price IS NULL   AND s.map_price   IS NOT NULL) as map_to_fill
      FROM wheel1_products wp
      JOIN w1_inv_staging s ON wp.sku = s.sku
    `);
    const costFilled = parseInt(pre.rows[0].cost_to_fill, 10);
    const mapFilled  = parseInt(pre.rows[0].map_to_fill,  10);

    // Merge
    const res = await client.query(`
      UPDATE wheel1_products wp
      SET
        inventory_qty       = s.inventory_qty,
        warehouse_stock     = COALESCE(s.warehouse_stock, wp.warehouse_stock),
        primary_warehouse   = COALESCE(s.primary_warehouse, wp.primary_warehouse),
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

    await client.query('COMMIT');

    return { updated: res.rowCount ?? 0, costFilled, mapFilled };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ─── Pricing validation ───────────────────────────────────────────────────────

async function validatePricing() {
  console.log('\n📊 Pricing Validation (post-sync):\n');

  const { rows } = await pool.query(`
    SELECT
      wp.sku,
      wp.brand,
      wp.diameter,
      wp.msrp,
      wp.map_price,
      wp.dealer_cost,
      wp.inventory_qty,
      -- Landed cost formula
      COALESCE(wp.dealer_cost, wp.msrp * 0.68) + wp.diameter AS landed_cost,
      -- Sell price (30% margin on landed cost)
      ROUND((COALESCE(wp.dealer_cost, wp.msrp * 0.68) + wp.diameter) * 1.30, 2) AS markup_price,
      -- MAP floor
      GREATEST(
        ROUND((COALESCE(wp.dealer_cost, wp.msrp * 0.68) + wp.diameter) * 1.30, 2),
        COALESCE(wp.map_price, 0)
      ) AS final_sell_price,
      -- Is pricing from real cost or estimate?
      CASE WHEN wp.dealer_cost IS NOT NULL THEN 'real_cost' ELSE 'msrp_estimate' END AS cost_source
    FROM wheel1_products wp
    WHERE wp.is_discontinued = FALSE
      AND wp.inventory_qty > 0
      AND wp.msrp IS NOT NULL
    ORDER BY wp.brand, wp.diameter
    LIMIT 15
  `);

  if (rows.length === 0) {
    console.log('  ⚠️  No in-stock Wheel-1 products found yet (inventory_qty not synced)');
    return;
  }

  console.log(`${'SKU'.padEnd(25)} ${'Brand'.padEnd(18)} ${'Dia'.padEnd(5)} ${'MSRP'.padEnd(8)} ${'Cost'.padEnd(8)} ${'MAP'.padEnd(8)} ${'Landed'.padEnd(10)} ${'Sell $'.padEnd(9)} ${'Source'}`);
  console.log('-'.repeat(110));
  rows.forEach(r => {
    console.log(
      `${r.sku.padEnd(25)} ${(r.brand || '').padEnd(18)} ${String(r.diameter).padEnd(5)} ` +
      `$${String(r.msrp).padEnd(7)} $${String(r.dealer_cost || '-').padEnd(7)} ` +
      `$${String(r.map_price || '-').padEnd(7)} $${String(r.landed_cost).padEnd(9)} ` +
      `$${String(r.final_sell_price).padEnd(8)} ${r.cost_source}`
    );
  });
}

// ─── Vehicle fitment test ─────────────────────────────────────────────────────

async function testVehiclePricing() {
  console.log('\n🚗 Vehicle Fitment Pricing Test:\n');

  // Test vehicles: F-150, Silverado, Ram, Wrangler, Tacoma
  const vehicles = [
    { name: 'Ford F-150',           bolt: '6x135'   },
    { name: 'Chevy Silverado 1500', bolt: '6x139.7' },
    { name: 'Ram 1500',             bolt: '5x139.7' },
    { name: 'Jeep Wrangler',        bolt: '5x127'   },
    { name: 'Toyota Tacoma',        bolt: '6x139.7' },
  ];

  for (const v of vehicles) {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE inventory_qty > 0) as in_stock,
        COUNT(*) as total,
        MIN(GREATEST(
          ROUND((COALESCE(dealer_cost, msrp * 0.68) + diameter) * 1.30, 2),
          COALESCE(map_price, 0)
        )) as price_from,
        MAX(GREATEST(
          ROUND((COALESCE(dealer_cost, msrp * 0.68) + diameter) * 1.30, 2),
          COALESCE(map_price, 0)
        )) as price_to,
        COUNT(*) FILTER (WHERE dealer_cost IS NOT NULL) as real_cost_count
      FROM wheel1_products
      WHERE (pcd1 = $1 OR pcd2 = $1)
        AND is_discontinued = FALSE
        AND msrp IS NOT NULL
    `, [v.bolt]);

    const r = rows[0];
    console.log(`  ${v.name.padEnd(25)} (${v.bolt})`);
    console.log(`    Total SKUs:    ${r.total}`);
    console.log(`    In Stock:      ${r.in_stock}`);
    console.log(`    Real cost:     ${r.real_cost_count} SKUs`);
    console.log(`    Price range:   $${r.price_from || '?'} – $${r.price_to || '?'}`);
    console.log('');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 Wheel-1 Inventory Sync');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   API:  ${BASE_URL}/inventory`);
  console.log('');

  const start = Date.now();

  try {
    const raw         = await fetchInventory();
    const normalized  = raw.map(normalize).filter(Boolean);

    console.log(`\n✅ Fetched: ${raw.length} records → ${normalized.length} valid`);

    // Print sample
    if (VERBOSE && normalized.length > 0) {
      console.log('\nSample normalized records:');
      normalized.slice(0, 3).forEach(r => console.log('  ', JSON.stringify(r)));
    }

    // Zero-cost check
    const hasCost = normalized.filter(r => r.dealer_cost !== null).length;
    const hasMap  = normalized.filter(r => r.map_price !== null).length;
    const inStock = normalized.filter(r => r.qty > 0).length;
    console.log(`   With dealer_cost: ${hasCost} (${Math.round(hasCost / normalized.length * 100)}%)`);
    console.log(`   With MAP:         ${hasMap} (${Math.round(hasMap / normalized.length * 100)}%)`);
    console.log(`   In stock (qty>0): ${inStock} (${Math.round(inStock / normalized.length * 100)}%)`);

    const { updated, costFilled, mapFilled } = await upsertBatch(normalized);

    console.log(`\n✅ Upserted: ${updated} rows`);
    console.log(`   Dealer cost filled: ${costFilled}`);
    console.log(`   MAP filled:         ${mapFilled}`);
    console.log(`   Duration: ${Date.now() - start}ms`);

    await validatePricing();
    await testVehiclePricing();

  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error('\n❌ Sync failed:', e.message);
  process.exit(1);
});
