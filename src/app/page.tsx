import Link from "next/link";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="bg-neutral-50">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-neutral-900">
              Retail promo style • clean & high-conversion
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
              Tires that fit.
              <span className="block text-[var(--brand-red)]">Installed fast.</span>
            </h1>
            <p className="mt-4 max-w-prose text-base text-neutral-700">
              We’re starting with a conversion-first flow: schedule install, call, or
              text—then we’ll layer in full ordering + shipping once supplier
              connections are live.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/schedule"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
              >
                Schedule Install
              </Link>
              <Link
                href="/tires"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Browse Tires
              </Link>
              <a
                href={BRAND.links.tel}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Call {BRAND.phone.callDisplay}
              </a>
              <a
                href={BRAND.links.sms}
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Text {BRAND.phone.textDisplay}
              </a>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">What’s live now</div>
                <div className="mt-1 font-semibold">Schedule • Call • Text • WhatsApp</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Next up</div>
                <div className="mt-1 font-semibold">Fitment + supplier inventory + pricing</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 p-6 text-white">
            <div className="text-xs font-semibold text-white/70">Conversion shell preview</div>
            <h2 className="mt-3 text-2xl font-extrabold">Search + filter results (PLP)</h2>
            <p className="mt-2 text-sm text-white/80">
              Filters left, products right, bold price blocks, local availability.
            </p>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold">All-Season Touring</div>
                  <div className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-neutral-900">
                    $100 rebate
                  </div>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-extrabold">$149</div>
                    <div className="text-xs text-white/70">each • installed options available</div>
                  </div>
                  <div className="rounded-xl bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold">
                    Schedule
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/70">In stock near you • install this week</div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold">LT All-Terrain</div>
                  <div className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-extrabold">
                    Popular
                  </div>
                </div>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-extrabold">$219</div>
                    <div className="text-xs text-white/70">each • financing available</div>
                  </div>
                  <div className="rounded-xl bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold">
                    Call
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/70">Check fitment to confirm availability</div>
              </div>
            </div>

            <div className="mt-5 text-xs text-white/60">
              (Next: real vehicle selector + product feed)
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Fast answers</div>
            <div className="mt-1 text-lg font-extrabold">Call or text now</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-extrabold text-white" href={BRAND.links.tel}>
                Call
              </a>
              <a className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold" href={BRAND.links.sms}>
                Text
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Local install</div>
            <div className="mt-1 text-lg font-extrabold">Schedule first</div>
            <p className="mt-2 text-sm text-neutral-700">
              We confirm fitment and availability with you.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="text-xs font-semibold text-neutral-600">Coming soon</div>
            <div className="mt-1 text-lg font-extrabold">Order + shipping</div>
            <p className="mt-2 text-sm text-neutral-700">
              Supplier integrations will unlock real-time inventory and checkout.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
