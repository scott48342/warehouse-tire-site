import Link from "next/link";

export const runtime = "nodejs";

function Tile({
  title,
  desc,
  href,
}: {
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
    >
      <div className="text-sm font-extrabold text-neutral-900 group-hover:underline">{title}</div>
      <div className="mt-1 text-xs text-neutral-600">{desc}</div>
      <div className="mt-3 text-xs font-extrabold text-blue-700">Shop →</div>
    </Link>
  );
}

export default async function Home() {
  return (
    <main className="bg-neutral-50">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-6 md:grid-cols-2 md:p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-neutral-900">
              Local install • real fitment • fast scheduling
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-neutral-900 md:text-5xl">
              Tires & wheels that fit.
              <span className="block text-[var(--brand-red)]">Installed fast.</span>
            </h1>
            <p className="mt-4 max-w-prose text-base text-neutral-700">
              Shop tires and wheels with vehicle-based fitment, then schedule your install.
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
                Shop Tires
              </Link>
              <Link
                href="/wheels"
                className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Shop Wheels
              </Link>
            </div>

            <div className="mt-6 grid gap-3 text-sm text-neutral-700 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Start with your vehicle</div>
                <div className="mt-1 font-semibold">Use the header garage / vehicle picker.</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="text-xs font-semibold text-neutral-600">Need help?</div>
                <div className="mt-1 font-semibold">Schedule install or call us.</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 p-6 text-white">
            <div className="text-xs font-semibold text-white/70">Quick links</div>
            <h2 className="mt-3 text-2xl font-extrabold">Popular categories</h2>
            <p className="mt-2 text-sm text-white/80">
              Browse like the big sites—fast categories and fitment-based shopping.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/tires" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Shop by vehicle</div>
                <div className="mt-1 text-xs text-white/80">Find OEM sizes and options that fit.</div>
              </Link>
              <Link href="/tires" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Shop by size</div>
                <div className="mt-1 text-xs text-white/80">If you already know your size.</div>
              </Link>
              <Link href="/wheels" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Wheels</div>
                <div className="mt-1 text-xs text-white/80">Browse styles and finishes.</div>
              </Link>
              <Link href="/schedule" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Schedule</div>
                <div className="mt-1 text-xs text-white/80">Pick a time—done.</div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold text-neutral-900">Explore</h2>
          <div className="text-xs text-neutral-600">Quick shortcuts</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile title="All-season tires" desc="Daily drivers, comfort, long tread life." href="/tires" />
          <Tile title="Winter tires" desc="Cold weather traction and braking." href="/tires" />
          <Tile title="All-terrain / truck" desc="A/T, LT, towing and off-road options." href="/tires" />
          <Tile title='20" wheels' desc="Browse popular 20-inch wheel styles." href="/wheels" />
          <Tile title='18" wheels' desc="Popular size for trucks and SUVs." href="/wheels" />
          <Tile title="Package quote" desc="Build a wheel + tire quote fast." href="/wheels" />
        </div>
      </section>
    </main>
  );
}
