import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
    
    const results: string[] = [];
    
    // Create tireweb_config table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tireweb_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push("✓ Created tireweb_config");
    
    // Create tireweb_connections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tireweb_connections (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        enabled BOOLEAN DEFAULT false,
        connection_id INTEGER,
        last_test_at TIMESTAMPTZ,
        last_test_status VARCHAR(20),
        last_test_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push("✓ Created tireweb_connections");
    
    // Insert default connections (disabled by default)
    await pool.query(`
      INSERT INTO tireweb_connections (provider, display_name, enabled, connection_id)
      VALUES 
        ('tireweb_atd', 'ATD', true, 488677),
        ('tireweb_ntw', 'NTW', true, 488546),
        ('tireweb_usautoforce', 'US AutoForce', true, 488548)
      ON CONFLICT (provider) DO UPDATE SET
        connection_id = EXCLUDED.connection_id,
        enabled = true
    `);
    results.push("✓ Inserted/updated connections");
    
    await pool.end();
    
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
