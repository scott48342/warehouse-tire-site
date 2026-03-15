import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getPool, getQuote } from "@/lib/quotes";

export const runtime = "nodejs";

function money(n: number) {
  const x = Number(n);
  return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
}

export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getPool();
  const q = await getQuote(db, String(id));

  if (!q) {
    return (
      <main className="bg-neutral-50">
        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Quote not found.</div>
          <div className="mt-4">
            <Link href="/" className="text-sm font-extrabold text-neutral-900 hover:underline">
              Back to shop
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const snap = q.snapshot;
  const v = snap.vehicle;
  const vehicleLabel = [v?.year, v?.make, v?.model, v?.trim].filter(Boolean).join(" ");

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-600">{BRAND.name} quote</div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Quote #{q.id.slice(0, 8).toUpperCase()}</h1>
            <div className="mt-1 text-xs text-neutral-600">Saved {new Date(q.created_at).toLocaleString()}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900"
            >
              Print
            </button>
            <Link href="/" className="h-10 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-extrabold text-white">
              Shop
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Customer</div>
            <div className="mt-2 text-sm text-neutral-700">
              {snap.customer.firstName} {snap.customer.lastName}
            </div>
            <div className="mt-1 text-xs text-neutral-600">
              {snap.customer.email ? `Email: ${snap.customer.email}` : ""}
              {snap.customer.email && snap.customer.phone ? " • " : ""}
              {snap.customer.phone ? `Phone: ${snap.customer.phone}` : ""}
            </div>
          </div>

          {vehicleLabel ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900">Vehicle</div>
              <div className="mt-2 text-sm text-neutral-700">{vehicleLabel}</div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Line items</div>
            <div className="mt-3 grid gap-2">
              {snap.lines.map((l, i) => {
                const ext = (l.unitPriceUsd || 0) * (l.qty || 0);
                return (
                  <div key={i} className="grid grid-cols-[1fr_70px_110px] items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                    <div>
                      <div className="text-sm font-extrabold text-neutral-900">{l.name}</div>
                      <div className="text-[11px] text-neutral-600">
                        {l.sku ? `SKU: ${l.sku} • ` : ""}{l.taxable ? "Taxable" : "Non-taxable"}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-neutral-700">Qty {l.qty}</div>
                    <div className="text-xs font-extrabold text-neutral-900">{money(ext)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-extrabold text-neutral-900">Price summary</div>
            <div className="mt-3 grid gap-2 text-sm">
              <Row k="Taxable parts" v={money(snap.totals.partsSubtotal)} />
              <Row k="Services" v={money(snap.totals.servicesSubtotal)} />
              <Row k={`Tax (${Math.round((snap.taxRate || 0) * 100)}%)`} v={money(snap.totals.tax)} />
              <div className="h-px bg-neutral-200" />
              <Row k="Total out the door" v={money(snap.totals.total)} strong />
            </div>
            <div className="mt-2 text-[11px] text-neutral-600">
              Total is an estimate. Well confirm fitment, availability and final invoice at installation.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <div className="font-extrabold text-neutral-900">{BRAND.name}</div>
            <div className="mt-1">Call: {BRAND.phone.callDisplay} • Email: {BRAND.email}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={strong ? "font-extrabold text-neutral-900" : "text-neutral-700"}>{k}</div>
      <div className={strong ? "font-extrabold text-neutral-900" : "font-semibold text-neutral-900"}>{v}</div>
    </div>
  );
}
