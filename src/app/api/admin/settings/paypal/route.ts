import { NextResponse } from "next/server";
import pg from "pg";
import { getPayPalSettings, setPayPalSettings, type PayPalMode } from "@/lib/payments/paypalSettings";

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
 * Get PayPal settings (safe for client - no secrets)
 */
export async function GET() {
  const pool = getPool();
  try {
    const settings = await getPayPalSettings(pool);
    return NextResponse.json({
      enabled: settings.enabled,
      mode: settings.mode,
      clientId: settings.clientId,
      clientSecretPresent: settings.clientSecretPresent,
    });
  } catch (err: any) {
    console.error("[admin/settings/paypal] GET Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Update PayPal settings
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { enabled, mode, clientId, clientSecret } = body;

  const pool = getPool();
  try {
    await setPayPalSettings(pool, {
      enabled: typeof enabled === "boolean" ? enabled : undefined,
      mode: mode === "sandbox" || mode === "live" ? (mode as PayPalMode) : undefined,
      clientId: typeof clientId === "string" ? clientId : undefined,
      clientSecret: typeof clientSecret === "string" ? clientSecret : undefined,
    });

    // Log the change
    try {
      await pool.query(`
        INSERT INTO admin_logs (log_type, details)
        VALUES ('paypal_settings_update', $1)
      `, [JSON.stringify({ enabled, mode, clientIdSet: !!clientId, secretSet: !!clientSecret })]);
    } catch (logErr) {
      // Ignore log errors
    }

    const updated = await getPayPalSettings(pool);
    return NextResponse.json({
      ok: true,
      enabled: updated.enabled,
      mode: updated.mode,
      clientId: updated.clientId,
      clientSecretPresent: updated.clientSecretPresent,
    });
  } catch (err: any) {
    console.error("[admin/settings/paypal] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
