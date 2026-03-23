import { NextResponse } from "next/server";
import pg from "pg";
import crypto from "crypto";

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

// Simple encryption for stored credentials
// In production, use a proper key management system
function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_KEY || process.env.ADMIN_PASSWORD || "default-key-change-me";
  return crypto.scryptSync(key, "tireweb-salt", 32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encrypted: string): string {
  const [ivHex, data] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Save TireWeb credentials
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { accessKey, groupToken } = body;

  if (!accessKey || !groupToken) {
    return NextResponse.json({ error: "accessKey and groupToken required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tireweb_config (
        id SERIAL PRIMARY KEY,
        key VARCHAR(50) UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Encrypt and store credentials
    const encryptedAccessKey = encrypt(accessKey);
    const encryptedGroupToken = encrypt(groupToken);

    await pool.query(`
      INSERT INTO tireweb_config (key, value, updated_at)
      VALUES ('access_key', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [encryptedAccessKey]);

    await pool.query(`
      INSERT INTO tireweb_config (key, value, updated_at)
      VALUES ('group_token', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [encryptedGroupToken]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[tireweb/credentials] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Get decrypted credentials (for internal use only)
 */
export async function getTirewebCredentials(): Promise<{ accessKey: string; groupToken: string } | null> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT key, value FROM tireweb_config WHERE key IN ('access_key', 'group_token')
    `);

    const accessKeyRow = rows.find((r: any) => r.key === "access_key");
    const groupTokenRow = rows.find((r: any) => r.key === "group_token");

    if (!accessKeyRow?.value || !groupTokenRow?.value) {
      return null;
    }

    return {
      accessKey: decrypt(accessKeyRow.value),
      groupToken: decrypt(groupTokenRow.value),
    };
  } catch (err) {
    console.error("[tireweb] Failed to get credentials:", err);
    return null;
  } finally {
    await pool.end();
  }
}
