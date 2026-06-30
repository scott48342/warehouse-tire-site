/**
 * Wheel-1 Catalog Import
 *
 * Creates wheel1_products + wheel1_import_log tables if not present,
 * parses the US Data Mastersheet (Excel), normalizes fields, upserts all
 * active SKUs, mirrors images to Vercel Blob, and logs results.
 *
 * Run from project root:
 *   node scripts/wheel1-import.mjs [--dry-run] [--skip-images] [--limit N]
 *
 * Flags:
 *   --dry-run      Parse + validate but do not write to DB or Blob
 *   --skip-images  Import product data but skip image mirroring
 *   --limit N      Only process first N rows (testing)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import ExcelJS from 'exceljs';
import { put } from '@vercel/blob';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Args ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const SKIP_IMAGES = args.includes('--skip-images');
const limitIdx    = args.indexOf('--limit');
const LIMIT       = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

// ─── Feed path ───────────────────────────────────────────────────────────────
const FEED_PATH = path.resolve(__dirname, '../../audit-wtd/wheel1-feed.xlsx');
// Fallback: look next to this script
const FEED_ALT  = path.resolve(__dirname, 'wheel1-feed.xlsx');

// ─── DB ──────────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Normalize Wheel-1 bolt pattern "5-114.3" → "5x114.3" */
function normalizeBoltPattern(raw) {
  if (!raw) return null;
  return String(raw).trim().replace(/^(\d+)-(.+)$/, '$1x$2');
}

/** Parse numeric, return null if invalid/zero */
function toNum(v) {
  const n = parseFloat(String(v ?? '').trim());
  return isNaN(n) ? null : n;
}

/** Parse boolean from YES/NO/TRUE/FALSE */
function toBool(v) {
  if (v === null || v === undefined) return null;
  return /^(yes|true|1)$/i.test(String(v).trim());
}

/** Strip the ?auto= query from Bynder URLs to get clean PNG URL */
function cleanImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.origin + u.pathname; // drop query string
  } catch {
    return url;
  }
}

/**
 * Download an image from Bynder CDN and upload to Vercel Blob.
 * Returns the public Blob URL or null on failure.
 */
async function mirrorImage(sourceUrl, blobPath) {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const { url } = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'image/png',
      addRandomSuffix: false,
    });
    return url;
  } catch {
    return null;
  }
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS wheel1_products (
  id                    SERIAL PRIMARY KEY,
  sku                   TEXT NOT NULL UNIQUE,
  brand                 TEXT NOT NULL,
  aaia_code             TEXT,
  name                  TEXT,
  style_number          TEXT,
  description           TEXT,
  short_description     TEXT,
  diameter              NUMERIC(4,1) NOT NULL,
  wheel_width           NUMERIC(4,1) NOT NULL,
  hub                   NUMERIC(7,3),
  pcd1                  TEXT,
  pcd2                  TEXT,
  offset_text           TEXT,
  offset_mm             NUMERIC(6,1),
  backspace             NUMERIC(5,2),
  color                 TEXT,
  finish                TEXT,
  load_rating           INTEGER,
  upc                   TEXT,
  country_of_origin     TEXT,
  division              TEXT,
  group_code            TEXT,
  note                  TEXT,
  is_dually             BOOLEAN DEFAULT FALSE,
  is_winter_approved    BOOLEAN DEFAULT FALSE,
  tpms_compatible       BOOLEAN,
  wheel_lip_size        NUMERIC(5,2),
  lugnut_open_closed    TEXT,
  lugnut_type1          TEXT,
  lugnut_type2          TEXT,
  lugseat_type          TEXT,
  wheel_cap_sku         TEXT,
  structure_warranty    TEXT,
  finish_warranty       TEXT,
  bullet_points         TEXT,
  sales_description     TEXT,
  image1                TEXT,
  image2                TEXT,
  image3                TEXT,
  image4                TEXT,
  image1_source         TEXT,
  image2_source         TEXT,
  image3_source         TEXT,
  image4_source         TEXT,
  product_weight_lbs    NUMERIC(6,2),
  ship_weight_lbs       NUMERIC(6,2),
  pkg_width_in          NUMERIC(6,2),
  pkg_height_in         NUMERIC(6,2),
  pkg_depth_in          NUMERIC(6,2),
  msrp                  NUMERIC(10,2),
  map_price             NUMERIC(10,2),
  has_map               BOOLEAN DEFAULT FALSE,
  dealer_cost           NUMERIC(10,2),
  is_discontinued       BOOLEAN DEFAULT FALSE,
  feed_version          TEXT,
  last_catalog_update   TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wheel1_brand    ON wheel1_products(brand);
CREATE INDEX IF NOT EXISTS idx_wheel1_diameter ON wheel1_products(diameter);
CREATE INDEX IF NOT EXISTS idx_wheel1_pcd1     ON wheel1_products(pcd1);
CREATE INDEX IF NOT EXISTS idx_wheel1_pcd2     ON wheel1_products(pcd2) WHERE pcd2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wheel1_active   ON wheel1_products(is_discontinued) WHERE is_discontinued = FALSE;
CREATE INDEX IF NOT EXISTS idx_wheel1_upc      ON wheel1_products(upc);

CREATE TABLE IF NOT EXISTS wheel1_import_log (
  id              SERIAL PRIMARY KEY,
  import_type     TEXT NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'running',
  rows_processed  INTEGER DEFAULT 0,
  rows_inserted   INTEGER DEFAULT 0,
  rows_updated    INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  images_mirrored INTEGER DEFAULT 0,
  images_failed   INTEGER DEFAULT 0,
  errors          JSONB DEFAULT '[]',
  metadata        JSONB DEFAULT '{}'
);
`;

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const startMs = Date.now();
  console.log(`\n🔧 Wheel-1 Import — ${new Date().toISOString()}`);
  console.log(`   Dry run: ${DRY_RUN}  |  Skip images: ${SKIP_IMAGES}  |  Limit: ${LIMIT === Infinity ? 'all' : LIMIT}\n`);

  // Locate feed file
  const feedPath = fs.existsSync(FEED_PATH) ? FEED_PATH : FEED_ALT;
  if (!fs.existsSync(feedPath)) {
    console.error('❌ Feed file not found at:', feedPath);
    process.exit(1);
  }
  console.log('📁 Feed:', feedPath);

  // ── Create tables ──────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    console.log('🗄️  Creating tables if not exist…');
    await pool.query(CREATE_TABLES);
    console.log('   ✅ Tables ready');
  }

  // ── Start import log ───────────────────────────────────────────────────────
  let logId = null;
  if (!DRY_RUN) {
    const lr = await pool.query(
      `INSERT INTO wheel1_import_log (import_type, status) VALUES ('catalog', 'running') RETURNING id`
    );
    logId = lr.rows[0].id;
    console.log(`   📋 Import log id: ${logId}`);
  }

  // ── Parse Excel ───────────────────────────────────────────────────────────
  console.log('\n📊 Parsing Excel feed…');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(feedPath);

  const ws   = wb.getWorksheet('US Data Mastersheet');
  const disc = wb.getWorksheet('Discontinued');

  if (!ws) { console.error('❌ Sheet "US Data Mastersheet" not found'); process.exit(1); }

  // Build header index from row 3
  const H = {};
  ws.getRow(3).eachCell((cell, col) => {
    const name = String(cell.value || '').trim();
    if (name) H[name] = col;
  });

  // Build discontinued SKU set
  const discontinuedSkus = new Set();
  if (disc) {
    // Disc sheet header is on row 1 (different from main)
    let discSkuCol = 1;
    disc.getRow(1).eachCell((cell, col) => {
      if (String(cell.value || '').trim() === 'SKU') discSkuCol = col;
    });
    disc.eachRow((row, rn) => {
      if (rn <= 1) return;
      const sku = String(row.getCell(discSkuCol).value || '').trim();
      if (sku && sku !== 'SKU') discontinuedSkus.add(sku);
    });
  }
  console.log(`   Discontinued SKUs to exclude: ${discontinuedSkus.size}`);

  const g  = (row, name) => { const c = H[name]; if (!c) return ''; const v = row.getCell(c).value; return (v === null || v === undefined) ? '' : String(v).trim(); };
  const gn = (row, name) => toNum(g(row, name));
  const gb = (row, name) => toBool(g(row, name));

  // ── Process rows ──────────────────────────────────────────────────────────
  let processed = 0, inserted = 0, updated = 0, skipped = 0;
  let imgMirrored = 0, imgFailed = 0;
  const errors = [];
  const totalRows = ws.rowCount - 3; // minus banner + blank + header

  console.log(`   Total rows to process: ~${totalRows}`);
  console.log('');

  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn <= 3) return;
    const sku = g(row, 'SKU');
    if (!sku) return;
    rows.push({ row, rn, sku });
  });

  for (const { row, rn, sku } of rows) {
    if (processed >= LIMIT) break;
    processed++;

    try {
      // Skip discontinued
      if (discontinuedSkus.has(sku)) {
        skipped++;
        continue;
      }

      const brand       = g(row, 'BRAND');
      const diameter    = gn(row, 'DIAMETER');
      const wheelWidth  = gn(row, 'WHEEL_WIDTH');

      if (!brand || !diameter || !wheelWidth) {
        errors.push({ sku, reason: 'missing required field (brand/diameter/width)' });
        skipped++;
        continue;
      }

      const msrp     = gn(row, 'NEW MSRP PRICE');
      const mapRaw   = gn(row, 'NEW MAP PRICE');
      const mapYN    = g(row, 'MAP Y/N');
      const hasMap   = mapYN === 'YES';
      const mapPrice = hasMap && mapRaw && mapRaw > 0 ? mapRaw : null;

      const pcd1 = normalizeBoltPattern(g(row, 'PCD1'));
      const pcd2 = normalizeBoltPattern(g(row, 'PCD2')) || null;

      // Raw CDN URLs
      const img1src = cleanImageUrl(g(row, 'IMAGE1'));
      const img2src = cleanImageUrl(g(row, 'IMAGE2'));
      const img3src = cleanImageUrl(g(row, 'IMAGE3'));
      const img4src = cleanImageUrl(g(row, 'IMAGE4'));

      // ── Mirror images to Vercel Blob ──────────────────────────────────────
      let img1 = img1src, img2 = img2src, img3 = img3src, img4 = img4src;
      if (!SKIP_IMAGES && !DRY_RUN && img1src) {
        const skuSlug = sku.replace(/[^a-zA-Z0-9-]/g, '-');
        const b1 = await mirrorImage(img1src, `wheel1/${skuSlug}/1.png`);
        if (b1) { img1 = b1; imgMirrored++; } else imgFailed++;
        if (img2src) { const b2 = await mirrorImage(img2src, `wheel1/${skuSlug}/2.png`); if (b2) { img2 = b2; imgMirrored++; } else imgFailed++; }
        if (img3src) { const b3 = await mirrorImage(img3src, `wheel1/${skuSlug}/3.png`); if (b3) { img3 = b3; imgMirrored++; } else imgFailed++; }
        if (img4src) { const b4 = await mirrorImage(img4src, `wheel1/${skuSlug}/4.png`); if (b4) { img4 = b4; imgMirrored++; } else imgFailed++; }
        await sleep(50); // ~20 imgs/sec pace to avoid hammering CDN
      }

      const record = {
        sku,
        brand:                 brand.trim(),
        aaia_code:             g(row, 'AAIA CODE') || null,
        name:                  g(row, 'NAME') || null,
        style_number:          g(row, 'STYLE_NUMBER') || null,
        description:           g(row, 'DESCRIPTION') || null,
        short_description:     g(row, 'SHORT_DESCRIPTION') || null,
        diameter,
        wheel_width:           wheelWidth,
        hub:                   gn(row, 'HUB'),
        pcd1,
        pcd2,
        offset_text:           g(row, 'OFFSET') || null,
        offset_mm:             gn(row, 'OFFSETNUM'),
        backspace:             gn(row, 'BACKSPACE'),
        color:                 g(row, 'COLOR') || null,
        finish:                g(row, 'FINISH') || null,
        load_rating:           gn(row, 'LOAD RATING') ? Math.round(gn(row, 'LOAD RATING')) : null,
        upc:                   g(row, 'UPC') || null,
        country_of_origin:     g(row, 'COUNTRY OF ORIGIN') || null,
        division:              g(row, 'DIVISION') || null,
        group_code:            g(row, 'GROUP CODE') || null,
        note:                  g(row, 'NOTE') || null,
        is_dually:             gb(row, 'DUALLY WHEEL') ?? false,
        is_winter_approved:    gb(row, 'WINTER APPROVED') ?? false,
        tpms_compatible:       gb(row, 'TPMS_COMPATIBLE'),
        wheel_lip_size:        gn(row, 'WHEEL_LIP_SIZE'),
        lugnut_open_closed:    g(row, 'LUGNUT_OPEN_CLOSED') || null,
        lugnut_type1:          g(row, 'LUGNUT_TYPE1') || null,
        lugnut_type2:          g(row, 'LUGNUT_TYPE2') || null,
        lugseat_type:          g(row, 'LUGSEAT_TYPE') || null,
        wheel_cap_sku:         g(row, 'WHEEL_CAP') || null,
        structure_warranty:    g(row, 'STRUCTURE_WARRANTY') || null,
        finish_warranty:       g(row, 'FINISH_WARRANTY') || null,
        bullet_points:         g(row, 'BULLET POINTS') || null,
        sales_description:     g(row, 'SALES DESCRIPTION') || null,
        image1:                img1 || null,
        image2:                img2 || null,
        image3:                img3 || null,
        image4:                img4 || null,
        image1_source:         img1src || null,
        image2_source:         img2src || null,
        image3_source:         img3src || null,
        image4_source:         img4src || null,
        product_weight_lbs:    gn(row, 'PRODUCT WEIGHT (LBS)'),
        ship_weight_lbs:       gn(row, 'SHIP WEIGHT(LBS)'),
        pkg_width_in:          gn(row, 'WIDTH'),
        pkg_height_in:         gn(row, 'HEIGHT'),
        pkg_depth_in:          gn(row, 'DEPTH'),
        msrp:                  msrp ?? null,
        map_price:             mapPrice,
        has_map:               hasMap,
        dealer_cost:           null, // Not in catalog feed — populated by pricing feed
        is_discontinued:       false,
        feed_version:          'US_Wheel_Data_Mastersheet_2026-06-23',
        last_catalog_update:   new Date(),
      };

      if (DRY_RUN) {
        if (processed <= 3) console.log('   [DRY RUN] Row', rn, '→', JSON.stringify({ sku, brand, diameter, pcd1, pcd2, msrp, hasMap }));
        inserted++;
        continue;
      }

      // Upsert
      await pool.query(`
        INSERT INTO wheel1_products (
          sku, brand, aaia_code, name, style_number, description, short_description,
          diameter, wheel_width, hub, pcd1, pcd2, offset_text, offset_mm, backspace,
          color, finish, load_rating, upc, country_of_origin, division, group_code, note,
          is_dually, is_winter_approved, tpms_compatible, wheel_lip_size,
          lugnut_open_closed, lugnut_type1, lugnut_type2, lugseat_type, wheel_cap_sku,
          structure_warranty, finish_warranty, bullet_points, sales_description,
          image1, image2, image3, image4, image1_source, image2_source, image3_source, image4_source,
          product_weight_lbs, ship_weight_lbs, pkg_width_in, pkg_height_in, pkg_depth_in,
          msrp, map_price, has_map, dealer_cost, is_discontinued, feed_version, last_catalog_update
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
          $37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,$54,$55,$56
        )
        ON CONFLICT (sku) DO UPDATE SET
          brand=$2, aaia_code=$3, name=$4, style_number=$5, description=$6, short_description=$7,
          diameter=$8, wheel_width=$9, hub=$10, pcd1=$11, pcd2=$12, offset_text=$13, offset_mm=$14, backspace=$15,
          color=$16, finish=$17, load_rating=$18, upc=$19, country_of_origin=$20, division=$21,
          group_code=$22, note=$23, is_dually=$24, is_winter_approved=$25, tpms_compatible=$26,
          wheel_lip_size=$27, lugnut_open_closed=$28, lugnut_type1=$29, lugnut_type2=$30, lugseat_type=$31,
          wheel_cap_sku=$32, structure_warranty=$33, finish_warranty=$34, bullet_points=$35, sales_description=$36,
          image1=COALESCE($37, wheel1_products.image1),
          image2=COALESCE($38, wheel1_products.image2),
          image3=COALESCE($39, wheel1_products.image3),
          image4=COALESCE($40, wheel1_products.image4),
          image1_source=$41, image2_source=$42, image3_source=$43, image4_source=$44,
          product_weight_lbs=$45, ship_weight_lbs=$46, pkg_width_in=$47, pkg_height_in=$48, pkg_depth_in=$49,
          msrp=$50, map_price=$51, has_map=$52,
          is_discontinued=$54, feed_version=$55, last_catalog_update=$56, updated_at=NOW()
      `, [
        record.sku, record.brand, record.aaia_code, record.name, record.style_number,
        record.description, record.short_description, record.diameter, record.wheel_width,
        record.hub, record.pcd1, record.pcd2, record.offset_text, record.offset_mm, record.backspace,
        record.color, record.finish, record.load_rating, record.upc, record.country_of_origin,
        record.division, record.group_code, record.note, record.is_dually, record.is_winter_approved,
        record.tpms_compatible, record.wheel_lip_size, record.lugnut_open_closed, record.lugnut_type1,
        record.lugnut_type2, record.lugseat_type, record.wheel_cap_sku, record.structure_warranty,
        record.finish_warranty, record.bullet_points, record.sales_description,
        record.image1, record.image2, record.image3, record.image4,
        record.image1_source, record.image2_source, record.image3_source, record.image4_source,
        record.product_weight_lbs, record.ship_weight_lbs, record.pkg_width_in, record.pkg_height_in,
        record.pkg_depth_in, record.msrp, record.map_price, record.has_map,
        record.dealer_cost, record.is_discontinued, record.feed_version, record.last_catalog_update
      ]);

      // Track insert vs update
      const chk = await pool.query('SELECT created_at, updated_at FROM wheel1_products WHERE sku=$1', [sku]);
      const row2 = chk.rows[0];
      if (row2 && Math.abs(new Date(row2.updated_at) - new Date(row2.created_at)) < 2000) inserted++;
      else updated++;

    } catch (err) {
      errors.push({ sku, error: err.message?.slice(0, 200) });
      skipped++;
    }

    // Progress every 100
    if (processed % 100 === 0) {
      const pct = Math.round(processed / Math.min(rows.length, LIMIT) * 100);
      process.stdout.write(`\r   ⏳ ${processed}/${Math.min(rows.length, LIMIT)} (${pct}%)  inserted:${inserted} updated:${updated} skipped:${skipped} imgs:${imgMirrored} ⚠️${errors.length}  `);
    }
  }

  const durationMs = Date.now() - startMs;
  process.stdout.write('\n');

  console.log('\n═══════════════════════════════════════════════');
  console.log(`✅ Import complete in ${(durationMs/1000).toFixed(1)}s`);
  console.log(`   Processed:       ${processed}`);
  console.log(`   Inserted:        ${inserted}`);
  console.log(`   Updated:         ${updated}`);
  console.log(`   Skipped:         ${skipped} (discontinued/invalid)`);
  console.log(`   Images mirrored: ${imgMirrored}`);
  console.log(`   Images failed:   ${imgFailed}`);
  console.log(`   Errors:          ${errors.length}`);
  if (errors.length) console.log('   First 5 errors:', errors.slice(0, 5));

  // ── Update import log ─────────────────────────────────────────────────────
  if (!DRY_RUN && logId) {
    await pool.query(`
      UPDATE wheel1_import_log SET
        completed_at = NOW(), status = $1,
        rows_processed = $2, rows_inserted = $3, rows_updated = $4, rows_skipped = $5,
        images_mirrored = $6, images_failed = $7,
        errors = $8,
        metadata = $9
      WHERE id = $10
    `, [
      errors.length === 0 ? 'success' : 'partial',
      processed, inserted, updated, skipped,
      imgMirrored, imgFailed,
      JSON.stringify(errors.slice(0, 50)),
      JSON.stringify({ durationMs, feedPath, limit: LIMIT === Infinity ? null : LIMIT }),
      logId
    ]);
    console.log(`   📋 Import log updated (id: ${logId})`);

    // ── Verify row count ──────────────────────────────────────────────────
    const cnt = await pool.query('SELECT COUNT(*) FROM wheel1_products WHERE is_discontinued = FALSE');
    console.log(`\n📦 wheel1_products active rows in DB: ${cnt.rows[0].count}`);
  }

  await pool.end();
  if (DRY_RUN) console.log('\n(Dry run — nothing written to DB or Blob)');
}

main().catch(e => {
  console.error('Fatal:', e.message, e.stack);
  pool.end().catch(() => {});
  process.exit(1);
});
