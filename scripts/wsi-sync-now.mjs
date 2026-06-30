/**
 * WSI Sync â€” one-shot runner for local testing
 * node scripts/wsi-sync-now.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pg from 'pg';

const FTP_USER = 'warehouse_tire@wsiwholesale.com';
const FTP_PASS = process.env.WSI_FTP_PASSWORD || 'IV^S~MPCnfrB';
const FTP_URL  = `ftp://wsiwholesale.com/wsi_inventory_for_warehouse_tire.csv`;

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

function parseCSVLine(line) {
  const fields = [];
  let cur = '', inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { fields.push(cur); cur = ''; }
    else { cur += ch; }
  }
  fields.push(cur);
  return fields;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] ?? '').trim(); });
    return row;
  });
}

function parseBoltPatterns(raw) {
  if (!raw?.trim()) return [null, null];
  const parts = raw.trim().split('/').map(p => p.trim().replace(/^(\d+)[-x](.+)$/, '$1x$2'));
  return [parts[0] || null, parts[1] || null];
}

function parseSize(raw) {
  if (!raw) return null;
  const m = raw.toUpperCase().match(/^(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)$/);
  return m ? { diameter: parseFloat(m[1]), width: parseFloat(m[2]) } : null;
}

function toNum(v) {
  if (!v || v.toLowerCase() === 'call') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function toInt(v) {
  const n = parseInt(v || '0', 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

async function main() {
  console.log('â¬‡ï¸  Downloading WSI FTP inventory...');
  const tmpFile = path.join(os.tmpdir(), `wsi_${Date.now()}.csv`);
  execSync(`curl.exe -s --retry 3 --retry-delay 5 -u "${FTP_USER}:${FTP_PASS}" "${FTP_URL}" -o "${tmpFile}"`, { timeout: 120_000 });
  const stat = fs.statSync(tmpFile);
  console.log(`   Downloaded ${(stat.size / 1_048_576).toFixed(1)} MB`);

  const text = fs.readFileSync(tmpFile, 'utf-8');
  fs.unlinkSync(tmpFile);

  const rawRows = parseCSV(text);
  console.log(`ðŸ“‹ Parsed ${rawRows.length} rows`);

  const wheelRows = rawRows
    .filter(r => r.ItemCategory?.toLowerCase() === 'wheels')
    .map(r => {
      const sku = r.PartNumber?.trim();
      if (!sku) return null;
      const size = parseSize(r.Size);
      if (!size) return null;
      const [bp1, bp2] = parseBoltPatterns(r.BoltPattern);
      return {
        sku, brand: (r.Brand || 'Unknown').trim(),
        style: r.Style?.trim() || null, finish: r.Finish?.trim() || null,
        diameter: size.diameter, width: size.width,
        bp1, bp2,
        offset_mm: r.Offset ? (parseFloat(r.Offset) || null) : null,
        centerbore: toNum(r.CenterBore),
        wsi_stock: toInt(r.WSIStock), alt_stock: toInt(r.AltStock),
        catalog_price: toNum(r.WSICatalogPrice), dealer_cost: toNum(r.Cost),
        load_rating: toNum(r.LoadRating),
        image_url: r.ImageURL?.trim() || null, logo_url: r.LogoURL?.trim() || null,
      };
    })
    .filter(Boolean);

  console.log(`ðŸ”§ ${wheelRows.length} wheel rows to upsert`);

  const client = await pool.connect();
  let upserted = 0;
  const CHUNK = 200; // ~3400 params, well within pg limit
  const t0 = Date.now();

  try {
    for (let i = 0; i < wheelRows.length; i += CHUNK) {
      const chunk = wheelRows.slice(i, i + CHUNK);

      // Build bulk VALUES â€” avoid the broken one-liner above; do it cleanly
      const params = [];
      const phs = chunk.map((r, idx) => {
        const b = idx * 17;
        params.push(
          r.sku, r.brand, r.style, r.finish, r.diameter, r.width,
          r.bp1, r.bp2, r.offset_mm, r.centerbore,
          r.wsi_stock, r.alt_stock, r.catalog_price, r.dealer_cost,
          r.load_rating, r.image_url, r.logo_url
        );
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16},$${b+17},NOW())`;
      });

      await client.query(`
        INSERT INTO wsi_wheels
          (sku,brand,style,finish,diameter,width,bp1,bp2,offset_mm,centerbore,
           wsi_stock,alt_stock,catalog_price,dealer_cost,load_rating,image_url,logo_url,synced_at)
        VALUES ${phs.join(',')}
        ON CONFLICT (sku) DO UPDATE SET
          brand=EXCLUDED.brand, style=EXCLUDED.style, finish=EXCLUDED.finish,
          diameter=EXCLUDED.diameter, width=EXCLUDED.width, bp1=EXCLUDED.bp1, bp2=EXCLUDED.bp2,
          offset_mm=EXCLUDED.offset_mm, centerbore=EXCLUDED.centerbore,
          wsi_stock=EXCLUDED.wsi_stock, alt_stock=EXCLUDED.alt_stock,
          catalog_price=EXCLUDED.catalog_price, dealer_cost=EXCLUDED.dealer_cost,
          load_rating=EXCLUDED.load_rating,
          image_url=COALESCE(EXCLUDED.image_url, wsi_wheels.image_url),
          logo_url=COALESCE(EXCLUDED.logo_url, wsi_wheels.logo_url),
          synced_at=NOW()
      `, params);

      upserted += chunk.length;
      const pct = Math.round(upserted / wheelRows.length * 100);
      process.stdout.write(`\r   ${upserted}/${wheelRows.length} (${pct}%) â€” ${((Date.now()-t0)/1000).toFixed(1)}s`);
    }
    console.log('\nâœ… Done!');
  } catch(e) {
    console.error('\nâŒ', e.message);
    throw e;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`
    SELECT COUNT(*) total,
           COUNT(*) FILTER (WHERE wsi_stock > 0 OR alt_stock > 0) in_stock,
           COUNT(DISTINCT brand) brands
    FROM wsi_wheels
  `);
  console.log(`\nðŸ“Š DB Stats:`);
  console.log(`   Total SKUs:  ${rows[0].total}`);
  console.log(`   In stock:    ${rows[0].in_stock}`);
  console.log(`   Brands:      ${rows[0].brands}`);
  await pool.end();
}

main().catch(err => { console.error('âŒ', err.message); process.exit(1); });
