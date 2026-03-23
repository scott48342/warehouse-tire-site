import { NextResponse } from "next/server";
import pg from "pg";
import { getSupplierCredentials, hasCredentials } from "@/lib/supplierCredentialsSecure";
import { getWheelProsToken } from "@/lib/wheelprosAuth";

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
 * Test a supplier connection using admin-managed credentials
 */
export async function POST(req: Request) {
  const { provider } = await req.json();

  if (!provider) {
    return NextResponse.json({ error: "provider required" }, { status: 400 });
  }

  const pool = getPool();
  let status: "success" | "error" = "error";
  let message = "";
  let source: "db" | "env" | "none" = "none";

  try {
    // Check credential status first
    const credStatus = await hasCredentials(provider);
    source = credStatus.source;

    // Test connection based on provider
    switch (provider) {
      case "wheelpros": {
        const creds = await getSupplierCredentials("wheelpros");
        
        if (!creds.username || !creds.password) {
          message = "WheelPros credentials not configured. Add username/password in Settings.";
          break;
        }
        
        // Try to get a token (validates credentials)
        try {
          const token = await getWheelProsToken();
          if (token) {
            status = "success";
            message = `Connected successfully (credentials from ${source === "db" ? "admin settings" : "environment"})`;
          } else {
            message = "Auth succeeded but no token returned";
          }
        } catch (e: any) {
          message = e.message || "Authentication failed";
        }
        break;
      }

      case "keystone": {
        const creds = await getSupplierCredentials("keystone");
        
        if (!creds.apiKey) {
          message = "Keystone API key not configured. Add credentials in Settings.";
          break;
        }
        
        // Keystone typically uses SOAP/FTP - just validate we have credentials
        status = "success";
        message = `API key configured (credentials from ${source === "db" ? "admin settings" : "environment"})`;
        break;
      }

      case "km": {
        message = "K&M connection test not yet implemented";
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

    return NextResponse.json({ 
      ok: status === "success", 
      status, 
      message,
      credentialSource: source,
    });
  } catch (err: any) {
    console.error("[admin/settings/suppliers/test] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
