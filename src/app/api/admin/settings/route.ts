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

/**
 * Get all settings
 */
export async function GET() {
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT key, value, updated_at
      FROM admin_settings
      ORDER BY key
    `);

    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = {
        value: row.value,
        updatedAt: row.updated_at,
      };
    }

    return NextResponse.json({ settings });
  } catch (err: any) {
    console.error("[admin/settings] GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Update a setting
 */
export async function POST(req: Request) {
  const { key, value } = await req.json();

  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  // Protected keys that shouldn't be editable via admin UI
  const protectedKeys = ["stripe_secret_key", "api_keys"];
  if (protectedKeys.includes(key)) {
    return NextResponse.json({ error: "This setting cannot be modified via admin UI" }, { status: 403 });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      INSERT INTO admin_settings (key, value, updated_at)
      VALUES ($1, $2, now())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now()
      RETURNING *
    `, [key, JSON.stringify(value)]);

    // Log the change
    await pool.query(`
      INSERT INTO admin_logs (log_type, details)
      VALUES ('settings_change', $1)
    `, [JSON.stringify({ key, value })]);

    return NextResponse.json({ ok: true, setting: rows[0] });
  } catch (err: any) {
    console.error("[admin/settings] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
