import { NextResponse } from "next/server";
import { getPool, upsertManualRebate } from "@/lib/rebates";

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

    const brand = s(body.brand);
    const headline = s(body.headline);
    const learnMoreUrl = s(body.learnMoreUrl);
    const formUrl = s(body.formUrl);
    const endsText = s(body.endsText);
    const enabled = body.enabled === true || body.enabled === "1" || body.enabled === 1;

    const db = getPool();
    await upsertManualRebate(db, {
      brand,
      headline,
      learnMoreUrl: learnMoreUrl || undefined,
      formUrl: formUrl || undefined,
      endsText: endsText || undefined,
      enabled,
    });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const u = new URL("/admin/rebates", req.url);
      u.searchParams.set("saved", "1");
      return NextResponse.redirect(u, { status: 303 });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
