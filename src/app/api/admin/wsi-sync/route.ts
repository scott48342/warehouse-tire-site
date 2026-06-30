/**
 * Admin: Manual WSI Inventory Sync
 * GET /api/admin/wsi-sync
 *
 * Triggers an immediate FTP download + DB upsert.
 * Requires x-admin-key header.
 */

import { NextRequest, NextResponse } from "next/server";
import { runWSISync } from "@/lib/wsi/ftpSync";
import { getPool } from "@/lib/vehicleFitment";

export const maxDuration = 300;
export const dynamic     = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_API_KEY || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url    = new URL(req.url);
  const action = url.searchParams.get("action") ?? "sync";

  // Just return stats without syncing
  if (action === "stats") {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                               AS total_skus,
        COUNT(*) FILTER (WHERE wsi_stock > 0 OR alt_stock > 0) AS in_stock,
        COUNT(DISTINCT brand)                                  AS brands,
        MAX(synced_at)                                         AS last_synced
      FROM wsi_wheels
    `);
    return NextResponse.json({ stats: rows[0] });
  }

  // Full sync
  const result = await runWSISync();
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
