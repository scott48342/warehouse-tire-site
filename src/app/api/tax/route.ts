import { NextResponse } from "next/server";
import { getPool, getStateTaxRate, listStateTaxRates, setStateTaxRate, bulkUpdateStateTaxRates } from "@/lib/tax/stateTaxRates";
import { cookies } from "next/headers";
import { cookieName, verifyAdminToken } from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * GET /api/tax?state=XX - Get tax rate for a state
 * GET /api/tax - List all state tax rates (admin only)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");

  const db = getPool();

  // If state specified, return just that rate (public endpoint)
  if (state) {
    const rate = await getStateTaxRate(db, state);
    return NextResponse.json({ 
      ok: true, 
      state: state.toUpperCase(), 
      taxRate: rate,
      taxPercent: (rate * 100).toFixed(3) + "%",
    });
  }

  // List all rates - admin only
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rates = await listStateTaxRates(db);
  return NextResponse.json({ ok: true, rates });
}

/**
 * POST /api/tax - Update tax rate(s)
 * Body: { state: "XX", taxRate: 0.06 } or { rates: [{ stateCode, taxRate }, ...] }
 */
export async function POST(req: Request) {
  // Admin only
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName())?.value;
  const isAdmin = token ? await verifyAdminToken(token) : false;

  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const db = getPool();

  // Bulk update
  if (Array.isArray(body.rates)) {
    await bulkUpdateStateTaxRates(db, body.rates);
    return NextResponse.json({ ok: true, updated: body.rates.length });
  }

  // Single update
  const state = String(body.state || "").trim().toUpperCase();
  const taxRate = Number(body.taxRate);

  if (!state || state.length !== 2) {
    return NextResponse.json({ ok: false, error: "Invalid state code" }, { status: 400 });
  }

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 0.25) {
    return NextResponse.json({ ok: false, error: "Invalid tax rate (0-25%)" }, { status: 400 });
  }

  await setStateTaxRate(db, state, taxRate);
  return NextResponse.json({ ok: true, state, taxRate });
}
