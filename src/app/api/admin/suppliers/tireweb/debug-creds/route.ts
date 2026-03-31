import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Minimal test - just check env and do basic import
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || "not set";
    
    // Dynamic import pg to catch any import errors
    let pgStatus = "not loaded";
    try {
      const pg = await import("pg");
      pgStatus = pg.Pool ? "loaded successfully" : "loaded but no Pool";
    } catch (pgErr: any) {
      pgStatus = `failed: ${pgErr.message}`;
    }
    
    // Try to connect and query
    let dbStatus = "not tested";
    let connectionRows: any[] = [];
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 1,
      });
      
      const { rows } = await pool.query(
        'SELECT provider, connection_id, enabled FROM tireweb_connections'
      );
      connectionRows = rows;
      dbStatus = `connected, ${rows.length} connections`;
      await pool.end();
    } catch (dbErr: any) {
      dbStatus = `failed: ${dbErr.message}`;
    }
    
    // Also check credentials
    let credsStatus = "not checked";
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
        max: 1,
      });
      const { rows } = await pool.query(
        "SELECT key, LENGTH(value) as len FROM tireweb_config"
      );
      credsStatus = rows.length > 0 
        ? rows.map((r: any) => `${r.key}: ${r.len} chars`).join(", ")
        : "no credentials found";
      await pool.end();
    } catch (err: any) {
      credsStatus = `error: ${err.message}`;
    }
    
    return NextResponse.json({
      dbUrlPrefix: dbUrl.slice(0, 30) + "...",
      pgStatus,
      dbStatus,
      connections: connectionRows,
      credsStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3),
    });
  }
}
