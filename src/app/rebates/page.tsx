import Link from "next/link";
import { getPool, listActiveRebates, type SiteRebate } from "@/lib/rebates";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

export const metadata = {
  title: `Tire Rebates & Offers | ${BRAND.name}`,
  description: "Save money on your next set of tires with manufacturer rebates. Get up to $100 back on Goodyear, Cooper, Pirelli, and more top tire brands.",
};

function RebateCard({ rebate }: { rebate: SiteRebate }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Brand + Amount */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {rebate.brand || "Manufacturer"} Rebate
          </div>
          <h3 className="mt-1 text-lg font-extrabold text-neutral-900 leading-tight">
            {rebate.headline}
          </h3>
        </div>
        {rebate.rebate_amount && (
          <span className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-lg font-extrabold text-white shadow">
            {rebate.rebate_amount}
          </span>
        )}
      </div>

      {/* Valid dates */}
      {rebate.ends_text && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          <span>📅</span>
          Valid: {rebate.ends_text}
        </div>
      )}

      {/* Requirements */}
      {rebate.requirements && (
        <p className="mt-3 text-sm text-neutral-600">
          <strong>Requirement:</strong> {rebate.requirements}
        </p>
      )}

      {/* CTAs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {rebate.form_url && (
          <a
            href={rebate.form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
          >
            Claim Rebate
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
        {rebate.learn_more_url && (
          <a
            href={rebate.learn_more_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Learn More
          </a>
        )}
        <Link
          href={`/tires?brand=${encodeURIComponent(rebate.brand || "")}`}
          className="inline-flex items-center rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          Shop {rebate.brand} Tires
        </Link>
      </div>

      {/* Fine print */}
      <p className="mt-4 text-[10px] text-neutral-400">
        Rebate submitted after purchase via manufacturer's website. Terms and exclusions may apply.
      </p>
    </div>
  );
}

export default async function RebatesPage() {
  const db = getPool();
  const rebates = await listActiveRebates(db);

  return (
    <main className="bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Hero */}
        <div className="text-center">
          <span className="text-4xl">💰</span>
          <h1 className="mt-2 text-3xl font-extrabold text-neutral-900 md:text-4xl">
            Tire Rebates & Offers
          </h1>
          <p className="mt-2 text-lg text-neutral-600">
            Save money with manufacturer rebates on your next set of tires
          </p>
        </div>

        {/* How it works */}
        <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-extrabold text-neutral-900">How Rebates Work</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">1</span>
              <div>
                <div className="font-bold text-neutral-900">Shop & Buy Tires</div>
                <p className="text-sm text-neutral-600">Purchase eligible tires from our store</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">2</span>
              <div>
                <div className="font-bold text-neutral-900">Submit Rebate</div>
                <p className="text-sm text-neutral-600">Fill out the manufacturer's rebate form online</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">3</span>
              <div>
                <div className="font-bold text-neutral-900">Get Your Cash Back</div>
                <p className="text-sm text-neutral-600">Receive prepaid card or check from manufacturer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rebates grid */}
        {rebates.length > 0 ? (
          <div className="mt-10">
            <h2 className="text-xl font-extrabold text-neutral-900">Current Rebates</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {rebates.map((rebate) => (
                <RebateCard key={rebate.id} rebate={rebate} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
            <span className="text-4xl">📭</span>
            <h2 className="mt-2 text-lg font-bold text-neutral-900">No Active Rebates</h2>
            <p className="mt-1 text-neutral-600">
              Check back soon — new manufacturer rebates are added regularly.
            </p>
            <Link
              href="/tires"
              className="mt-4 inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-bold text-white hover:bg-neutral-800"
            >
              Shop Tires
            </Link>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/tires"
            className="inline-flex items-center rounded-xl bg-[var(--brand-red)] px-8 py-4 text-lg font-extrabold text-white hover:bg-[var(--brand-red-700)]"
          >
            Shop Tires
          </Link>
          <p className="mt-2 text-sm text-neutral-500">
            Rebate badges appear on eligible tires throughout our store
          </p>
        </div>
      </div>
    </main>
  );
}
