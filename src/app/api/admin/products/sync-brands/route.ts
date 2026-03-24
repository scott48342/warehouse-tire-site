import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Sync tire brands from all suppliers into tire_brands_cache table.
 * Queries the unified tire search API for common sizes to discover brands.
 */
export async function POST(req: Request) {
  const pool = getPool();
  
  try {
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tire_brands_cache (
        brand TEXT PRIMARY KEY,
        supplier TEXT,
        last_seen TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Common tire sizes to query for brand discovery
    const sizes = [
      "225/65R17",
      "265/70R17", 
      "275/55R20",
      "245/45R18",
      "205/55R16",
      "35x12.50R20",
    ];
    
    const discoveredBrands = new Map<string, string>(); // brand -> supplier
    
    // Query each size from unified search API
    for (const size of sizes) {
      try {
        const res = await fetch(
          `${getBaseUrl()}/api/tires/search?size=${encodeURIComponent(size)}&minQty=1`,
          { cache: "no-store" }
        );
        
        if (res.ok) {
          const data = await res.json();
          const results = data.results || [];
          
          for (const tire of results) {
            const brand = tire.brand?.trim();
            const source = tire.source || "unknown";
            
            if (brand && !discoveredBrands.has(brand)) {
              // Map source to supplier name
              let supplier = "WheelPros";
              if (source === "km" || source.includes("km")) {
                supplier = "K&M";
              } else if (source.includes("tirewire")) {
                supplier = "Tirewire";
              }
              discoveredBrands.set(brand, supplier);
            }
          }
        }
      } catch (err) {
        console.error(`[sync-brands] Error fetching size ${size}:`, err);
      }
    }
    
    // Upsert brands into cache
    let inserted = 0;
    let updated = 0;
    
    for (const [brand, supplier] of discoveredBrands) {
      const result = await pool.query(`
        INSERT INTO tire_brands_cache (brand, supplier, last_seen)
        VALUES ($1, $2, NOW())
        ON CONFLICT (brand) DO UPDATE SET 
          supplier = EXCLUDED.supplier,
          last_seen = NOW()
        RETURNING (xmax = 0) as is_insert
      `, [brand, supplier]);
      
      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    // Get total count
    const { rows: countRows } = await pool.query(`
      SELECT COUNT(*) as total FROM tire_brands_cache
    `);
    
    return NextResponse.json({
      success: true,
      discovered: discoveredBrands.size,
      inserted,
      updated,
      total: parseInt(countRows[0]?.total || "0", 10),
      brands: Array.from(discoveredBrands.keys()).sort(),
    });
  } catch (err: any) {
    console.error("[sync-brands] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

// Also support GET to check status
export async function GET() {
  const pool = getPool();
  
  try {
    // Check if table exists
    const { rows: tableCheck } = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tire_brands_cache'
      ) as exists
    `);
    
    if (!tableCheck[0]?.exists) {
      return NextResponse.json({
        synced: false,
        message: "Brand cache not initialized. POST to this endpoint to sync.",
      });
    }
    
    // Get brands by supplier
    const { rows } = await pool.query(`
      SELECT brand, supplier, last_seen
      FROM tire_brands_cache
      ORDER BY supplier, brand
    `);
    
    const bySupplier: Record<string, string[]> = {};
    for (const r of rows) {
      const supplier = r.supplier || "Unknown";
      if (!bySupplier[supplier]) bySupplier[supplier] = [];
      bySupplier[supplier].push(r.brand);
    }
    
    return NextResponse.json({
      synced: true,
      total: rows.length,
      bySupplier,
      lastSync: rows[0]?.last_seen || null,
    });
  } catch (err: any) {
    console.error("[sync-brands] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
