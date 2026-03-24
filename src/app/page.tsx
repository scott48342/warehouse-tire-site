import Link from "next/link";
import { HomeWheelShortcut } from "@/components/HomeWheelShortcut";
import { HomeFitmentEntry } from "@/components/HomeFitmentEntry";

export const runtime = "nodejs";

/* =============================================================================
   CATEGORY CARDS - Visual entry points for main shopping flows
============================================================================= */

function CategoryCard({
  title,
  description,
  href,
  icon,
  gradient,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  gradient: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl p-6 text-white transition-transform hover:scale-[1.02] ${gradient}`}
    >
      {badge && (
        <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm">
          {badge}
        </span>
      )}
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
      <p className="mt-2 text-sm text-white/80">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-white group-hover:underline">
        Shop Now
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </div>
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
    </Link>
  );
}

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
   QUICK LINK - Fast entry to popular categories
============================================================================= */

function QuickLink({
  title,
  href,
  icon,
}: {
  title: string;
  href: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-amber-300 hover:bg-amber-50"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-semibold text-neutral-900 group-hover:text-amber-900">
        {title}
      </span>
      <span className="ml-auto text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-amber-600">
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
              href="/wheels"
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

      {/* ===== CATEGORY CARDS ===== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <h2 className="text-2xl font-extrabold text-neutral-900 md:text-3xl">
            What are you shopping for?
          </h2>
          <p className="mt-2 text-neutral-600">
            Choose your path — we'll help you find the perfect fit
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <CategoryCard
            title="Tires"
            description="All-season, winter, all-terrain, performance — find tires sized for your vehicle."
            href="/tires"
            icon="🛞"
            gradient="bg-gradient-to-br from-neutral-800 to-neutral-900"
          />
          <CategoryCard
            title="Wheels"
            description="Browse aftermarket wheels with guaranteed fitment for your year, make, and model."
            href="/wheels"
            icon="⚙️"
            gradient="bg-gradient-to-br from-blue-600 to-blue-800"
          />
          <CategoryCard
            title="Lifted Builds"
            description="Build your lifted truck or SUV with the right tire and wheel combo."
            href="/lifted"
            icon="🏔️"
            gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            badge="Popular"
          />
        </div>
      </section>

      {/* ===== VEHICLE-BASED SHOPPING (existing component) ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
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

      {/* ===== FEATURED QUICK LINKS ===== */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900">Popular Categories</h2>
            <p className="mt-1 text-sm text-neutral-600">Jump straight to what you need</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink title="All-Terrain Tires" href="/tires/c/all-terrain" icon="🏔️" />
          <QuickLink title="Truck Tires" href="/tires/c/truck" icon="🛻" />
          <QuickLink title="Winter Tires" href="/tires/c/winter" icon="❄️" />
          <QuickLink title="Performance Tires" href="/tires/c/performance" icon="🏎️" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HomeWheelShortcut 
            title='20" Wheels' 
            desc="Most popular size for trucks & SUVs" 
            diameter={20} 
          />
          <HomeWheelShortcut 
            title='18" Wheels' 
            desc="Great for sedans and crossovers" 
            diameter={18} 
          />
          <HomeWheelShortcut 
            title='22" Wheels' 
            desc="Go big with premium fitments" 
            diameter={22} 
          />
          <QuickLink title="All-Season Tires" href="/tires/c/all-season" icon="☀️" />
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

      {/* ===== EXPLORE TILES (preserved from original) ===== */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-extrabold text-neutral-900">Explore More</h2>
          <div className="text-xs text-neutral-600">Additional shortcuts</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/tires/c/all-season"
            className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
          >
            <div className="text-sm font-extrabold text-neutral-900 group-hover:underline">All-season tires</div>
            <div className="mt-1 text-xs text-neutral-600">Daily drivers, comfort, long tread life.</div>
            <div className="mt-3 text-xs font-extrabold text-blue-700">Shop →</div>
          </Link>
          <Link
            href="/tires/c/winter"
            className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
          >
            <div className="text-sm font-extrabold text-neutral-900 group-hover:underline">Winter tires</div>
            <div className="mt-1 text-xs text-neutral-600">Cold weather traction and braking.</div>
            <div className="mt-3 text-xs font-extrabold text-blue-700">Shop →</div>
          </Link>
          <Link
            href="/wheels"
            className="group rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300"
          >
            <div className="text-sm font-extrabold text-neutral-900 group-hover:underline">Package quote</div>
            <div className="mt-1 text-xs text-neutral-600">Build a wheel + tire quote fast.</div>
            <div className="mt-3 text-xs font-extrabold text-blue-700">Shop →</div>
          </Link>
        </div>
      </section>
    </main>
  );
}
