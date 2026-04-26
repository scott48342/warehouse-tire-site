import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool, getQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { getOrderByStripeSession, getOrderByQuote, getOrderByPaymentIntent, createOrder, markOrderEmailSent, type OrderRecord } from "@/lib/orders";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { CartRecoveryHandler } from "@/components/CartRecoveryHandler";
import { GoogleAdsConversion } from "@/components/GoogleAdsConversion";
import { AddYourBuildCTA } from "@/components/AddYourBuildCTA";
// Funnel analytics tracking (2026-04-26)
import { PurchaseTracker } from "@/components/PurchaseTracker";

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
  
  // Support multiple lookup methods:
  // - session_id: Legacy Stripe Checkout Session redirect
  // - payment_intent: Embedded Payment Element flow
  // - quote_id: Direct quote lookup (fallback)
  const sessionIdRaw = Array.isArray((sp as any).session_id) ? (sp as any).session_id[0] : (sp as any).session_id;
  const sessionId = String(sessionIdRaw || "").trim();
  
  const paymentIntentRaw = Array.isArray((sp as any).payment_intent) ? (sp as any).payment_intent[0] : (sp as any).payment_intent;
  const paymentIntentId = String(paymentIntentRaw || "").trim();
  
  const quoteIdRaw = Array.isArray((sp as any).quote_id) ? (sp as any).quote_id[0] : (sp as any).quote_id;
  const quoteIdParam = String(quoteIdRaw || "").trim();

  let order: OrderRecord | null = null;
  let errorMessage: string | null = null;

  const db = getPool();
  const stripeConn = await getStripeClient(db);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRY PAYMENT INTENT LOOKUP (embedded Payment Element flow)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!order && paymentIntentId) {
    try {
      // First, check if order exists by payment intent
      order = await getOrderByPaymentIntent(db, paymentIntentId);
      
      // If no order yet (webhook race), try to create it
      if (!order && stripeConn?.stripe) {
        const pi = await stripeConn.stripe.paymentIntents.retrieve(paymentIntentId);
        const quoteId = pi?.metadata?.quoteId;
        
        if (quoteId && pi.status === "succeeded") {
          // Double-check by quote
          order = await getOrderByQuote(db, quoteId);
          
          if (!order) {
            // Create order now
            const quote = await getQuote(db, quoteId);
            if (quote) {
              const { id: orderId } = await createOrder(db, {
                quoteId,
                stripePaymentIntentId: paymentIntentId,
                amountPaidCents: pi.amount || 0,
                customerEmail: pi.receipt_email || quote.snapshot.customer.email,
                customerPhone: quote.snapshot.customer.phone,
                snapshot: quote.snapshot,
              });
              
              order = await getOrderByPaymentIntent(db, paymentIntentId);
              
              // Send email
              const emailTo = pi.receipt_email || quote.snapshot.customer.email;
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
    } catch (err: any) {
      console.error("[checkout/success] PaymentIntent lookup error:", err.message);
      errorMessage = "Unable to load order details. Your order was still placed successfully.";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRY SESSION ID LOOKUP (legacy Stripe Checkout redirect)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!order && sessionId) {
    try {
      order = await getOrderByStripeSession(db, sessionId);
      
      if (!order && stripeConn?.stripe) {
        const session = await stripeConn.stripe.checkout.sessions.retrieve(sessionId);
        const quoteId = session?.metadata?.quoteId;
        
        if (quoteId) {
          order = await getOrderByQuote(db, quoteId);
          
          if (!order) {
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
    } catch (err: any) {
      console.error("[checkout/success] Session lookup error:", err.message);
      errorMessage = "Unable to load order details. Your order was still placed successfully.";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRY QUOTE ID LOOKUP (direct fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!order && quoteIdParam) {
    try {
      order = await getOrderByQuote(db, quoteIdParam);
    } catch (err: any) {
      console.error("[checkout/success] Quote lookup error:", err.message);
    }
  }

  // No identifiers provided
  if (!sessionId && !paymentIntentId && !quoteIdParam) {
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

  // Extract first wheel/tire info for build submission prefill
  const firstWheel = wheels[0];
  const firstTire = tires[0];
  
  // Parse wheel info from name/meta (e.g., "Fuel Rebel D679 20x10")
  const wheelMeta = firstWheel?.meta || {};
  const wheelName = firstWheel?.name || "";
  const wheelBrand = wheelMeta.brand || wheelName.split(" ")[0] || "";
  const wheelModel = wheelMeta.model || wheelName.split(" ").slice(1, 3).join(" ") || "";
  const wheelDiameter = wheelMeta.diameter || "";
  
  // Parse tire info
  const tireMeta = firstTire?.meta || {};
  const tireName = firstTire?.name || "";
  const tireBrand = tireMeta.brand || tireName.split(" ")[0] || "";
  const tireModel = tireMeta.model || tireName.split(" ").slice(1, 3).join(" ") || "";
  const tireSize = tireMeta.size || "";

  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Mark cart as recovered */}
      <CartRecoveryHandler orderId={order.id} />
      
      {/* Funnel analytics tracking */}
      <PurchaseTracker 
        orderId={order.id}
        cartValue={totals.total}
        couponCode={snapshot.discount?.code}
        discountAmount={snapshot.discount?.amount}
        discountType={snapshot.discount?.type}
        isFirstOrder={snapshot.discount?.type === 'first_order'}
      />
      
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

        {/* ═══════════════════════════════════════════════════════════════════════════
            ADD YOUR BUILD CTA - Encourage customer photo submissions
            Shows after wheels/tires are ordered, prefills with order details
            ═══════════════════════════════════════════════════════════════════════════ */}
        {(wheels.length > 0 || tires.length > 0) && (
          <div className="mb-6">
            <AddYourBuildCTA
              orderId={String(order.id)}
              vehicle={vehicle ? {
                year: vehicle.year?.toString(),
                make: vehicle.make,
                model: vehicle.model,
                trim: vehicle.trim,
              } : undefined}
              products={{
                wheelBrand,
                wheelModel,
                wheelDiameter,
                tireBrand,
                tireModel,
                tireSize,
              }}
              variant="card"
              dismissible={true}
              incentive="Featured builds get 10% off next order!"
            />
          </div>
        )}

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
