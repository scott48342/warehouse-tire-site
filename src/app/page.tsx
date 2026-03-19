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
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 md:p-10">
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
