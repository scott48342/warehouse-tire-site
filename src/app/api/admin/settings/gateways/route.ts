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
 * Get all payment gateways
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const urlHost = dbUrl ? new URL(dbUrl).host : 'none';
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, provider, display_name, enabled, mode, priority, config,
        secret_key_env, publishable_key_env, created_at, updated_at
      FROM admin_payment_gateways
      ORDER BY priority, display_name
    `);

    // Check which env vars are configured
    const gateways = rows.map((g: any) => ({
      ...g,
      secretKeyConfigured: g.secret_key_env ? !!process.env[g.secret_key_env] : null,
      publishableKeyConfigured: g.publishable_key_env ? !!process.env[g.publishable_key_env] : null,
    }));

    return NextResponse.json({ gateways });
  } catch (err: any) {
    // Table might not exist yet
    if (err.message?.includes("does not exist")) {
      return NextResponse.json({ 
        gateways: [], 
        needsMigration: true,
        debug: { error: err.message, code: err.code, dbHost: urlHost }
      });
    }
    console.error("[admin/settings/gateways] GET Error:", err);
    return NextResponse.json({ error: err.message, code: err.code }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Create or update a payment gateway
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    id,
    provider,
    displayName,
    enabled,
    mode,
    priority,
    config,
  } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    let result;
    
    if (id) {
      // Update existing
      result = await pool.query(`
        UPDATE admin_payment_gateways SET
          display_name = COALESCE($2, display_name),
          enabled = COALESCE($3, enabled),
          mode = COALESCE($4, mode),
          priority = COALESCE($5, priority),
          config = COALESCE($6, config),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, displayName, enabled, mode, priority, config ? JSON.stringify(config) : null]);
    } else {
      // Insert new
      result = await pool.query(`
        INSERT INTO admin_payment_gateways (provider, display_name, enabled, mode, priority, config)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (provider) DO UPDATE SET
          display_name = COALESCE(EXCLUDED.display_name, admin_payment_gateways.display_name),
          enabled = COALESCE(EXCLUDED.enabled, admin_payment_gateways.enabled),
          mode = COALESCE(EXCLUDED.mode, admin_payment_gateways.mode),
          priority = COALESCE(EXCLUDED.priority, admin_payment_gateways.priority),
          config = COALESCE(EXCLUDED.config, admin_payment_gateways.config),
          updated_at = NOW()
        RETURNING *
      `, [provider, displayName || provider, enabled ?? false, mode || 'test', priority || 0, config ? JSON.stringify(config) : '{}']);
    }

    // Log the change
    await pool.query(`
      INSERT INTO admin_logs (log_type, details)
      VALUES ('gateway_update', $1)
    `, [JSON.stringify({ provider, enabled, mode })]);

    return NextResponse.json({ ok: true, gateway: result.rows[0] });
  } catch (err: any) {
    console.error("[admin/settings/gateways] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Delete a payment gateway
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Don't allow deleting stripe
  const pool = getPool();
  try {
    const { rows: check } = await pool.query(
      `SELECT provider FROM admin_payment_gateways WHERE id = $1`,
      [id]
    );
    
    if (check[0]?.provider === 'stripe') {
      return NextResponse.json({ error: "Cannot delete Stripe gateway" }, { status: 400 });
    }

    await pool.query(`DELETE FROM admin_payment_gateways WHERE id = $1`, [id]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/settings/gateways] DELETE Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
