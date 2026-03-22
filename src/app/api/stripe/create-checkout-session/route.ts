import { NextResponse } from "next/server";
import { getPool, createQuote, type QuoteLine } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import type { CartItem } from "@/lib/cart/CartContext";

export const runtime = "nodejs";

function moneyToCents(n: number) {
  const x = Math.round((Number(n) || 0) * 100);
  return Number.isFinite(x) ? x : 0;
}

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

    // Convert cart items to quote lines.
    // IMPORTANT: keep $0 REQUIRED install hardware in the quote snapshot / order payload.
    const linesAll: QuoteLine[] = items
      .map((i: any) => {
        const kind: QuoteLine["kind"] = "product";
        const name = String(i.model || i.name || i.sku || "Item").trim();
        const sku = String(i.sku || "").trim() || undefined;
        const unitPriceUsd = Number(i.unitPrice || 0);
        const qty = Math.max(1, Math.trunc(Number(i.quantity || 1)));
        const taxable = i.type === "wheel" || i.type === "tire"; // accessories treated as non-taxable for now

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

    // Stripe line items: exclude $0 lines (Stripe doesn't allow meaningful $0 charges).
    const stripeLines = linesAll.filter((l) => l.unitPriceUsd > 0);

    if (stripeLines.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_billable_items",
          detail: "Cart only contains $0 items. Required install hardware is preserved in quote snapshot, but nothing is billable.",
        },
        { status: 400 }
      );
    }

    const db = getPool();
    const stripeConn = await getStripeClient(db);
    if (!stripeConn) {
      return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 400 });
    }

    // Only allow TEST mode for now (safe verification)
    if (stripeConn.mode !== "test") {
      return NextResponse.json({ ok: false, error: "stripe_live_disabled" }, { status: 400 });
    }

    const { id: quoteId } = await createQuote(db, {
      customer: { firstName, lastName, email: email || undefined, phone: phone || undefined },
      vehicle,
      lines: linesAll,
    });

    const origin = new URL(req.url).origin;

    const session = await stripeConn.stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      line_items: stripeLines.map((l) => ({
        quantity: l.qty,
        price_data: {
          currency: "usd",
          unit_amount: moneyToCents(l.unitPriceUsd),
          product_data: {
            name: l.name,
            metadata: l.sku ? { sku: l.sku } : undefined,
          },
        },
      })),
      metadata: {
        quoteId,
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
    });

    return NextResponse.json({ ok: true, url: session.url, quoteId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
