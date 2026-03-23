import { NextResponse } from "next/server";
import pg from "pg";
import { sendTestEmail } from "@/lib/email";

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

async function ensureTable(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/**
 * GET /api/admin/settings/email
 * Returns email settings (without password)
 */
export async function GET() {
  const pool = getPool();
  try {
    await ensureTable(pool);
    
    const { rows } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'email'`
    );

    if (rows.length === 0) {
      return NextResponse.json({
        enabled: false,
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPass: "", // Never return actual password
        fromEmail: "",
        fromName: "Warehouse Tire",
        notifyEmail: "",
        hasPassword: false,
      });
    }

    const val = rows[0].value;
    return NextResponse.json({
      enabled: !!val.enabled,
      smtpHost: val.smtpHost || "",
      smtpPort: val.smtpPort || 587,
      smtpUser: val.smtpUser || "",
      smtpPass: "", // Never return actual password
      fromEmail: val.fromEmail || "",
      fromName: val.fromName || "Warehouse Tire",
      notifyEmail: val.notifyEmail || "",
      hasPassword: !!val.smtpPass,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * POST /api/admin/settings/email
 * Save email settings
 */
export async function POST(req: Request) {
  const pool = getPool();
  try {
    await ensureTable(pool);
    
    const body = await req.json();
    
    // Get existing settings to preserve password if not changed
    const { rows: existing } = await pool.query(
      `SELECT value FROM admin_settings WHERE key = 'email'`
    );
    const existingVal = existing[0]?.value || {};

    const newVal = {
      enabled: !!body.enabled,
      smtpHost: String(body.smtpHost || "").trim(),
      smtpPort: parseInt(body.smtpPort, 10) || 587,
      smtpUser: String(body.smtpUser || "").trim(),
      // Only update password if provided (non-empty)
      smtpPass: body.smtpPass ? String(body.smtpPass) : existingVal.smtpPass || "",
      fromEmail: String(body.fromEmail || "").trim(),
      fromName: String(body.fromName || "Warehouse Tire").trim(),
      notifyEmail: String(body.notifyEmail || "").trim(),
    };

    await pool.query(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES ('email', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(newVal)]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * PUT /api/admin/settings/email (test)
 * Send a test email
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const testTo = String(body.testTo || "").trim();

    if (!testTo) {
      return NextResponse.json({ error: "testTo email required" }, { status: 400 });
    }

    const result = await sendTestEmail(testTo);

    if (result.success) {
      return NextResponse.json({ ok: true, message: "Test email sent successfully" });
    } else {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
