"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * BRAND SHOWCASE — Section 7 (replaces BrandLogoRow)
 *
 * Two-tab (Wheels / Tires) brand grid with logo images + fallback text.
 * Clearbit Logo API for images — auto-falls back to text if logo fails.
 *
 * SEO: All cards are <Link> → crawlable brand-filtered search paths.
 */

type BrandEntry = {
  name: string;
  logo: string;
  href: string;
};

const WHEEL_BRANDS: BrandEntry[] = [
  { name: "Fuel",            logo: "https://logo.clearbit.com/fueloffroad.com",        href: "/wheels?brand=fuel" },
  { name: "KMC",             logo: "https://logo.clearbit.com/kmcwheels.com",          href: "/wheels?brand=kmc" },
  { name: "XD",              logo: "https://logo.clearbit.com/xdwheels.com",           href: "/wheels?brand=xd" },
  { name: "Black Rhino",     logo: "https://logo.clearbit.com/blackrhino.com",         href: "/wheels?brand=black+rhino" },
  { name: "Method",          logo: "https://logo.clearbit.com/methodracewheels.com",   href: "/wheels?brand=method" },
  { name: "Rotiform",        logo: "https://logo.clearbit.com/rotiform.com",           href: "/wheels?brand=rotiform" },
  { name: "American Racing", logo: "https://logo.clearbit.com/americanracing.com",     href: "/wheels?brand=american+racing" },
  { name: "Niche",           logo: "https://logo.clearbit.com/nicheoffroad.com",       href: "/wheels?brand=niche" },
  { name: "DUB",             logo: "https://logo.clearbit.com/dubwheels.com",          href: "/wheels?brand=dub" },
  { name: "Foose",           logo: "https://logo.clearbit.com/foosedesign.com",        href: "/wheels?brand=foose" },
  { name: "TSW",             logo: "https://logo.clearbit.com/tsw.com",               href: "/wheels?brand=tsw" },
  { name: "Moto Metal",      logo: "https://logo.clearbit.com/motometal.com",          href: "/wheels?brand=moto+metal" },
  { name: "Touren",          logo: "https://logo.clearbit.com/tourenwheels.com",       href: "/wheels?brand=touren" },
  { name: "Mayhem",          logo: "https://logo.clearbit.com/mayhemwheels.com",       href: "/wheels?brand=mayhem" },
  { name: "ION Alloy",       logo: "https://logo.clearbit.com/ionwheels.com",          href: "/wheels?brand=ion+alloy" },
  { name: "Dirty Life",      logo: "https://logo.clearbit.com/dirtylifewheels.com",    href: "/wheels?brand=dirty+life" },
  { name: "Cali Off-Road",   logo: "https://logo.clearbit.com/calioffroad.com",        href: "/wheels?brand=cali+off-road" },
  { name: "Ridler",          logo: "https://logo.clearbit.com/ridlerwheels.com",       href: "/wheels?brand=ridler" },
];

const TIRE_BRANDS: BrandEntry[] = [
  { name: "Michelin",        logo: "https://logo.clearbit.com/michelin.com",           href: "/tires?brand=michelin" },
  { name: "BFGoodrich",      logo: "https://logo.clearbit.com/bfgoodrichtires.com",    href: "/tires?brand=bfgoodrich" },
  { name: "Goodyear",        logo: "https://logo.clearbit.com/goodyear.com",           href: "/tires?brand=goodyear" },
  { name: "Bridgestone",     logo: "https://logo.clearbit.com/bridgestonetire.com",    href: "/tires?brand=bridgestone" },
  { name: "Toyo",            logo: "https://logo.clearbit.com/toyotires.com",          href: "/tires?brand=toyo" },
  { name: "Nitto",           logo: "https://logo.clearbit.com/nittotire.com",          href: "/tires?brand=nitto" },
  { name: "Falken",          logo: "https://logo.clearbit.com/falkentire.com",         href: "/tires?brand=falken" },
  { name: "Pirelli",         logo: "https://logo.clearbit.com/pirelli.com",            href: "/tires?brand=pirelli" },
  { name: "Continental",     logo: "https://logo.clearbit.com/continental-tires.com",  href: "/tires?brand=continental" },
  { name: "Hankook",         logo: "https://logo.clearbit.com/hankooktire.com",        href: "/tires?brand=hankook" },
  { name: "Yokohama",        logo: "https://logo.clearbit.com/yokohamatire.com",       href: "/tires?brand=yokohama" },
  { name: "Kumho",           logo: "https://logo.clearbit.com/kumhotire.com",          href: "/tires?brand=kumho" },
  { name: "Cooper",          logo: "https://logo.clearbit.com/coopertire.com",         href: "/tires?brand=cooper" },
  { name: "General",         logo: "https://logo.clearbit.com/generaltire.com",        href: "/tires?brand=general" },
  { name: "Dunlop",          logo: "https://logo.clearbit.com/dunloptires.com",        href: "/tires?brand=dunlop" },
  { name: "Mickey Thompson", logo: "https://logo.clearbit.com/mickeythompsontires.com",href: "/tires?brand=mickey+thompson" },
];

function BrandCard({ brand }: { brand: BrandEntry }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link
      href={brand.href}
      className="group flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-neutral-200 hover:border-red-200 hover:shadow-md transition-all duration-200 min-h-[90px] gap-2"
    >
      {!imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logo}
          alt={`${brand.name} logo`}
          loading="lazy"
          className="h-10 w-full object-contain"
          onError={() => setImgFailed(true)}
        />
      )}
      <span
        className={`font-bold uppercase tracking-wide text-neutral-500 group-hover:text-red-600 text-center transition-colors ${
          imgFailed ? "text-sm" : "text-[11px]"
        }`}
      >
        {brand.name}
      </span>
    </Link>
  );
}

export function BrandShowcase() {
  const [tab, setTab] = useState<"wheels" | "tires">("wheels");
  const brands = tab === "wheels" ? WHEEL_BRANDS : TIRE_BRANDS;

  return (
    <section className="bg-neutral-50 py-12 lg:py-16">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">
            Our Inventory
          </p>
          <h2 className="text-2xl lg:text-3xl font-bold text-neutral-900">
            Brands We Carry
          </h2>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center gap-2 mb-8">
          {(["wheels", "tires"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-full text-sm font-bold uppercase tracking-wide transition-all ${
                tab === t
                  ? "bg-red-600 text-white shadow"
                  : "bg-white text-neutral-500 border border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Brand grid — 3 cols mobile → 4 tablet → 6 desktop → 8 xl */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {brands.map((b) => (
            <BrandCard key={b.name} brand={b} />
          ))}
        </div>

        {/* View all link */}
        <div className="text-center mt-8">
          <Link
            href={tab === "wheels" ? "/wheels/brands" : "/tires?sort=brand"}
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-bold uppercase tracking-wide transition-colors"
          >
            View All {tab === "wheels" ? "Wheel" : "Tire"} Brands →
          </Link>
        </div>
      </div>
    </section>
  );
}
