import { NextResponse } from "next/server";
import { getPool, upsertCatalogItem } from "@/lib/quoteCatalog";

export const runtime = "nodejs";

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    const body: any = ct.includes("application/json")
      ? await req.json().catch(() => ({} as any))
      : Object.fromEntries(await req.formData());

    const name = s(body.name);
    const unitPrice = Number(s(body.unitPrice));
    const appliesTo = (s(body.appliesTo) as any) || "tire";
    const category = s(body.category);
    const sortOrder = Number(s(body.sortOrder) || "0");

    const taxable = body.taxable === true || body.taxable === "1" || body.taxable === 1;
    const defaultChecked = body.defaultChecked === true || body.defaultChecked === "1" || body.defaultChecked === 1;
    const required = body.required === true || body.required === "1" || body.required === 1;
    const active = body.active === true || body.active === "1" || body.active === 1;

    if (!name) return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    if (!Number.isFinite(unitPrice)) return NextResponse.json({ ok: false, error: "unit_price_required" }, { status: 400 });

    const db = getPool();
    await upsertCatalogItem(db, {
      name,
      unit_price_usd: unitPrice,
      applies_to: appliesTo,
      taxable,
      default_checked: defaultChecked,
      required,
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      category: category || null,
      active,
    } as any);

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const u = new URL("/admin/catalog", req.url);
      u.searchParams.set("saved", "1");
      return NextResponse.redirect(u, { status: 303 });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
