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
 * Test a supplier connection
 */
export async function POST(req: Request) {
  const { provider } = await req.json();

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const pool = getPool();
  let status: "success" | "error" = "error";
  let message = "";

  try {
    // Test connection based on provider
    switch (provider) {
      case "wheelpros": {
        const apiKey = process.env.WHEELPROS_API_KEY;
        if (!apiKey) {
          message = "WHEELPROS_API_KEY not configured";
          break;
        }
        
        // Attempt a simple API call
        try {
          const res = await fetch("https://api.wheelpros.com/api/vehicle/years", {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Accept": "application/json",
            },
            signal: AbortSignal.timeout(10000),
          });
          
          if (res.ok) {
            status = "success";
            message = "Connected successfully";
          } else {
            message = `API returned ${res.status}: ${await res.text().catch(() => "Unknown error")}`;
          }
        } catch (e: any) {
          message = e.message || "Connection failed";
        }
        break;
      }

      case "keystone": {
        const apiKey = process.env.KEYSTONE_API_KEY;
        if (!apiKey) {
          message = "KEYSTONE_API_KEY not configured";
          break;
        }
        
        // Keystone typically uses SOAP/FTP - just check if key is set
        status = "success";
        message = "API key configured (connection test not available for SOAP/FTP)";
        break;
      }

      case "km": {
        // K&M uses FTP
        message = "K&M FTP connection test not yet implemented";
        break;
      }

      default:
        message = `Unknown provider: ${provider}`;
    }

    // Update the supplier record with test results
    await pool.query(`
      UPDATE admin_suppliers SET
        last_test_at = NOW(),
        last_test_status = $1,
        last_test_message = $2
      WHERE provider = $3
    `, [status, message, provider]);

    return NextResponse.json({ ok: status === "success", status, message });
  } catch (err: any) {
    console.error("[admin/settings/suppliers/test] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
