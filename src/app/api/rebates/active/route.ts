import { NextResponse } from "next/server";
import { getPool, listActiveRebates } from "@/lib/rebates";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getPool();
    const items = await listActiveRebates(db);
    return NextResponse.json({ items }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || String(e) }, { status: 200 });
  }
}
