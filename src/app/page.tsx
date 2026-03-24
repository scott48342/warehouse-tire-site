import Link from "next/link";
import { HomeWheelShortcut } from "@/components/HomeWheelShortcut";
import { HomeFitmentEntry } from "@/components/HomeFitmentEntry";

export const runtime = "nodejs";

/* =============================================================================
   TRUST BADGES - Build confidence with key value props
============================================================================= */

function TrustBadge({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-lg">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-900">{title}</div>
        <div className="text-xs text-neutral-600">{description}</div>
      </div>
    </div>
  );
}

/* =============================================================================
   CATEGORY CARD - Compact category entry point
============================================================================= */

function CategoryCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition-all hover:border-amber-300 hover:bg-amber-50 hover:shadow-sm"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-2xl group-hover:bg-amber-100">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold text-neutral-900 group-hover:text-amber-900">{title}</div>
        <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
      </div>
      <span className="mt-1 text-neutral-300 transition-transform group-hover:translate-x-1 group-hover:text-amber-500">
        →
      </span>
    </Link>
  );
}

/* =============================================================================
   HOMEPAGE
============================================================================= */

export default async function Home() {
  return (
    <main className="bg-neutral-50">
      {/* ===== HERO SECTION ===== */}
      <section className="bg-gradient-to-b from-neutral-900 via-neutral-800 to-neutral-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-sm">
            <span className="text-green-400">✓</span>
            <span className="font-medium text-white/90">Fitment verified • In-stock inventory • Local install</span>
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
            Find Tires & Wheels That
            <span className="block text-amber-400">Actually Fit — Guaranteed</span>
          </h1>

          {/* Subtext */}
          <p className="mt-5 max-w-2xl text-lg text-neutral-300">
            Shop by vehicle for perfect fitment, browse by size, or build a complete wheel and tire package. 
            We verify every order fits before it ships.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/?open=wheels&mode=vehicle"
              className="inline-flex h-14 items-center justify-center rounded-xl bg-amber-500 px-8 text-base font-extrabold text-white transition-colors hover:bg-amber-600"
            >
              Shop Tires, Wheels & Packages
            </Link>
            <Link
              href="/lifted"
              className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-white/30 bg-white/5 px-8 text-base font-extrabold text-white backdrop-blur-sm transition-colors hover:border-amber-400 hover:bg-amber-500/10"
            >
              <span className="mr-2">🏔️</span>
              Lifted & Off-Road Builds
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mt-10 flex flex-wrap gap-8 border-t border-white/10 pt-8">
            <div>
              <div className="text-2xl font-extrabold text-amber-400">10,000+</div>
              <div className="text-sm text-neutral-400">Wheels in stock</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">50+</div>
              <div className="text-sm text-neutral-400">Tire brands</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-400">Same Day</div>
              <div className="text-sm text-neutral-400">Install available</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== VEHICLE-BASED SHOPPING ===== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <HomeFitmentEntry />
      </section>

      {/* ===== TRUST SECTION ===== */}
      <section className="border-y border-neutral-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TrustBadge
              icon="✓"
              title="Fitment Verified"
              description="Every order checked against your vehicle specs"
            />
            <TrustBadge
              icon="📦"
              title="In-Stock Inventory"
              description="Real-time availability from trusted suppliers"
            />
            <TrustBadge
              icon="🔧"
              title="Installation Available"
              description="Schedule professional install at checkout"
            />
            <TrustBadge
              icon="💰"
              title="Price Match"
              description="Found it cheaper? We'll match it"
            />
          </div>
        </div>
      </section>

      {/* ===== BROWSE BY CATEGORY ===== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6">
          <h2 className="text-xl font-extrabold text-neutral-900">Browse by Category</h2>
          <p className="mt-1 text-sm text-neutral-600">Jump straight to popular tire and wheel categories</p>
        </div>

        {/* Tire Categories */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CategoryCard
            title="All-Terrain Tires"
            description="A/T for trucks & SUVs"
            href="/tires/c/all-terrain"
            icon="🏔️"
          />
          <CategoryCard
            title="Truck Tires"
            description="Built for hauling & towing"
            href="/tires/c/truck"
            icon="🛻"
          />
          <CategoryCard
            title="Winter Tires"
            description="Cold weather traction"
            href="/tires/c/winter"
            icon="❄️"
          />
          <CategoryCard
            title="Performance Tires"
            description="Grip for sports cars"
            href="/tires/c/performance"
            icon="🏎️"
          />
        </div>

        {/* Wheel Sizes */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HomeWheelShortcut 
            title='20" Wheels' 
            desc="Popular for trucks & SUVs" 
            diameter={20} 
          />
          <HomeWheelShortcut 
            title='18" Wheels' 
            desc="Sedans & crossovers" 
            diameter={18} 
          />
          <HomeWheelShortcut 
            title='22" Wheels' 
            desc="Premium fitments" 
            diameter={22} 
          />
          <CategoryCard
            title="All-Season Tires"
            description="Year-round comfort"
            href="/tires/c/all-season"
            icon="☀️"
          />
        </div>
      </section>

      {/* ===== INSTALL CTA ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-neutral-900 to-neutral-800">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-semibold text-amber-400">
                <span>🔧</span>
                <span>Professional Installation</span>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">
                Don't just buy — get it installed
              </h2>
              <p className="mt-4 text-neutral-300">
                Schedule your tire or wheel installation when you checkout. Our certified technicians 
                handle mounting, balancing, and TPMS — all at competitive rates.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href="/schedule"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-500 px-6 text-sm font-extrabold text-white transition-colors hover:bg-amber-600"
                >
                  Schedule Install
                </Link>
                <a
                  href="tel:+12483324120"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-6 text-sm font-extrabold text-white transition-colors hover:bg-white/10"
                >
                  <span className="mr-2">📞</span>
                  248-332-4120
                </a>
              </div>
            </div>
            <div className="hidden items-center justify-center bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-12 md:flex">
              <div className="text-center">
                <div className="text-7xl">🔧</div>
                <div className="mt-4 text-xl font-bold text-white">Same-Day Service</div>
                <div className="text-neutral-400">When you need it fast</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
