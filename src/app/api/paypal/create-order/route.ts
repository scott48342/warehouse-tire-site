import { NextResponse } from "next/server";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getPayPalClient } from "@/lib/payments/paypalClient";
import type { CartItem } from "@/lib/cart/CartContext";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];

    const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
    const firstName = String(customer.firstName || "").trim();
    const lastName = String(customer.lastName || "").trim();
    const email = String(customer.email || "").trim();
    const phone = String(customer.phone || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ ok: false, error: "name_required" }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: "email_or_phone_required" }, { status: 400 });
    }

    const vehicle = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : undefined;

    // Convert cart items to quote lines
    const linesAll: QuoteLine[] = items
      .map((i: any) => {
        const kind: QuoteLine["kind"] = "product";
        const name = String(i.model || i.name || i.sku || "Item").trim();
        const sku = String(i.sku || "").trim() || undefined;
        const unitPriceUsd = Number(i.unitPrice || 0);
        const qty = Math.max(1, Math.trunc(Number(i.quantity || 1)));
        const taxable = i.type === "wheel" || i.type === "tire";

        const meta = {
          cartType: i.type,
          category: i.category,
          required: !!i.required,
          wheelSku: i.wheelSku,
          spec: i.spec,
          meta: i.meta,
        };

        return { kind, name, sku, unitPriceUsd, qty, taxable, meta };
      })
      .filter((l) => l.qty > 0);

    if (linesAll.length === 0) {
      return NextResponse.json({ ok: false, error: "empty_cart" }, { status: 400 });
    }

    // Calculate total (only billable items)
    const billableLines = linesAll.filter((l) => l.unitPriceUsd > 0);
    if (billableLines.length === 0) {
      return NextResponse.json(
        { ok: false, error: "no_billable_items" },
        { status: 400 }
      );
    }

    const totalAmount = billableLines.reduce((sum, l) => sum + l.unitPriceUsd * l.qty, 0);

    const db = getPool();
    const paypal = await getPayPalClient(db);
    if (!paypal) {
      return NextResponse.json({ ok: false, error: "paypal_not_configured" }, { status: 400 });
    }

    // Create quote first
    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
    });

    // Create PayPal order
    const vehicleDesc = vehicle
      ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
      : undefined;
    const description = vehicleDesc
      ? `Tires & Wheels for ${vehicleDesc}`
      : "Tires & Wheels Order";

    const origin = new URL(req.url).origin;
    const returnUrl = `${origin}/checkout/paypal-return`;
    const cancelUrl = `${origin}/checkout?canceled=1`;

    const order = await paypal.createOrder(totalAmount, "USD", quoteId, description, returnUrl, cancelUrl);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      approvalUrl: order.approvalUrl,
      quoteId,
    });
  } catch (e: any) {
    console.error("[paypal/create-order] Error:", e);
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
