import Link from "next/link";
import { HomeWheelShortcut } from "@/components/HomeWheelShortcut";
import { HomeFitmentEntry } from "@/components/HomeFitmentEntry";

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
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-900 p-6 text-white">
            <div className="text-xs font-semibold text-white/70">Quick links</div>
            <h2 className="mt-3 text-2xl font-extrabold">Popular categories</h2>
            <p className="mt-2 text-sm text-white/80">
              Browse like the big sites—fast categories and fitment-based shopping.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href="/?open=tires&mode=vehicle" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Shop by vehicle</div>
                <div className="mt-1 text-xs text-white/80">Find OEM sizes and options that fit.</div>
              </Link>
              <Link href="/?open=tires&mode=size" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
                <div className="text-sm font-extrabold">Shop by size</div>
                <div className="mt-1 text-xs text-white/80">If you already know your size.</div>
              </Link>
              <Link href="/?open=wheels&mode=vehicle" className="rounded-2xl bg-white/10 p-4 hover:bg-white/15">
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
        <HomeFitmentEntry />
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold text-neutral-900">Explore</h2>
          <div className="text-xs text-neutral-600">Quick shortcuts</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile title="All-season tires" desc="Daily drivers, comfort, long tread life." href="/tires/c/all-season" />
          <Tile title="Winter tires" desc="Cold weather traction and braking." href="/tires/c/winter" />
          <Tile title="All-terrain tires" desc="A/T traction for trucks and SUVs." href="/tires/c/all-terrain" />
          <HomeWheelShortcut title='20" wheels' desc="Browse 20-inch wheels that fit your vehicle." diameter={20} />
          <HomeWheelShortcut title='18" wheels' desc="Browse 18-inch wheels that fit your vehicle." diameter={18} />
          <Tile title="Package quote" desc="Build a wheel + tire quote fast." href="/wheels" />
        </div>
      </section>
    </main>
  );
}
