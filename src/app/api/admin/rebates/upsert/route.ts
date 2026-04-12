import { NextResponse } from "next/server";
import { getPool, upsertManualRebate } from "@/lib/rebates";

export const runtime = "nodejs";

function s(v: any): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseCommaSeparated(v: any): string[] {
  const str = s(v);
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    const body: any = ct.includes("application/json")
      ? await req.json().catch(() => ({} as any))
      : Object.fromEntries(await req.formData());

    // Core fields
    const brand = s(body.brand);
    const headline = s(body.headline);
    const learnMoreUrl = s(body.learnMoreUrl);
    const formUrl = s(body.formUrl);
    const endsText = s(body.endsText);
    const enabled = body.enabled === true || body.enabled === "1" || body.enabled === 1;

    // Extended fields
    const rebateAmount = s(body.rebateAmount);
    const rebateType = s(body.rebateType);
    const requirements = s(body.requirements);
    const internalNotes = s(body.internalNotes);
    const startDate = s(body.startDate);
    
    // Targeting fields (comma-separated in form, array in API)
    const eligibleSkus = Array.isArray(body.eligibleSkus) 
      ? body.eligibleSkus 
      : parseCommaSeparated(body.eligibleSkus);
    const eligibleModels = Array.isArray(body.eligibleModels) 
      ? body.eligibleModels 
      : parseCommaSeparated(body.eligibleModels);
    const eligibleSizes = Array.isArray(body.eligibleSizes) 
      ? body.eligibleSizes 
      : parseCommaSeparated(body.eligibleSizes);
    
    // Brand-wide: default true, but false if explicitly unchecked
    const brandWide = body.brandWide === true || body.brandWide === "1" || body.brandWide === 1 || body.brandWide === undefined;

    const db = getPool();
    await upsertManualRebate(db, {
      brand,
      headline,
      learnMoreUrl: learnMoreUrl || undefined,
      formUrl: formUrl || undefined,
      endsText: endsText || undefined,
      enabled,
      rebateAmount: rebateAmount || undefined,
      rebateType: rebateType || undefined,
      eligibleSkus: eligibleSkus.length > 0 ? eligibleSkus : undefined,
      eligibleModels: eligibleModels.length > 0 ? eligibleModels : undefined,
      eligibleSizes: eligibleSizes.length > 0 ? eligibleSizes : undefined,
      brandWide,
      requirements: requirements || undefined,
      startDate: startDate || undefined,
      internalNotes: internalNotes || undefined,
    });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const u = new URL("/admin/rebates", req.url);
      u.searchParams.set("saved", "1");
      return NextResponse.redirect(u, { status: 303 });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    console.error("[rebates/upsert] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
