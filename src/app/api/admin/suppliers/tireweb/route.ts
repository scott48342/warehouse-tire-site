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

const TIREWEB_PROVIDERS = ["tireweb_atd", "tireweb_ntw", "tireweb_usautoforce"];

/**
 * Get TireWeb connections and config
 */
export async function GET() {
  const pool = getPool();
  try {
    // Ensure table exists
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tireweb_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get connections
    const { rows: connections } = await pool.query(`
      SELECT * FROM tireweb_connections ORDER BY provider
    `);

    // Get config (access key and group token existence, not values)
    const { rows: configRows } = await pool.query(`
      SELECT key, (value IS NOT NULL AND value != '') as has_value 
      FROM tireweb_config 
      WHERE key IN ('access_key', 'group_token')
    `);

    const hasAccessKey = configRows.find((r: any) => r.key === "access_key")?.has_value ?? false;
    const hasGroupToken = configRows.find((r: any) => r.key === "group_token")?.has_value ?? false;

    return NextResponse.json({
      connections,
      config: {
        access_key: hasAccessKey ? "••••••••" : null,
        group_token: hasGroupToken ? "••••••••" : null,
        configured: hasAccessKey && hasGroupToken,
      },
    });
  } catch (err: any) {
    console.error("[tireweb] GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Create or update a TireWeb connection
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { provider, enabled, connection_id } = body;

  if (!provider || !TIREWEB_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Upsert connection
    await pool.query(`
      INSERT INTO tireweb_connections (provider, enabled, connection_id, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (provider) DO UPDATE SET
        enabled = COALESCE($2, tireweb_connections.enabled),
        connection_id = COALESCE($3, tireweb_connections.connection_id),
        updated_at = NOW()
    `, [provider, enabled, connection_id]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[tireweb] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
