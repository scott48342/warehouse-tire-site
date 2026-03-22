import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const sessionIdRaw = Array.isArray((sp as any).session_id) ? (sp as any).session_id[0] : (sp as any).session_id;
  const sessionId = String(sessionIdRaw || "").trim();

  let quoteId: string | null = null;
  let amountTotal: number | null = null;

  if (sessionId) {
    try {
      const db = getPool();
      const stripeConn = await getStripeClient(db);
      if (stripeConn?.stripe) {
        const session = await stripeConn.stripe.checkout.sessions.retrieve(sessionId);
        quoteId = session?.metadata?.quoteId ? String(session.metadata.quoteId) : null;
        amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      }
    } catch {
      // ignore
    }
  }

  return (
    <main className="bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
          <div className="text-sm font-semibold text-green-700">{BRAND.name}</div>
          <h1 className="mt-1 text-2xl font-extrabold text-neutral-900">Payment successful</h1>
          <p className="mt-2 text-neutral-700">
            Thanks — your order has been received.
          </p>
          {amountTotal != null ? (
            <p className="mt-1 text-sm text-neutral-600">Paid: ${(amountTotal / 100).toFixed(2)}</p>
          ) : null}

          {quoteId ? (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
              <div className="text-xs font-semibold text-neutral-600">Order / Quote</div>
              <div className="mt-1 font-mono text-sm text-neutral-900">{quoteId}</div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/quote/${encodeURIComponent(quoteId)}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                >
                  View Quote Details
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
              >
                Back to Shop
              </Link>
            </div>
          )}

          {!sessionId ? (
            <p className="mt-4 text-xs text-neutral-500">No session id provided.</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
