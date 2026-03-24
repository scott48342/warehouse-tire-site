import { NextResponse } from "next/server";
import { getPool } from "@/lib/quotes";
import { getPayPalClient } from "@/lib/payments/paypalClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const orderId = String(body.orderId || "").trim();

    if (!orderId) {
      return NextResponse.json({ ok: false, error: "orderId_required" }, { status: 400 });
    }

    const db = getPool();
    const paypal = await getPayPalClient(db);
    if (!paypal) {
      return NextResponse.json({ ok: false, error: "paypal_not_configured" }, { status: 400 });
    }

    const result = await paypal.captureOrder(orderId);

    if (result.status !== "COMPLETED") {
      return NextResponse.json({
        ok: false,
        error: "capture_not_completed",
        status: result.status,
      }, { status: 400 });
    }

    // TODO: Update quote/order status in database
    // For now, just return success - the success page will handle display

    return NextResponse.json({
      ok: true,
      orderId: result.id,
      status: result.status,
      payer: result.payer,
    });
  } catch (e: any) {
    console.error("[paypal/capture-order] Error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
