/**
 * Vercel Cron: Sync WSI Wholesale Inventory
 * Schedule: 0 6 * * *  (6 AM UTC = 2 AM ET, after WSI's 4 AM Phoenix update)
 *
 * Downloads FTP CSV and upserts all WSI wheel inventory into wsi_wheels table.
 */

import { NextRequest, NextResponse } from "next/server";
import { runWSISync } from "@/lib/wsi/ftpSync";

export const maxDuration = 300; // 5 minutes
export const dynamic     = "force-dynamic";

export async function GET(req: NextRequest) {
  // FIX (2026-08-04): Vercel cron does NOT send "x-vercel-cron-signature".
  // When CRON_SECRET is set, Vercel sends "Authorization: Bearer <CRON_SECRET>".
  // The old header check 401'd every scheduled run — this cron never fired.
  const authHeader = req.headers.get("authorization");
  const validCron  = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const adminKey   = req.headers.get("x-admin-key");
  const validAdmin = !!process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY;

  if (!validCron && !validAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runWSISync();

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
