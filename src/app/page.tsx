import Link from "next/link";
import { HomeWheelShortcut } from "@/components/HomeWheelShortcut";

export const runtime = "nodejs";

/* =============================================================================
   CATEGORY CARD - Main shopping flow entry (Tires/Wheels/Lifted)
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
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all hover:shadow-md ${
        accent
          ? "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-300"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
          accent ? "bg-amber-100" : "bg-neutral-100"
        }`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-bold text-neutral-900">{title}</div>
          <div className="mt-0.5 text-sm text-neutral-600">{description}</div>
        </div>
      </div>
      <div className={`mt-4 text-sm font-semibold ${accent ? "text-amber-700" : "text-blue-700"} group-hover:underline`}>
        Shop Now →
      </div>
    </Link>
  );
}

/* =============================================================================
   TRUST BADGE - Single trust indicator
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
    <div className="flex flex-col items-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-2xl">
        {icon}
      </div>
      <div className="mt-3 font-bold text-neutral-900">{title}</div>
      <div className="mt-1 text-xs text-neutral-600">{description}</div>
    </div>
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

      {/* ===== CATEGORY CARDS (Tires/Wheels/Lifted) ===== */}
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
            href="/?open=tires&mode=vehicle"
            icon="🛞"
            gradient="bg-gradient-to-br from-neutral-800 to-neutral-900"
          />
          <CategoryCard
            title="Wheels"
            description="Browse aftermarket wheels with guaranteed fitment for your year, make, and model."
            href="/?open=wheels&mode=vehicle"
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

      {/* ===== TRUST SECTION ===== */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <TrustBadge
              icon="✓"
              title="Fitment Verified"
              description="Checked against your vehicle"
            />
            <TrustBadge
              icon="📦"
              title="In-Stock"
              description="Real-time availability"
            />
            <TrustBadge
              icon="🚚"
              title="Fast Shipping"
              description="Most orders ship same day"
            />
            <TrustBadge
              icon="🔧"
              title="Installation"
              description="Schedule at checkout"
            />
          </div>
        </div>
      </section>

      {/* ===== POPULAR SEARCHES ===== */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8">
          <h2 className="text-2xl font-extrabold text-neutral-900">Popular Searches</h2>
          <p className="mt-2 text-neutral-600">Jump to what most shoppers are looking for</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IntentCard
            title="All-Terrain Tires"
            description="A/T tires for trucks & SUVs"
            href="/tires/c/all-terrain"
            icon="🏔️"
          />
          <HomeWheelShortcut 
            title='20" Wheels' 
            desc="Most popular wheel size" 
            diameter={20} 
          />
          <IntentCard
            title="35x12.50R20 Tires"
            description="Popular lifted truck size"
            href="/tires?size=35x12.50R20"
            icon="🛻"
            accent
          />
          <IntentCard
            title="Performance Tires"
            description="Max grip for sports cars"
            href="/tires/c/performance"
            icon="🏎️"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IntentCard
            title="Winter Tires"
            description="Cold weather traction"
            href="/tires/c/winter"
            icon="❄️"
          />
          <HomeWheelShortcut 
            title='18" Wheels' 
            desc="Sedans & crossovers" 
            diameter={18} 
          />
          <IntentCard
            title="All-Season Tires"
            description="Year-round comfort"
            href="/tires/c/all-season"
            icon="☀️"
          />
          <HomeWheelShortcut 
            title='22" Wheels' 
            desc="Premium & statement" 
            diameter={22} 
          />
        </div>
      </section>

      {/* ===== LIFTED BUILDS SECTION ===== */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-sm font-semibold text-amber-400">
                <span>🏔️</span>
                <span>Lifted & Off-Road</span>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold text-white md:text-4xl">
                Build Your Lifted Truck
              </h2>
              <p className="mt-4 text-lg text-neutral-300">
                Select your lift height and vehicle — we'll recommend tire sizes and wheel specs that 
                actually fit. No guesswork, no rubbing, no returns.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400">✓</span>
                  2" to 6"+ lift recommendations
                </li>
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400">✓</span>
                  Tire sizes matched to your lift
                </li>
                <li className="flex items-center gap-3 text-neutral-300">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400">✓</span>
                  Wheel offset guidance included
                </li>
              </ul>
              <Link
                href="/lifted"
                className="mt-8 inline-flex h-14 items-center justify-center rounded-xl bg-amber-500 px-8 text-base font-extrabold text-white transition-colors hover:bg-amber-600"
              >
                Start Your Lifted Build →
              </Link>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="relative">
                <div className="text-[120px] leading-none">🛻</div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-amber-500/30 px-4 py-1 text-sm font-bold text-amber-400">
                  LIFTED
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTALL CTA ===== */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                <span>🔧</span>
                <span>Professional Installation</span>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold text-neutral-900 md:text-4xl">
                Don't just buy — get it installed
              </h2>
              <p className="mt-4 text-neutral-600">
                Schedule your tire or wheel installation when you checkout. Our certified technicians 
                handle mounting, balancing, and TPMS — all at competitive rates.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href="/schedule"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-extrabold text-white transition-colors hover:bg-neutral-800"
                >
                  Schedule Install
                </Link>
                <a
                  href="tel:+12483324120"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-neutral-300 px-6 text-sm font-extrabold text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  <span className="mr-2">📞</span>
                  248-332-4120
                </a>
              </div>
            </div>
            <div className="flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-12">
              <div className="text-center">
                <div className="text-7xl">🔧</div>
                <div className="mt-4 text-xl font-bold text-neutral-900">Same-Day Service</div>
                <div className="text-neutral-600">When you need it fast</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
