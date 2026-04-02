import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { approveAccessRequest, rejectAccessRequest } from "@/lib/fitment-api/requests";
import { generateApiKey } from "@/lib/fitment-api/apiKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// ============================================================================
// GET - Fetch data for admin tabs
// ============================================================================

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") || "requests";
  const pool = getPool();

  try {
    switch (tab) {
      case "requests": {
        const result = await pool.query(`
          SELECT * FROM api_access_requests 
          ORDER BY 
            CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
            created_at DESC
          LIMIT 100
        `);
        return NextResponse.json({ requests: result.rows });
      }

      case "keys": {
        const result = await pool.query(`
          SELECT * FROM api_keys 
          ORDER BY created_at DESC
          LIMIT 100
        `);
        return NextResponse.json({ keys: result.rows });
      }

      case "customers": {
        // Aggregate customer data from keys and requests
        const result = await pool.query(`
          SELECT 
            k.email,
            k.name,
            k.company,
            k.plan,
            SUM(k.request_count) as total_requests,
            COUNT(DISTINCT k.id) as keys_count,
            (SELECT COUNT(*) FROM api_access_requests r WHERE r.email = k.email) as requests_count,
            MIN(k.created_at) as first_request_at,
            MAX(k.last_request_at) as last_activity_at
          FROM api_keys k
          GROUP BY k.email, k.name, k.company, k.plan
          ORDER BY total_requests DESC
          LIMIT 100
        `);
        return NextResponse.json({ customers: result.rows });
      }

      case "usage": {
        // Get overall stats
        const [statsRes, endpointsRes, activityRes, pendingRes] = await Promise.all([
          pool.query(`
            SELECT 
              (SELECT COUNT(*) FROM api_keys) as total_keys,
              (SELECT COUNT(*) FROM api_keys WHERE active = true) as active_keys,
              (SELECT COALESCE(SUM(monthly_request_count), 0) FROM api_keys) as total_requests_month
          `),
          pool.query(`
            SELECT endpoint, COUNT(*) as count
            FROM api_usage_logs
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY endpoint
            ORDER BY count DESC
            LIMIT 10
          `),
          pool.query(`
            SELECT l.id, k.key_prefix, l.endpoint, l.status_code, l.response_time_ms, l.created_at
            FROM api_usage_logs l
            JOIN api_keys k ON l.api_key_id = k.id
            ORDER BY l.created_at DESC
            LIMIT 20
          `),
          pool.query(`
            SELECT COUNT(*) as count FROM api_access_requests WHERE status = 'pending'
          `),
        ]);

        // Get today's requests from logs
        const todayRes = await pool.query(`
          SELECT COUNT(*) as count 
          FROM api_usage_logs 
          WHERE created_at >= CURRENT_DATE
        `);

        const stats = statsRes.rows[0];
        
        return NextResponse.json({
          usage: {
            total_keys: parseInt(stats.total_keys),
            active_keys: parseInt(stats.active_keys),
            total_requests_today: parseInt(todayRes.rows[0]?.count || "0"),
            total_requests_month: parseInt(stats.total_requests_month),
            pending_requests: parseInt(pendingRes.rows[0]?.count || "0"),
            top_endpoints: endpointsRes.rows,
            recent_activity: activityRes.rows,
          },
        });
      }

      default:
        return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/fitment-api] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}

// ============================================================================
// POST - Handle admin actions
// ============================================================================

export async function POST(req: NextRequest) {
  const pool = getPool();

  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      case "approve": {
        const { requestId, plan, notes } = payload;
        if (!requestId) {
          return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        // Use existing approve flow (it handles notes internally if we pass them)
        const result = await approveAccessRequest(
          requestId,
          "Admin",
          plan || "starter",
          notes
        );

        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          apiKey: result.apiKey, // Only shown once!
        });
      }

      case "reject": {
        const { requestId, notes } = payload;
        if (!requestId) {
          return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        const result = await rejectAccessRequest(requestId, "Admin", notes);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      case "disable_key": {
        const { keyId, reason } = payload;
        if (!keyId) {
          return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
        }

        await pool.query(
          `UPDATE api_keys 
           SET active = false, suspended_at = NOW(), suspend_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [reason || "Disabled by admin", keyId]
        );

        return NextResponse.json({ success: true });
      }

      case "enable_key": {
        const { keyId } = payload;
        if (!keyId) {
          return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
        }

        await pool.query(
          `UPDATE api_keys 
           SET active = true, suspended_at = NULL, suspend_reason = NULL, updated_at = NOW()
           WHERE id = $1`,
          [keyId]
        );

        return NextResponse.json({ success: true });
      }

      case "regenerate_key": {
        const { keyId } = payload;
        if (!keyId) {
          return NextResponse.json({ error: "Missing keyId" }, { status: 400 });
        }

        // Generate new key - returns { plainKey, keyHash, keyPrefix }
        const { plainKey, keyHash, keyPrefix } = generateApiKey();

        await pool.query(
          `UPDATE api_keys 
           SET key_hash = $1, key_prefix = $2, updated_at = NOW()
           WHERE id = $3`,
          [keyHash, keyPrefix, keyId]
        );

        return NextResponse.json({
          success: true,
          apiKey: plainKey, // Only shown once!
        });
      }

      case "update_notes": {
        const { requestId, notes } = payload;
        if (!requestId) {
          return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        }

        await pool.query(
          `UPDATE api_access_requests SET review_notes = $1, updated_at = NOW() WHERE id = $2`,
          [notes, requestId]
        );

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/fitment-api] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  } finally {
    await pool.end();
  }
}
