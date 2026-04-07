import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool, getQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { getOrderByStripeSession, getOrderByQuote, createOrder, markOrderEmailSent, type OrderRecord } from "@/lib/orders";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { CartRecoveryHandler } from "@/components/CartRecoveryHandler";
import { GoogleAdsConversion } from "@/components/GoogleAdsConversion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatMoney(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const sessionIdRaw = Array.isArray((sp as any).session_id) ? (sp as any).session_id[0] : (sp as any).session_id;
  const sessionId = String(sessionIdRaw || "").trim();

  let order: OrderRecord | null = null;
  let errorMessage: string | null = null;

  if (sessionId) {
    try {
      const db = getPool();
      
      // First, try to find existing order
      order = await getOrderByStripeSession(db, sessionId);
      
      // If no order exists, create it (fallback for webhook race condition)
      if (!order) {
        const stripeConn = await getStripeClient(db);
        if (stripeConn?.stripe) {
          const session = await stripeConn.stripe.checkout.sessions.retrieve(sessionId);
          const quoteId = session?.metadata?.quoteId;
          
          if (quoteId) {
            // Check if order exists by quote (another fallback)
            order = await getOrderByQuote(db, quoteId);
            
            if (!order) {
              // Create order now (webhook might be delayed)
              const quote = await getQuote(db, quoteId);
              if (quote) {
                const { id: orderId } = await createOrder(db, {
                  quoteId,
                  stripeSessionId: sessionId,
                  stripePaymentIntentId: session.payment_intent as string,
                  amountPaidCents: session.amount_total || 0,
                  customerEmail: session.customer_email || quote.snapshot.customer.email,
                  customerPhone: quote.snapshot.customer.phone,
                  snapshot: quote.snapshot,
                });
                
                order = await getOrderByStripeSession(db, sessionId);
                
                // Send email if not sent yet
                const emailTo = session.customer_email || quote.snapshot.customer.email;
                if (order && emailTo) {
                  try {
                    await sendOrderConfirmationEmail(orderId, emailTo, quote.snapshot);
                    await markOrderEmailSent(db, orderId);
                  } catch {
                    // Email failure is not critical
                  }
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("[checkout/success] Error:", err.message);
      errorMessage = "Unable to load order details. Your order was still placed successfully.";
    }
  }

  if (!sessionId) {
    return (
      <main className="bg-neutral-50 min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-xl font-bold text-neutral-900">No Session Found</h1>
            <p className="mt-2 text-neutral-700">
              No checkout session ID provided. If you completed a purchase, check your email for confirmation.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
            >
              Back to Shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="bg-neutral-50 min-h-screen">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="text-sm font-semibold text-green-700">{BRAND.name}</div>
            <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Payment Successful</h1>
            <p className="mt-2 text-neutral-700">
              Your order has been received. Check your email for confirmation details.
            </p>
            {errorMessage && (
              <p className="mt-2 text-sm text-amber-700">{errorMessage}</p>
            )}
            <Link
              href="/"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Extract data from order
  const { snapshot } = order;
  const { customer, vehicle, lines, totals } = snapshot;
  
  const vehicleLabel = vehicle 
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : null;

  // Group lines by type
  const wheels = lines.filter(l => l.meta?.cartType === "wheel");
  const tires = lines.filter(l => l.meta?.cartType === "tire");
  const accessories = lines.filter(l => l.meta?.cartType === "accessory");

  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Mark cart as recovered */}
      <CartRecoveryHandler orderId={order.id} />
      
      {/* Google Ads conversion tracking */}
      <GoogleAdsConversion 
        orderId={order.id} 
        orderTotal={totals.total} 
        customerEmail={customer.email}
      />
      
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        
        {/* Success Banner */}
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white text-2xl">
              ✓
            </div>
            <div>
              <div className="text-sm font-semibold text-green-700">{BRAND.name}</div>
              <h1 className="text-2xl font-extrabold text-neutral-900">Order Confirmed!</h1>
            </div>
          </div>
          <p className="mt-3 text-neutral-700">
            Thank you, <strong>{customer.firstName}</strong>! Your order has been received and is being processed.
          </p>
          {customer.email && (
            <p className="mt-1 text-sm text-neutral-600">
              Confirmation sent to <strong>{customer.email}</strong>
            </p>
          )}
        </div>

        {/* Order Info Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-neutral-100">
            <div>
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Order ID</div>
              <div className="text-2xl font-mono font-bold text-neutral-900">{order.id}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</div>
              <div className="inline-flex items-center gap-1.5 mt-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-semibold text-green-700">Received</span>
              </div>
            </div>
          </div>

          {vehicleLabel && (
            <div className="py-4 border-b border-neutral-100">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Vehicle</div>
              <div className="text-lg font-semibold text-neutral-900 mt-1">{vehicleLabel}</div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 mb-6">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Order Details</h2>

          {/* Wheels */}
          {wheels.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Wheels</div>
              {wheels.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div>
                    <div className="font-medium text-neutral-900">{item.name}</div>
                    {item.sku && <div className="text-xs text-neutral-500 font-mono">{item.sku}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-neutral-900">{formatMoney(item.unitPriceUsd * item.qty)}</div>
                    <div className="text-xs text-neutral-500">Qty: {item.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tires */}
          {tires.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Tires</div>
              {tires.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div>
                    <div className="font-medium text-neutral-900">{item.name}</div>
                    {item.sku && <div className="text-xs text-neutral-500 font-mono">{item.sku}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-neutral-900">{formatMoney(item.unitPriceUsd * item.qty)}</div>
                    <div className="text-xs text-neutral-500">Qty: {item.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Accessories */}
          {accessories.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Accessories</div>
              {accessories.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium text-neutral-900">{item.name}</div>
                      {item.sku && <div className="text-xs text-neutral-500 font-mono">{item.sku}</div>}
                    </div>
                    {item.meta?.required && (
                      <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-neutral-900">
                      {item.unitPriceUsd === 0 ? "Included" : formatMoney(item.unitPriceUsd * item.qty)}
                    </div>
                    <div className="text-xs text-neutral-500">Qty: {item.qty}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals */}
          <div className="pt-4 border-t border-neutral-200">
            <div className="flex justify-between py-1 text-neutral-600">
              <span>Subtotal</span>
              <span>{formatMoney(totals.partsSubtotal + totals.servicesSubtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-neutral-600">
              <span>Tax</span>
              <span>{formatMoney(totals.tax)}</span>
            </div>
            <div className="flex justify-between py-2 text-xl font-bold text-neutral-900">
              <span>Total Paid</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/quote/${encodeURIComponent(order.quoteId)}`}
            className="flex-1 inline-flex h-12 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-900 hover:bg-neutral-50"
          >
            View Full Quote
          </Link>
          <Link
            href="/"
            className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white hover:bg-neutral-800"
          >
            Continue Shopping
          </Link>
        </div>

      </div>
    </main>
  );
}
