/**
 * Cron Job: Sync Suspension Fitments from WheelPros
 * 
 * Triggered daily by Vercel Cron.
 * Downloads Accessory_TechGuide.csv, parses vehicle fitment from descriptions,
 * and updates the suspension_fitments table.
 * 
 * Schedule: Daily at 4 AM EST (cron: 0 9 * * *)
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

// Dynamic imports to avoid bundling issues
async function getSftpClient() {
  const mod = await import("ssh2-sftp-client");
  const Client = mod.default;
  return Client;
}

async function getCsvParse() {
  const { parse } = await import("csv-parse/sync");
  return parse;
}

async function getPg() {
  const pg = await import("pg");
  return pg.default;
}

// ============================================================================
// Configuration
// ============================================================================

const SFTP_CONFIG = {
  host: "sftp.wheelpros.com",
  port: 22,
  username: process.env.WHEELPROS_SFTP_USER || "Warehouse1",
  password: process.env.WHEELPROS_SFTP_PASS || "",
};

// ============================================================================
// Parser (same as import script)
// ============================================================================

const JEEP_CODES: Record<string, { make: string; model: string; yearStart: number; yearEnd: number }> = {
  'TJ': { make: 'Jeep', model: 'Wrangler TJ', yearStart: 1997, yearEnd: 2006 },
  'LJ': { make: 'Jeep', model: 'Wrangler LJ', yearStart: 2004, yearEnd: 2006 },
  'JK': { make: 'Jeep', model: 'Wrangler JK', yearStart: 2007, yearEnd: 2018 },
  'JK2': { make: 'Jeep', model: 'Wrangler JK 2-Door', yearStart: 2007, yearEnd: 2018 },
  'JK4': { make: 'Jeep', model: 'Wrangler JK 4-Door', yearStart: 2007, yearEnd: 2018 },
  'JL': { make: 'Jeep', model: 'Wrangler JL', yearStart: 2018, yearEnd: 2026 },
  'JL2': { make: 'Jeep', model: 'Wrangler JL 2-Door', yearStart: 2018, yearEnd: 2026 },
  'JL4': { make: 'Jeep', model: 'Wrangler JL 4-Door', yearStart: 2018, yearEnd: 2026 },
  'JT': { make: 'Jeep', model: 'Gladiator', yearStart: 2020, yearEnd: 2026 },
  'JLDEH': { make: 'Jeep', model: 'Wrangler JL Diesel', yearStart: 2020, yearEnd: 2026 },
  'JTED': { make: 'Jeep', model: 'Gladiator Diesel', yearStart: 2021, yearEnd: 2026 },
  'XJ': { make: 'Jeep', model: 'Cherokee XJ', yearStart: 1984, yearEnd: 2001 },
  'KJ': { make: 'Jeep', model: 'Liberty KJ', yearStart: 2002, yearEnd: 2007 },
  'KK': { make: 'Jeep', model: 'Liberty KK', yearStart: 2008, yearEnd: 2012 },
  'KL': { make: 'Jeep', model: 'Cherokee KL', yearStart: 2014, yearEnd: 2026 },
  'WK2': { make: 'Jeep', model: 'Grand Cherokee WK2', yearStart: 2011, yearEnd: 2021 },
};

const MODEL_PATTERNS = [
  { pattern: /SILVERADO\s*(\d+)/i, make: 'Chevrolet', model: (m: RegExpMatchArray) => `Silverado ${m[1]}` },
  { pattern: /SIERRA\s*(\d+)/i, make: 'GMC', model: (m: RegExpMatchArray) => `Sierra ${m[1]}` },
  { pattern: /GM\s*1500/i, make: 'Chevrolet', model: () => 'Silverado 1500', altMake: 'GMC', altModel: 'Sierra 1500' },
  { pattern: /GM\s*2500/i, make: 'Chevrolet', model: () => 'Silverado 2500HD', altMake: 'GMC', altModel: 'Sierra 2500HD' },
  { pattern: /CHEVY\s*(?:\/\s*)?GMC/i, make: 'Chevrolet', model: () => 'Silverado 1500', altMake: 'GMC', altModel: 'Sierra 1500' },
  { pattern: /F-?150/i, make: 'Ford', model: () => 'F-150' },
  { pattern: /F-?250/i, make: 'Ford', model: () => 'F-250' },
  { pattern: /F-?350/i, make: 'Ford', model: () => 'F-350' },
  { pattern: /RANGER/i, make: 'Ford', model: () => 'Ranger' },
  { pattern: /BRONCO/i, make: 'Ford', model: () => 'Bronco' },
  { pattern: /RAPTOR/i, make: 'Ford', model: () => 'F-150 Raptor' },
  { pattern: /EXPEDITION|EXPED\b/i, make: 'Ford', model: () => 'Expedition' },
  { pattern: /RAM\s*(?:AIR\s*)?1500/i, make: 'Ram', model: () => '1500' },
  { pattern: /RAM\s*2500/i, make: 'Ram', model: () => '2500' },
  { pattern: /RAM\s*3500/i, make: 'Ram', model: () => '3500' },
  { pattern: /TUNDRA/i, make: 'Toyota', model: () => 'Tundra' },
  { pattern: /TACOMA/i, make: 'Toyota', model: () => 'Tacoma' },
  { pattern: /4RUNNER/i, make: 'Toyota', model: () => '4Runner' },
  { pattern: /WRANGLER/i, make: 'Jeep', model: () => 'Wrangler' },
  { pattern: /GLADIATOR/i, make: 'Jeep', model: () => 'Gladiator' },
  { pattern: /TITAN/i, make: 'Nissan', model: () => 'Titan' },
  { pattern: /FRONTIER/i, make: 'Nissan', model: () => 'Frontier' },
  { pattern: /FORESTER/i, make: 'Subaru', model: () => 'Forester' },
  { pattern: /COLORADO/i, make: 'Chevrolet', model: () => 'Colorado' },
  { pattern: /CANYON/i, make: 'GMC', model: () => 'Canyon' },
];

const YEAR_PATTERNS = [
  { re: /[''](\d{2})\s*[-–]\s*['']?(\d{2})(?!\d)/g, type: '2digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{4})/g, type: '4digit' },
  { re: /(\d{4})\s*[-–]\s*(\d{2})(?!\d)/g, type: 'mixed' },
  { re: /(\d{4})\s*\+/g, type: 'plus' },
  { re: /(?:^|[^0-9])(\d{4})(?:[^0-9]|$)/g, type: 'single' },
];

function parseDescription(desc: string) {
  const result: {
    vehicles: { make: string; model: string }[];
    yearStart: number | null;
    yearEnd: number | null;
    liftHeight: number | null;
  } = { vehicles: [], yearStart: null, yearEnd: null, liftHeight: null };
  
  if (!desc) return result;
  
  // Lift height
  const liftMatch = desc.match(/(\d+(?:\.\d+)?)\s*[''"""]\s*(?:LIFT|LEVELING)/i);
  if (liftMatch) {
    const val = parseFloat(liftMatch[1]);
    if (val > 0 && val <= 12) result.liftHeight = val;
  }
  
  // Jeep codes
  for (const [code, info] of Object.entries(JEEP_CODES)) {
    if (new RegExp(`\\b${code}\\b`, 'i').test(desc)) {
      result.vehicles.push({ make: info.make, model: info.model });
      if (!result.yearStart) {
        result.yearStart = info.yearStart;
        result.yearEnd = info.yearEnd;
      }
    }
  }
  
  // Year patterns
  for (const { re, type } of YEAR_PATTERNS) {
    re.lastIndex = 0;
    const match = re.exec(desc);
    if (match) {
      if (type === '2digit') {
        let y1 = parseInt(match[1]), y2 = parseInt(match[2]);
        result.yearStart = y1 >= 50 ? 1900 + y1 : 2000 + y1;
        result.yearEnd = y2 >= 50 ? 1900 + y2 : 2000 + y2;
      } else if (type === 'mixed') {
        result.yearStart = parseInt(match[1]);
        result.yearEnd = Math.floor(result.yearStart / 100) * 100 + parseInt(match[2]);
      } else if (type === '4digit') {
        result.yearStart = parseInt(match[1]);
        result.yearEnd = parseInt(match[2]);
      } else if (type === 'plus') {
        result.yearStart = parseInt(match[1]);
        result.yearEnd = 2026;
      } else if (type === 'single') {
        const yr = parseInt(match[1]);
        if (yr >= 1980 && yr <= 2030 && !result.yearStart) {
          result.yearStart = yr;
          result.yearEnd = yr;
        }
      }
      if (result.yearStart) break;
    }
  }
  
  // Model patterns
  for (const mp of MODEL_PATTERNS) {
    const match = desc.match(mp.pattern);
    if (match) {
      result.vehicles.push({
        make: mp.make,
        model: typeof mp.model === 'function' ? mp.model(match) : mp.model,
      });
      if ((mp as any).altMake) {
        result.vehicles.push({ make: (mp as any).altMake, model: (mp as any).altModel });
      }
    }
  }
  
  // Dedupe
  const seen = new Set<string>();
  result.vehicles = result.vehicles.filter(v => {
    const key = `${v.make}|${v.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  return result;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "run";
  
  if (action === "status") {
    return NextResponse.json({
      ok: true,
      action: "status",
      configured: !!process.env.WHEELPROS_SFTP_PASS,
      at: new Date().toISOString(),
    });
  }
  
  console.log("[cron/sync-suspension] Starting sync...");
  const t0 = Date.now();
  
  try {
    // Get dependencies
    const [SftpClient, parse, pg] = await Promise.all([
      getSftpClient(),
      getCsvParse(),
      getPg(),
    ]);
    
    // Connect to SFTP
    const sftp = new SftpClient();
    await sftp.connect(SFTP_CONFIG);
    
    // Download techfeed
    const csv = await sftp.get("/TechFeed/ACCESSORIES/Accessory_TechGuide.csv");
    await sftp.end();
    
    // Parse CSV
    const rows = parse(csv, { columns: true, skip_empty_lines: true }) as any[];
    
    // Filter to suspension parts
    const suspensionParts = rows.filter((r: any) => {
      const str = JSON.stringify(r).toLowerCase();
      return str.includes("lift") || str.includes("suspension") || str.includes("leveling");
    });
    
    // Parse and prepare records
    const records: any[] = [];
    for (const row of suspensionParts) {
      const parsed = parseDescription(row.product_desc);
      if (!parsed || parsed.vehicles.length === 0 || !parsed.yearStart) continue;
      
      for (const vehicle of parsed.vehicles) {
        records.push({
          sku: row.sku,
          product_desc: row.product_desc,
          brand: row.brand_desc,
          product_type: row.product_sub_type,
          lift_height: parsed.liftHeight,
          make: vehicle.make,
          model: vehicle.model,
          year_start: parsed.yearStart,
          year_end: parsed.yearEnd,
          msrp: parseFloat(row.msrp) || null,
          map_price: parseFloat(row.map_price) || null,
          image_url: row.image_url || null,
        });
      }
    }
    
    // Connect to database
    const { Pool } = pg;
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    });
    
    // Clear and insert
    await pool.query(`DELETE FROM suspension_fitments WHERE source = 'wheelpros_techfeed'`);
    
    const BATCH_SIZE = 100;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      const values = batch.map((_, idx) => {
        const offset = idx * 12;
        return `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11}, $${offset+12})`;
      }).join(", ");
      
      const params = batch.flatMap((r: any) => [
        r.sku, r.product_desc, r.brand, r.product_type, r.lift_height,
        r.make, r.model, r.year_start, r.year_end,
        r.msrp, r.map_price, r.image_url,
      ]);
      
      await pool.query(`
        INSERT INTO suspension_fitments (sku, product_desc, brand, product_type, lift_height, make, model, year_start, year_end, msrp, map_price, image_url)
        VALUES ${values}
        ON CONFLICT (sku, make, model, year_start, year_end) DO UPDATE SET
          product_desc = EXCLUDED.product_desc,
          brand = EXCLUDED.brand,
          lift_height = EXCLUDED.lift_height,
          msrp = EXCLUDED.msrp,
          map_price = EXCLUDED.map_price,
          image_url = EXCLUDED.image_url,
          updated_at = NOW()
      `, params);
    }
    
    // Get stats
    const { rows: stats } = await pool.query(`
      SELECT COUNT(*) as total, COUNT(DISTINCT sku) as skus, COUNT(DISTINCT make || model) as vehicles
      FROM suspension_fitments
    `);
    
    await pool.end();
    
    const result = {
      success: true,
      durationMs: Date.now() - t0,
      totalRows: rows.length,
      suspensionParts: suspensionParts.length,
      recordsInserted: records.length,
      uniqueSkus: parseInt(stats[0].skus),
      uniqueVehicles: parseInt(stats[0].vehicles),
    };
    
    console.log("[cron/sync-suspension] Complete:", result);
    
    return NextResponse.json({
      ok: true,
      action: "sync",
      result,
      at: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[cron/sync-suspension] Error:", error);
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      durationMs: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
