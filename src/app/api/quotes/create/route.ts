import { NextResponse } from "next/server";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";

export const runtime = "nodejs";

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    const body: any = ct.includes("application/json")
      ? await req.json().catch(() => ({} as any))
      : Object.fromEntries(await req.formData());

    const firstName = s(body.firstName);
    const lastName = s(body.lastName);
    const email = s(body.email);
    const phone = s(body.phone);

    if (!firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email_or_phone_required" }, { status: 400 });
    }

    const vehicle = {
      year: s(body.year) || undefined,
      make: s(body.make) || undefined,
      model: s(body.model) || undefined,
      trim: s(body.trim) || undefined,
      modification: s(body.modification) || undefined,
    };

    const linesRaw = body.lines;
    const lines: QuoteLine[] = Array.isArray(linesRaw)
      ? linesRaw
      : (typeof linesRaw === "string" && linesRaw.trim().startsWith("[")
          ? JSON.parse(linesRaw)
          : []);

    const db = getPool();
    const { id } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: (lines || []).map((l: any) => ({
        kind: l.kind,
        name: s(l.name),
        sku: s(l.sku) || undefined,
        unitPriceUsd: n(l.unitPriceUsd),
        qty: Math.max(0, Math.trunc(n(l.qty))),
        taxable: !!l.taxable,
        meta: l.meta && typeof l.meta === "object" ? l.meta : undefined,
      })) as any,
    });

    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/html")) {
      return NextResponse.redirect(new URL(`/quote/${id}`, req.url), { status: 303 });
    }

    return NextResponse.json({ ok: true, id }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
