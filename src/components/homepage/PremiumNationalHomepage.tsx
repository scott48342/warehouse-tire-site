"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * PREMIUM NATIONAL HOMEPAGE
 * 
 * Flagship brand identity homepage for shop.warehousetiredirect.com
 * Design: Bold, dark, premium automotive authority
 * Theme: Black (#050505) / Charcoal / Red / White
 */

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => String(THIS_YEAR + 1 - i));

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE SELECTOR (INLINE)
// ═══════════════════════════════════════════════════════════════════════════════

function PremiumVehicleSelector({ variant = "hero" }: { variant?: "hero" | "hub" }) {
  const router = useRouter();
  const [tab, setTab] = useState<"vehicle" | "size">("vehicle");
  
  // Vehicle selection state
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // Size selection state
  const [width, setWidth] = useState("");
  const [aspect, setAspect] = useState("");
  const [rim, setRim] = useState("");

  // Fetch makes when year changes
  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(r => r.json())
      .then(data => setMakes(data.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoading(null));
  }, [year]);

  // Fetch models when make changes
  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${make}`)
      .then(r => r.json())
      .then(data => setModels(data.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(null));
  }, [year, make]);

  // Fetch trims when model changes
  useEffect(() => {
    if (!year || !make || !model) { setTrims([]); setTrim(""); return; }
    setLoading("trims");
    fetch(`/api/vehicles/trims?year=${year}&make=${make}&model=${model}`)
      .then(r => r.json())
      .then(data => {
        const trimList = (data.trims || []).map((t: any) => ({
          value: typeof t === "string" ? t : t.trim || t.value,
          label: typeof t === "string" ? t : t.trimDisplay || t.label || t.trim,
        }));
        setTrims(trimList);
      })
      .catch(() => setTrims([]))
      .finally(() => setLoading(null));
  }, [year, make, model]);

  const handleVehicleSearch = () => {
    if (!year || !make || !model) return;
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    router.push(`/wheels?${params.toString()}`);
  };

  const handleSizeSearch = () => {
    if (!width || !aspect || !rim) return;
    const size = `${width}/${aspect}R${rim}`;
    router.push(`/tires?size=${encodeURIComponent(size)}`);
  };

  const isHero = variant === "hero";
  const selectClass = `w-full h-12 px-4 bg-neutral-900 border border-white/20 text-white font-semibold text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none appearance-none cursor-pointer ${loading ? "opacity-50" : ""}`;
  const buttonClass = "w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold text-sm uppercase tracking-wide transition-colors flex items-center justify-center gap-2";

  return (
    <div>
      {/* Tabs */}
      {!isHero && (
        <div className="flex mb-6 border-b border-white/10">
          <button
            onClick={() => setTab("vehicle")}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === "vehicle" 
                ? "text-white border-b-2 border-red-600" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Shop by Vehicle
          </button>
          <button
            onClick={() => setTab("size")}
            className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === "size" 
                ? "text-white border-b-2 border-red-600" 
                : "text-white/50 hover:text-white"
            }`}
          >
            Shop by Tire Size
          </button>
        </div>
      )}

      {/* Vehicle Tab */}
      {(isHero || tab === "vehicle") && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={selectClass}
          >
            <option value="">Year</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          
          <select
            value={make}
            onChange={(e) => setMake(e.target.value)}
            disabled={!year || loading === "makes"}
            className={selectClass}
          >
            <option value="">Make</option>
            {makes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={!make || loading === "models"}
            className={selectClass}
          >
            <option value="">Model</option>
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          
          <select
            value={trim}
            onChange={(e) => setTrim(e.target.value)}
            disabled={!model || loading === "trims"}
            className={selectClass}
          >
            <option value="">Trim (Optional)</option>
            {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          
          <div className={isHero ? "col-span-2 lg:col-span-4 mt-2" : "col-span-2 lg:col-span-4"}>
            <button
              onClick={handleVehicleSearch}
              disabled={!year || !make || !model}
              className={`${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span>Find Wheels & Tires</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Size Tab */}
      {!isHero && tab === "size" && (
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
          <select
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className={selectClass}
          >
            <option value="">Width</option>
            {["205", "215", "225", "235", "245", "255", "265", "275", "285", "295", "305", "315", "325", "335"].map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
          
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            className={selectClass}
          >
            <option value="">Aspect</option>
            {["30", "35", "40", "45", "50", "55", "60", "65", "70", "75", "80"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          
          <select
            value={rim}
            onChange={(e) => setRim(e.target.value)}
            className={selectClass}
          >
            <option value="">Rim</option>
            {["15", "16", "17", "18", "19", "20", "21", "22", "24", "26"].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          
          <button
            onClick={handleSizeSearch}
            disabled={!width || !aspect || !rim}
            className={`${buttonClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <span>Search</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: HERO
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="relative min-h-[700px] lg:min-h-[760px] flex items-center">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/homepage/hero-vehicles.jpg"
          alt="Premium vehicles"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Hero Copy */}
          <div>
            {/* Eyebrow */}
            <p className="text-red-500 text-xs sm:text-sm font-bold tracking-[0.2em] uppercase mb-4">
              America's Fitment-First Tire & Wheel Store
            </p>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[0.95] tracking-tight uppercase">
              Built For<br />
              <span className="text-red-600">Every Driver.</span>
            </h1>

            {/* Subcopy */}
            <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-xl leading-relaxed">
              From daily drivers to lifted builds, Warehouse Tire Direct delivers the right tires, wheels, and packages shipped straight to your door.
            </p>

            {/* Trust Strip */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm text-white/50 uppercase tracking-wide font-semibold">
              <span className="flex items-center gap-2">
                <span className="text-red-500">✓</span> Fitment Guaranteed
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-500">✓</span> Fast Shipping
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-500">✓</span> Expert Support
              </span>
              <span className="flex items-center gap-2">
                <span className="text-red-500">✓</span> Curated Top Brands
              </span>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/wheels"
                className="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white font-bold text-sm sm:text-base uppercase tracking-wide px-8 py-4 transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-600/30"
              >
                Shop By Vehicle
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
              <Link
                href="/tires"
                className="inline-flex items-center gap-3 border-2 border-white/30 hover:border-white/60 text-white font-bold text-sm sm:text-base uppercase tracking-wide px-8 py-4 transition-all hover:bg-white/10"
              >
                Shop By Size
              </Link>
            </div>
          </div>

          {/* Right: Vehicle Selector (Premium Embedded) */}
          <div className="hidden lg:block">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-8">
              <h3 className="text-white font-bold text-lg uppercase tracking-wide mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-red-600"></span>
                Find Your Fit
              </h3>
              <PremiumVehicleSelector variant="hero" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: SIX SHOPPER CATEGORY LANES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LANES = [
  {
    title: "Daily Drivers",
    description: "Reliable replacements for cars that work every day.",
    image: "/images/homepage/cat-daily-drivers.jpg",
    href: "/tires?intent=daily",
  },
  {
    title: "SUV & Crossovers",
    description: "Built for family hauling, comfort, and confidence.",
    image: "/images/homepage/cat-suv-crossovers.jpg",
    href: "/tires?intent=suv",
  },
  {
    title: "Trucks & Jeeps",
    description: "Tough setups for work, trail, and weekend use.",
    image: "/images/homepage/cat-trucks-jeeps.jpg",
    href: "/wheels?intent=truck",
  },
  {
    title: "Lifted Builds",
    description: "Aggressive wheel and tire packages that stand tall.",
    image: "/images/homepage/cat-lifted-builds.jpg",
    href: "/lifted",
  },
  {
    title: "Performance Street",
    description: "Lowered, staggered, and speed-driven setups.",
    image: "/images/homepage/cat-performance-street.jpg",
    href: "/wheels?intent=performance",
  },
  {
    title: "Shop Wheels Only",
    description: "Find the perfect stance and finish.",
    image: "/images/homepage/cat-wheels-only.jpg",
    href: "/wheels",
  },
];

function CategoryLane({ 
  title, 
  description, 
  image, 
  href 
}: { 
  title: string; 
  description: string; 
  image: string; 
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block aspect-[4/3] overflow-hidden bg-neutral-900"
    >
      {/* Background Image */}
      <Image
        src={image}
        alt={title}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-110"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      
      {/* Hover Darken */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
      
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6">
        <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-sm text-white/60 leading-relaxed">
          {description}
        </p>
        
        {/* Arrow CTA */}
        <div className="mt-4 flex items-center gap-2 text-red-500 font-bold text-sm uppercase tracking-wide">
          <span>Shop Now</span>
          <svg 
            className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function ShopperCategoryLanes() {
  return (
    <section className="bg-[#050505] py-16 lg:py-20">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-red-500 text-xs font-bold tracking-[0.2em] uppercase mb-3">
            Shop Your Style
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight">
            Find Your Perfect Setup
          </h2>
        </div>

        {/* 3x2 Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {CATEGORY_LANES.map((lane) => (
            <CategoryLane key={lane.title} {...lane} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: FEATURE PROMO TILE ROW
// ═══════════════════════════════════════════════════════════════════════════════

const PROMO_TILES = [
  { image: "/images/homepage/tile-shop-tires.jpg", href: "/tires", alt: "Shop Tires" },
  { image: "/images/homepage/tile-shop-wheels.jpg", href: "/wheels", alt: "Shop Wheels" },
  { image: "/images/homepage/tile-shop-packages.jpg", href: "/wheels?package=1", alt: "Shop Packages" },
  { image: "/images/homepage/tile-shop-accessories.jpg", href: "/accessories", alt: "Shop Accessories" },
];

function PromoTileRow() {
  return (
    <section className="bg-[#0a0a0a] py-12 lg:py-16">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {PROMO_TILES.map((tile) => (
            <Link
              key={tile.alt}
              href={tile.href}
              className="group relative block aspect-[16/9] lg:aspect-[4/3] overflow-hidden bg-neutral-900"
            >
              <Image
                src={tile.image}
                alt={tile.alt}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: TRUST / AUTHORITY STRIP
// ═══════════════════════════════════════════════════════════════════════════════

const TRUST_ITEMS = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Fitment Guaranteed",
    description: "Every order built around your exact vehicle.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Fast Reliable Shipping",
    description: "Nationwide delivery on top brands.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: "Real Expert Support",
    description: "Real people who know wheels and tires.",
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: "Curated Top Brands",
    description: "Only proven names enthusiasts trust.",
  },
];

function TrustAuthorityStrip() {
  return (
    <section className="bg-[#050505] border-y border-white/5 py-12 lg:py-16">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {TRUST_ITEMS.map((item) => (
            <div key={item.title} className="text-center lg:text-left">
              <div className="inline-flex items-center justify-center lg:justify-start text-red-500 mb-4">
                {item.icon}
              </div>
              <h3 className="text-white font-bold text-sm uppercase tracking-wide mb-2">
                {item.title}
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: SELECTOR / SHOPPING HUB
// ═══════════════════════════════════════════════════════════════════════════════

function ShoppingHub() {
  return (
    <section className="bg-[#080808] py-16 lg:py-24">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white uppercase tracking-tight">
            Start With Your Vehicle.
          </h2>
          <p className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black text-red-600 uppercase tracking-tight">
            Build It Your Way.
          </p>
        </div>

        {/* Premium Selector Frame */}
        <div className="bg-[#0d0d0d] border border-white/10 p-8 lg:p-12">
          <PremiumVehicleSelector variant="hub" />
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 lg:gap-6">
          <Link href="/wheels" className="text-white/50 hover:text-white text-sm font-semibold uppercase tracking-wide transition-colors">
            Browse All Wheels →
          </Link>
          <Link href="/tires" className="text-white/50 hover:text-white text-sm font-semibold uppercase tracking-wide transition-colors">
            Browse All Tires →
          </Link>
          <Link href="/wheels?package=1" className="text-white/50 hover:text-white text-sm font-semibold uppercase tracking-wide transition-colors">
            Browse All Packages →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: LOWER FULL WIDTH CTA BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function BottomCTABanner() {
  return (
    <section className="relative min-h-[500px] lg:min-h-[600px] flex items-center">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/images/homepage/bottom-build-right.jpg"
          alt="Build it right"
          fill
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1500px] mx-auto px-6 lg:px-12 py-16">
        <div className="max-w-2xl">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase tracking-tight leading-[0.95]">
            Build It Right.<br />
            <span className="text-red-600">We Deliver.</span>
          </h2>
          <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl">
            Premium tires, wheels, packages and accessories shipped nationwide with fitment confidence built in.
          </p>
          <div className="mt-10">
            <Link
              href="/wheels"
              className="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white font-bold text-base uppercase tracking-wide px-10 py-5 transition-all hover:scale-105 hover:shadow-lg hover:shadow-red-600/30"
            >
              Start Your Build Today
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: BRAND LOGO ROW
// ═══════════════════════════════════════════════════════════════════════════════

const BRAND_NAMES = ["Fuel", "Nitto", "Toyo", "BFGoodrich", "Michelin", "Moto Metal", "Method", "KMC", "American Force", "Hostile"];

function BrandLogoRow() {
  return (
    <section className="bg-[#050505] border-t border-white/5 py-12 lg:py-16">
      <div className="max-w-[1500px] mx-auto px-6 lg:px-12">
        <div className="text-center mb-10">
          <p className="text-white/30 text-xs font-bold tracking-[0.2em] uppercase">
            Brands We Carry
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
          {BRAND_NAMES.map((brand) => (
            <span
              key={brand}
              className="text-white/30 hover:text-white/50 font-bold text-sm uppercase tracking-wide transition-colors"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function PremiumNationalHomepage() {
  return (
    <div className="bg-[#050505] min-h-screen">
      <HeroSection />
      <ShopperCategoryLanes />
      <PromoTileRow />
      <TrustAuthorityStrip />
      <ShoppingHub />
      <BottomCTABanner />
      <BrandLogoRow />
    </div>
  );
}
