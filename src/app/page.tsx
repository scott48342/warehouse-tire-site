import Link from "next/link";
import { HomeWheelShortcut } from "@/components/HomeWheelShortcut";
import { HeroVehicleEntry } from "@/components/HeroVehicleEntry";

export const runtime = "nodejs";

/* =============================================================================
   TRUST BADGE - Compact inline trust indicator
============================================================================= */

function TrustBadge({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-green-500">{icon}</span>
      <span className="text-neutral-600">{text}</span>
    </div>
  );
}

/* =============================================================================
   CATEGORY PILL - Compact category entry
============================================================================= */

function CategoryPill({
  title,
  href,
  icon,
  accent,
}: {
  title: string;
  href: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        accent
          ? "bg-amber-500 text-white hover:bg-amber-600"
          : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
      }`}
    >
      <span>{icon}</span>
      <span>{title}</span>
    </Link>
  );
}

/* =============================================================================
   INTENT CARD - Quick entry to specific products/categories
============================================================================= */

function IntentCard({
  title,
  description,
  href,
  icon,
  accent,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all hover:shadow-md ${
        accent
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-300"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${
          accent ? "bg-amber-100" : "bg-neutral-100"
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-neutral-900 truncate">{title}</div>
          <div className="mt-0.5 text-xs text-neutral-600">{description}</div>
        </div>
      </div>
    </Link>
  );
}

/* =============================================================================
   HOMEPAGE - Search-first, compact hero
============================================================================= */

export default async function Home() {
  return (
    <main className="bg-neutral-50">
      {/* ===== COMPACT HERO WITH SEARCH ===== */}
      <section className="bg-gradient-to-b from-neutral-900 to-neutral-800">
        <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
          {/* Headline - compact */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">
              Find Tires & Wheels That Fit
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Enter your vehicle for guaranteed fitment
            </p>
          </div>

          {/* Vehicle Search Entry - THE MAIN CTA */}
          <HeroVehicleEntry />

          {/* Quick category pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <CategoryPill title="Lifted Builds" href="/lifted" icon="🏔️" accent />
            <CategoryPill title="All-Terrain Tires" href="/tires/c/all-terrain" icon="🛞" />
            <CategoryPill title="Performance" href="/tires/c/performance" icon="🏎️" />
          </div>

          {/* Compact trust bar */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-6 text-xs">
            <TrustBadge icon="✓" text="Fitment verified" />
            <TrustBadge icon="📦" text="In-stock" />
            <TrustBadge icon="🚚" text="Fast shipping" />
          </div>
        </div>
      </section>

      {/* ===== POPULAR SEARCHES - Immediately visible ===== */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-neutral-900">Popular Searches</h2>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <IntentCard
            title="All-Terrain Tires"
            description="A/T for trucks & SUVs"
            href="/tires/c/all-terrain"
            icon="🏔️"
          />
          <HomeWheelShortcut 
            title='20" Wheels' 
            desc="Most popular size" 
            diameter={20} 
          />
          <IntentCard
            title="35x12.50R20"
            description="Lifted truck favorite"
            href="/tires?size=35x12.50R20"
            icon="🛻"
            accent
          />
          <IntentCard
            title="Winter Tires"
            description="Cold weather traction"
            href="/tires/c/winter"
            icon="❄️"
          />
        </div>

        <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
          <IntentCard
            title="All-Season"
            description="Year-round comfort"
            href="/tires/c/all-season"
            icon="☀️"
          />
          <HomeWheelShortcut 
            title='18" Wheels' 
            desc="Sedans & crossovers" 
            diameter={18} 
          />
          <IntentCard
            title="Performance"
            description="Max grip"
            href="/tires/c/performance"
            icon="🏎️"
          />
          <HomeWheelShortcut 
            title='22" Wheels' 
            desc="Premium look" 
            diameter={22} 
          />
        </div>
      </section>

      {/* ===== LIFTED BUILDS CTA ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <Link
          href="/lifted"
          className="group block overflow-hidden rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 p-6 md:p-8 transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
                <span>🏔️</span>
                <span>Off-Road</span>
              </div>
              <h2 className="mt-3 text-xl md:text-2xl font-extrabold text-white">
                Build Your Lifted Truck
              </h2>
              <p className="mt-2 text-sm text-neutral-400 max-w-lg">
                Select your lift height — we'll recommend tire sizes and wheel specs that fit.
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-400 group-hover:underline">
                Start Building <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
            <div className="hidden md:block text-7xl opacity-80">🛻</div>
          </div>
        </Link>
      </section>

      {/* ===== TRUST SECTION - Compact ===== */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-center">
            <div>
              <div className="text-2xl">✓</div>
              <div className="mt-1 text-sm font-bold text-neutral-900">Fitment Verified</div>
              <div className="text-xs text-neutral-500">Checked for your vehicle</div>
            </div>
            <div>
              <div className="text-2xl">📦</div>
              <div className="mt-1 text-sm font-bold text-neutral-900">In-Stock</div>
              <div className="text-xs text-neutral-500">Real-time inventory</div>
            </div>
            <div>
              <div className="text-2xl">🚚</div>
              <div className="mt-1 text-sm font-bold text-neutral-900">Fast Shipping</div>
              <div className="text-xs text-neutral-500">Most orders ship same day</div>
            </div>
            <div>
              <div className="text-2xl">🔧</div>
              <div className="mt-1 text-sm font-bold text-neutral-900">Installation</div>
              <div className="text-xs text-neutral-500">Schedule at checkout</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTALL CTA - Compact ===== */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                <span>🔧</span>
                <span>Professional Installation</span>
              </div>
              <h2 className="mt-3 text-xl font-extrabold text-neutral-900">
                Get it installed
              </h2>
              <p className="mt-2 text-sm text-neutral-600 max-w-md">
                Schedule your tire or wheel installation at checkout. Mounting, balancing, and TPMS included.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/schedule"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-extrabold text-white transition-colors hover:bg-neutral-800"
              >
                Schedule Install
              </Link>
              <a
                href="tel:+12483324120"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 px-5 text-sm font-extrabold text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                <span className="mr-2">📞</span>
                248-332-4120
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
