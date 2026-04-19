/**
 * Accessory Sync Cron Job
 * 
 * Syncs accessories from WheelPros TechFeed (SFTP) or API.
 * Runs daily at 4:30 AM EST.
 * 
 * Vercel cron config (add to vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/cron/sync-accessories", "schedule": "30 9 * * *" }
 *   ]
 * }
 * 
 * Note: 9:30 UTC = 4:30 AM EST (5:30 AM EDT)
 */

import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";
import Client from "ssh2-sftp-client";
import fs from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

// Category mapping
const CATEGORY_MAP: Record<string, string> = {
  'CAP': 'center_cap',
  'LUG': 'lug_nut',
  'HUB': 'hub_ring',
  'LED': 'lighting',
  'LIGHT': 'lighting',
  'TPMS': 'tpms',
  'VALVE': 'valve_stem',
  'SPACER': 'spacer',
};

const BRAND_NAMES: Record<string, string> = {
  'GO': 'Gorilla Automotive',
  'MO': 'Moto Metal',
  'FU': 'Fuel',
  'KM': 'KMC',
  'XD': 'XD',
  'HE': 'Helo',
  'AS': 'Asanti',
  'AR': 'American Racing',
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseThreadSize(title: string): string | null {
  const t = title.toUpperCase();
  const metric = t.match(/[M ]?(\d{2})[X-](\d\.\d+)/);
  if (metric) return `M${metric[1]}x${metric[2]}`;
  const sae = t.match(/(\d\/\d+)[- ]?(\d+)/);
  if (sae) return `${sae[1]}-${sae[2]}`;
  return null;
}

function parseSeatType(title: string): string | null {
  const t = title.toUpperCase();
  if (t.includes('BALL') || t.includes('RADIUS')) return 'ball';
  if (t.includes('MAG') || t.includes('SHANK')) return 'mag';
  if (t.includes('FLAT') || t.includes('WASHER')) return 'flat';
  if (t.includes('ACORN') || t.includes('BULGE') || t.includes('CONICAL')) return 'conical';
  return null;
}

function parseHubRing(title: string): { outer: number; inner: number } | null {
  const t = title.toUpperCase();
  const odId = t.match(/(\d+(?:\.\d+)?)\s*OD[- ]?(\d+(?:\.\d+)?)\s*ID/);
  if (odId) return { outer: parseFloat(odId[1]), inner: parseFloat(odId[2]) };
  const simple = t.match(/(\d{2,3}(?:\.\d+)?)[\/\-](\d{2,3}(?:\.\d+)?)/);
  if (simple && parseFloat(simple[1]) > parseFloat(simple[2])) {
    return { outer: parseFloat(simple[1]), inner: parseFloat(simple[2]) };
  }
  return null;
}

function parseBoltPattern(title: string): string | null {
  const bp = title.toUpperCase().match(/(\d)[X-](\d{3}(?:\.\d)?)/);
  return bp ? `${bp[1]}x${bp[2]}` : null;
}

function parseWheelBrand(title: string, brandCode: string): string | null {
  const t = title.toUpperCase();
  if (t.includes('MOTO') || brandCode === 'MO') return 'Moto Metal';
  if (t.includes('FUEL') || brandCode === 'FU') return 'Fuel';
  if (t.includes('XD') || brandCode === 'XD') return 'XD';
  if (t.includes('KMC') || brandCode === 'KM') return 'KMC';
  if (t.includes('HELO') || brandCode === 'HE') return 'Helo';
  return null;
}

function categorize(subType: string, title: string): { category: string; subType: string | null } {
  const st = (subType || '').toUpperCase();
  const t = (title || '').toUpperCase();
  
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (st.includes(key) || t.includes(key)) {
      return { category: cat, subType: key.toLowerCase() };
    }
  }
  
  return { category: 'other', subType: null };
}

async function downloadFromSFTP(): Promise<{ techPath: string; invPath: string } | null> {
  const sftp = new Client();
  const techPath = path.join(os.tmpdir(), 'Accessory_TechGuide.csv');
  const invPath = path.join(os.tmpdir(), 'accessoriesInvPriceData.csv');
  
  try {
    await sftp.connect({
      host: 'ftp.wheelpros.com',
      port: 22,
      username: 'Warehouse1',
      password: process.env.WHEELPROS_SFTP_PASS || 'Websters1!',
      retries: 2,
      retry_factor: 2,
      retry_minTimeout: 2000,
    });
    
    await sftp.get('/TechFeed/Accessory_TechGuide.csv', techPath);
    await sftp.get('/CommonFeed/USD/ACCESSORIES/accessoriesInvPriceData.csv', invPath);
    await sftp.end();
    
    return { techPath, invPath };
  } catch (err: any) {
    console.warn('[sync-accessories] SFTP failed:', err.message);
    await sftp.end().catch(() => {});
    return null;
  }
}

async function importCSV(pool: any, csvPath: string): Promise<number> {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  
  const header = parseCSVLine(lines[0]);
  console.log('[sync-accessories] CSV columns:', header.length);
  
  // Begin transaction
  const client = await pool.connect();
  let imported = 0;
  
  try {
    await client.query('BEGIN');
    
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      header.forEach((h, j) => row[h.toLowerCase().replace(/ /g, '_')] = cols[j]);
      
      const sku = row.sku || row.part_number;
      const title = row.product_desc || row.title;
      if (!sku || !title) continue;
      
      const brandCode = row.brand_code_3 || row.brand_code || '';
      const subTypeRaw = row.sub_type || '';
      const msrp = parseFloat(row.msrp) || null;
      const map = parseFloat(row.map_price || row.map) || null;
      
      const { category, subType } = categorize(subTypeRaw, title);
      const brand = BRAND_NAMES[brandCode] || row.brand_desc || brandCode;
      const cost = msrp ? msrp * 0.75 : null;
      const sellPrice = cost ? Math.min(cost * 1.30, msrp || Infinity) : map || msrp;
      
      const threadSize = parseThreadSize(title);
      const seatType = parseSeatType(title);
      const hubRing = parseHubRing(title);
      const boltPattern = parseBoltPattern(title);
      const wheelBrand = parseWheelBrand(title, brandCode);
      
      await client.query(`
        INSERT INTO accessories (
          sku, title, brand, brand_code, category, sub_type,
          msrp, map_price, sell_price, cost,
          image_url, upc,
          thread_size, seat_type,
          outer_diameter, inner_diameter,
          bolt_pattern, wheel_brand
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (sku) DO UPDATE SET
          title = EXCLUDED.title,
          brand = EXCLUDED.brand,
          category = EXCLUDED.category,
          msrp = EXCLUDED.msrp,
          map_price = EXCLUDED.map_price,
          sell_price = EXCLUDED.sell_price,
          image_url = EXCLUDED.image_url,
          updated_at = NOW()
      `, [
        sku, title, brand, brandCode, category, subType,
        msrp, map, sellPrice, cost,
        row.image_url || row.image_url1, row.upc,
        threadSize, seatType,
        hubRing?.outer, hubRing?.inner,
        boltPattern, wheelBrand,
      ]);
      
      imported++;
    }
    
    await client.query('COMMIT');
    return imported;
    
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function syncInventory(pool: any, invPath: string): Promise<{ inStock: number; outOfStock: number }> {
  const content = fs.readFileSync(invPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/ /g, '_'));
  
  // Find column indexes
  const skuIdx = header.findIndex(h => h === 'partnumber' || h === 'part_number' || h === 'sku');
  const qtyIdx = header.findIndex(h => h === 'totalqoh' || h === 'total_qoh' || h === 'qty');
  
  if (skuIdx === -1 || qtyIdx === -1) {
    console.warn('[sync-accessories] Missing inventory columns');
    return { inStock: 0, outOfStock: 0 };
  }
  
  // Build SKU -> quantity map
  const inventory = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const sku = cols[skuIdx]?.trim();
    const qty = parseInt(cols[qtyIdx]) || 0;
    if (sku) inventory.set(sku, qty);
  }
  
  console.log(`[sync-accessories] Parsed ${inventory.size} SKUs from inventory feed`);
  
  // Get all accessory SKUs and update in_stock
  const result = await pool.query('SELECT sku FROM accessories');
  const allSkus = result.rows.map((r: any) => r.sku);
  
  const inStockSkus: string[] = [];
  const outOfStockSkus: string[] = [];
  
  for (const sku of allSkus) {
    if ((inventory.get(sku) || 0) > 0) {
      inStockSkus.push(sku);
    } else {
      outOfStockSkus.push(sku);
    }
  }
  
  // Batch update
  if (inStockSkus.length > 0) {
    await pool.query(
      'UPDATE accessories SET in_stock = true, updated_at = NOW() WHERE sku = ANY($1)',
      [inStockSkus]
    );
  }
  if (outOfStockSkus.length > 0) {
    await pool.query(
      'UPDATE accessories SET in_stock = false, updated_at = NOW() WHERE sku = ANY($1)',
      [outOfStockSkus]
    );
  }
  
  return { inStock: inStockSkus.length, outOfStock: outOfStockSkus.length };
}

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }
  
  const startTime = Date.now();
  let result: any = { source: '', count: 0, inStock: 0, outOfStock: 0, duration: 0 };
  
  try {
    // Ensure table exists
    const schema = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/db/schema/accessories.sql'),
      'utf8'
    );
    await pool.query(schema);
    
    // Download both TechGuide and inventory from SFTP
    const files = await downloadFromSFTP();
    
    if (files) {
      result.source = 'sftp';
      
      // Import product data from TechGuide
      result.count = await importCSV(pool, files.techPath);
      
      // Sync inventory from CommonFeed
      const invResult = await syncInventory(pool, files.invPath);
      result.inStock = invResult.inStock;
      result.outOfStock = invResult.outOfStock;
      
      // Cleanup temp files
      try { fs.unlinkSync(files.techPath); } catch {}
      try { fs.unlinkSync(files.invPath); } catch {}
    } else {
      result.source = 'skipped';
    }
    
    result.duration = Date.now() - startTime;
    
    console.log(`[sync-accessories] Complete: ${result.count} products, ${result.inStock} in stock in ${result.duration}ms`);
    
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
    
  } catch (err: any) {
    console.error('[sync-accessories] Error:', err);
    return NextResponse.json({
      ok: false,
      error: err.message,
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}
