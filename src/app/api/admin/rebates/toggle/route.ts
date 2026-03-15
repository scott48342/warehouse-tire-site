import { NextResponse } from "next/server";
import { getPool, ensureRebatesTable } from "@/lib/rebates";

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

    const id = s(body.id);
    const enabled = body.enabled === true || body.enabled === "1" || body.enabled === 1;

    if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

    const db = getPool();
    await ensureRebatesTable(db);

    await db.query({
      text: `update site_rebates set enabled = $2, updated_at = now() where id = $1`,
      values: [id, enabled],
    });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      const u = new URL("/admin/rebates", req.url);
      u.searchParams.set("toggled", "1");
      return NextResponse.redirect(u, { status: 303 });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
