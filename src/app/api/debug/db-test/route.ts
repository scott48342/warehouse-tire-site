import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") || 2022);
  const make = url.searchParams.get("make") || "ford";
  const model = url.searchParams.get("model") || "f-150";
  
  const results: Record<string, unknown> = {
    env: {
      isVercel: process.env.VERCEL === "1" || !!process.env.VERCEL_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      postgresUrlPrefix: process.env.POSTGRES_URL?.substring(0, 50) + "...",
    },
  };
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 1,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    // Test 1: Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'vehicle_fitments'
      ) as exists
    `);
    results.tableExists = tableCheck.rows[0]?.exists;
    
    // Test 2: Count records if table exists
    if (tableCheck.rows[0]?.exists) {
      const countResult = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
      results.recordCount = countResult.rows[0]?.cnt;
      
      // Test 3: Query specific vehicle
      const fitmentResult = await pool.query(`
        SELECT id, modification_id, bolt_pattern 
        FROM vehicle_fitments 
        WHERE year = $1 AND make = $2 AND model = $3
        LIMIT 5
      `, [year, make.toLowerCase(), model.toLowerCase()]);
      
      results.vehicleQuery = {
        year,
        make: make.toLowerCase(),
        model: model.toLowerCase(),
        found: fitmentResult.rows.length,
        samples: fitmentResult.rows,
      };
    }
    
    results.success = true;
    return NextResponse.json(results);
  } catch (error: any) {
    results.success = false;
    results.error = error?.message || String(error);
    results.stack = error?.stack?.split("\n").slice(0, 5);
    return NextResponse.json(results, { status: 500 });
  } finally {
    await pool.end();
  }
}
