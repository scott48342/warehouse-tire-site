"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * PREMIUM NATIONAL HOMEPAGE
 * 
 * Exact match to mockup: g:\clawd\homepage\homepage layout.png
 */

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => String(THIS_YEAR + 1 - i));

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: TRUST BAR (below header)
// ═══════════════════════════════════════════════════════════════════════════════

function TrustBar() {
  return (
    <div className="bg-[#1a1a1a] border-b border-white/10">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between py-3 gap-6 overflow-x-auto">
          {/* Fast Reliable Shipping */}
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Fast, Reliable Shipping</p>
              <p className="text-white/40 text-xs">On orders over $199</p>
            </div>
          </div>

          {/* Fitment Guaranteed */}
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <div className="w-8 h-8 flex items-center justify-center text-red-500">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Fitment Guaranteed</p>
              <p className="text-white/40 text-xs">The right fit or we make it right</p>
            </div>
          </div>

          {/* Expert Support */}
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Expert Support</p>
              <p className="text-white/40 text-xs">7 days a week</p>
            </div>
          </div>

          {/* Curated Top Brands */}
          <div className="flex items-center gap-3 text-sm whitespace-nowrap">
            <div className="w-8 h-8 flex items-center justify-center text-yellow-500">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">Curated Top Brands</p>
              <p className="text-white/40 text-xs">Built to perform. Built to last.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: HERO
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  return (
    <section className="relative min-h-[420px] lg:min-h-[480px] flex items-center overflow-hidden bg-[#0a0a0a]">
      {/* Vehicle Image - right side */}
      <div className="absolute right-0 top-0 bottom-0 w-[60%] lg:w-[55%]">
        <Image
          src="/images/homepage/hero-vehicles.jpg"
          alt="Premium Ford truck with aftermarket wheels"
          fill
          priority
          className="object-cover object-center"
          sizes="60vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-8 py-12">
        <div className="max-w-lg">
          {/* AMERICA'S */}
          <p className="text-red-500 text-lg lg:text-xl font-medium italic mb-1">
            AMERICA'S
          </p>

          {/* FITMENT-FIRST */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.0] tracking-tight uppercase">
            FITMENT-FIRST
          </h1>
          
          {/* TIRE & WHEEL STORE */}
          <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.0] tracking-tight uppercase mt-1">
            TIRE & WHEEL STORE
          </p>

          {/* Subcopy */}
          <div className="mt-6 text-white/70 text-lg lg:text-xl leading-relaxed">
            <p>The right fit for your vehicle.</p>
            <p>The style for your build.</p>
            <p>The performance you can trust.</p>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#find-your-fit"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm uppercase tracking-wide px-6 py-3 transition-all"
            >
              Find Your Fit
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/wheels"
              className="inline-flex flex-col items-start bg-transparent border border-white/30 hover:border-white/50 text-white font-bold text-sm uppercase tracking-wide px-6 py-2.5 transition-all"
            >
              <span>Shop Wheels</span>
              <span className="text-white/50 text-xs normal-case font-normal">Shop Styles</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: VEHICLE SELECTOR (Find the Perfect Fit)
// ═══════════════════════════════════════════════════════════════════════════════

function VehicleSelectorSection() {
  const router = useRouter();
  const [tab, setTab] = useState<"vehicle" | "size">("vehicle");
  
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const [width, setWidth] = useState("");
  const [aspect, setAspect] = useState("");
  const [rim, setRim] = useState("");

  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(r => r.json())
      .then(data => setMakes(data.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoading(null));
  }, [year]);

  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${make}`)
      .then(r => r.json())
      .then(data => setModels(data.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(null));
  }, [year, make]);

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
    router.push(`/tires?${params.toString()}`);
  };

  const handleSizeSearch = () => {
    if (!width || !aspect || !rim) return;
    const size = `${width}/${aspect}R${rim}`;
    router.push(`/tires?size=${encodeURIComponent(size)}`);
  };

  const selectClass = `h-11 px-3 bg-[#1a1a1a] border border-white/20 rounded text-white text-sm focus:border-white/40 focus:outline-none appearance-none cursor-pointer ${loading ? "opacity-50" : ""}`;

  return (
    <section id="find-your-fit" className="bg-[#111] py-8">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="bg-[#0d0d0d] border border-white/10 rounded overflow-hidden">
          {/* Header row: Title on left, tabs on right */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h2 className="text-white font-bold text-xl uppercase tracking-wide">
              Find the Perfect Fit
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTab("vehicle")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide rounded transition-colors ${
                  tab === "vehicle" 
                    ? "bg-red-600 text-white" 
                    : "bg-transparent text-white/50 hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                By Vehicle
              </button>
              <button
                onClick={() => setTab("size")}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wide rounded transition-colors ${
                  tab === "size" 
                    ? "bg-red-600 text-white" 
                    : "bg-transparent text-white/50 hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                By Tire Size
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="p-5">
            {tab === "vehicle" ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Year</label>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="">Select Year</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Make</label>
                  <select value={make} onChange={(e) => setMake(e.target.value)} disabled={!year} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Select Make</option>
                    {makes.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Select Model</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Trim (Optional)</label>
                  <select value={trim} onChange={(e) => setTrim(e.target.value)} disabled={!model} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Select Trim</option>
                    {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleVehicleSearch}
                  disabled={!year || !make || !model}
                  className="h-11 px-8 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wide transition-colors rounded"
                >
                  Shop Tires
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Width</label>
                  <select value={width} onChange={(e) => setWidth(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="">Width</option>
                    {["175","185","195","205","215","225","235","245","255","265","275","285","295","305","315","325","335","345"].map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Aspect Ratio</label>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="">Aspect</option>
                    {["25","30","35","40","45","50","55","60","65","70","75","80","85"].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label className="block text-xs text-white/50 uppercase tracking-wide mb-1.5">Rim Diameter</label>
                  <select value={rim} onChange={(e) => setRim(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="">Rim</option>
                    {["14","15","16","17","18","19","20","21","22","24","26","28","30"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button
                  onClick={handleSizeSearch}
                  disabled={!width || !aspect || !rim}
                  className="h-11 px-8 bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wide transition-colors rounded"
                >
                  Shop Tires
                </button>
              </div>
            )}

            {/* Bottom info */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-white/50">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guaranteed to fit your vehicle
                </span>
                <span>
                  Save your vehicle in <Link href="/garage" className="text-red-500 hover:underline">My Garage</Link>
                </span>
              </div>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Free Shipping Over $199
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: SHOP BY VEHICLE TYPE (6 cards)
// ═══════════════════════════════════════════════════════════════════════════════

const VEHICLE_TYPES = [
  { title: "Daily Drivers", subtitle: "Cars, Sedans & Coupes", image: "/images/homepage/cat-daily-drivers.jpg", href: "/tires?intent=daily" },
  { title: "SUVs & Crossovers", subtitle: "Family, Crossover & 4x4", image: "/images/homepage/cat-suv-crossovers.jpg", href: "/tires?intent=suv" },
  { title: "Trucks & Jeeps", subtitle: "Half Ton, 3/4 Ton & Jeeps", image: "/images/homepage/cat-trucks-jeeps.jpg", href: "/wheels?intent=truck" },
  { title: "Lifted Builds", subtitle: "Lift Kits, Bigger Tires & Aggressive Stance", image: "/images/homepage/cat-lifted-builds.jpg", href: "/lifted" },
  { title: "Performance & Street", subtitle: "Performance Tires & Wheels", image: "/images/homepage/cat-performance-street.jpg", href: "/wheels?intent=performance" },
  { title: "Wheels Only", subtitle: "Shop All Styles & Brands", image: "/images/homepage/cat-wheels-only.jpg", href: "/wheels" },
];

function ShopByVehicleType() {
  return (
    <section className="bg-[#0a0a0a] py-10">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <h2 className="text-white font-bold text-sm uppercase tracking-widest mb-6">
          Shop by Vehicle Type
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {VEHICLE_TYPES.map((type) => (
            <Link key={type.title} href={type.href} className="group relative block overflow-hidden bg-neutral-900 rounded">
              <div className="aspect-[4/3] relative">
                <Image src={type.image} alt={type.title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width: 640px) 50vw, 16vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-white font-bold text-sm uppercase">{type.title}</h3>
                <p className="text-white/50 text-xs mt-0.5 leading-tight">{type.subtitle}</p>
                <div className="mt-2 text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: TRUST BADGE STRIP (4 items - NO Installation Partners)
// ═══════════════════════════════════════════════════════════════════════════════

const TRUST_BADGES = [
  { icon: "people", title: "Real People. Real Experts.", subtitle: "We're here to help." },
  { icon: "shipping", title: "Fast Shipping Nationwide", subtitle: "On orders over $199." },
  { icon: "returns", title: "Easy Returns. No Hassle.", subtitle: "30-day returns." },
  { icon: "built", title: "Built for What Drives You", subtitle: "On every road. Every day." },
];

function TrustBadgeStrip() {
  const getIcon = (type: string) => {
    switch(type) {
      case "people": return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
      case "shipping": return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>;
      case "returns": return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
      case "built": return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
      default: return null;
    }
  };

  return (
    <section className="bg-[#111] border-y border-white/10 py-6">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.title} className="flex items-center gap-3">
              <div className="text-white/40">{getIcon(badge.icon)}</div>
              <div>
                <p className="text-white font-semibold text-sm">{badge.title}</p>
                <p className="text-white/40 text-xs">{badge.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: CATEGORY PROMO CARDS (4 cards with curved clip)
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_PROMOS = [
  { image: "/images/homepage/tile-shop-wheels.jpg", href: "/wheels", alt: "Shop Wheels" },
  { image: "/images/homepage/tile-shop-tires.jpg", href: "/tires", alt: "Shop Tires" },
  { image: "/images/homepage/tile-shop-packages.jpg", href: "/wheels?package=1", alt: "Shop Packages" },
  { image: "/images/homepage/tile-shop-accessories.jpg", href: "/accessories", alt: "Shop Accessories" },
];

function CategoryPromoCards() {
  return (
    <section className="bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] py-10">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORY_PROMOS.map((promo) => (
            <Link key={promo.alt} href={promo.href} className="group relative block overflow-hidden rounded bg-black">
              {/* Full promo tile image - already has text/design baked in */}
              <div className="aspect-[4/5] relative overflow-hidden rounded">
                <Image 
                  src={promo.image} 
                  alt={promo.alt} 
                  fill 
                  className="object-contain transition-transform duration-500 group-hover:scale-105" 
                  sizes="(max-width: 640px) 100vw, 25vw" 
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: BRAND LOGO ROW
// ═══════════════════════════════════════════════════════════════════════════════

const BRAND_LOGOS = [
  { name: "Michelin", href: "/tires?brand=michelin" },
  { name: "BFGoodrich", href: "/tires?brand=bfgoodrich" },
  { name: "Goodyear", href: "/tires?brand=goodyear" },
  { name: "Toyo Tires", href: "/tires?brand=toyo" },
  { name: "Falken", href: "/tires?brand=falken" },
  { name: "Nitto", href: "/tires?brand=nitto" },
  { name: "Fuel", href: "/wheels?brand=fuel" },
  { name: "Method", href: "/wheels?brand=method" },
];

function BrandLogoRow() {
  return (
    <section className="bg-white py-6">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest mb-5">
          Top Tire & Wheel Brands
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-10">
          {BRAND_LOGOS.map((brand) => (
            <Link key={brand.name} href={brand.href} className="text-neutral-400 hover:text-neutral-700 font-bold text-sm uppercase tracking-wide transition-colors">
              {brand.name}
            </Link>
          ))}
        </div>
        <div className="text-center mt-4">
          <Link href="/brands" className="text-red-600 hover:text-red-700 text-xs font-bold uppercase tracking-wide">
            View All Brands →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: REVIEWS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const REVIEWS = [
  { text: '"Best selection and fast shipping." "Exactly what I needed."', author: "Mike D." },
  { text: '"Fitment was perfect." "Great communication."', author: "Jason T." },
  { text: '"Awesome prices and top notch support." "10/10."', author: "Sarah K." },
];

function ReviewsSection() {
  return (
    <section className="bg-[#f5f5f5] py-8">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-8">
          {/* Google rating */}
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold" style={{ color: '#4285F4' }}>G</div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-bold text-neutral-900">4.8</span>
                <div className="flex text-yellow-400">
                  {[1,2,3,4,5].map(s => <svg key={s} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                </div>
              </div>
              <p className="text-sm text-neutral-500">24,000+ Google Reviews</p>
              <p className="text-xs text-neutral-400">Real customers. Real results.</p>
            </div>
          </div>

          {/* Review quotes */}
          <div className="flex flex-wrap gap-8">
            {REVIEWS.map((review, i) => (
              <div key={i} className="max-w-[180px]">
                <div className="flex text-red-500 mb-1">
                  {[1,2,3,4,5].map(s => <svg key={s} className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                </div>
                <p className="text-sm text-neutral-600 italic leading-relaxed">{review.text}</p>
                <p className="text-xs text-neutral-500 mt-1">— {review.author}</p>
              </div>
            ))}
          </div>

          <Link href="/reviews" className="text-red-600 hover:text-red-700 text-sm font-bold uppercase tracking-wide whitespace-nowrap">
            View All Reviews →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: FITMENT PROMISE BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function FitmentPromiseBanner() {
  return (
    <section className="relative bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-md">
            <h2 className="text-3xl lg:text-4xl font-black uppercase tracking-tight leading-tight">
              <span className="text-white">Fitment First.</span><br />
              <span className="text-red-600">Every Time.</span>
            </h2>
            <p className="mt-4 text-white/50 text-sm leading-relaxed">
              Our fitment-first approach means you get the right products, the right way, every time. That's <span className="text-red-500">our promise</span>.
            </p>
            <Link href="/about" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm uppercase tracking-wide transition-all rounded">
              Learn More
            </Link>
          </div>
          <div className="relative w-[280px] h-[180px] lg:w-[350px] lg:h-[220px]">
            <Image src="/images/homepage/cat-all-terrain.png" alt="Premium tire" fill className="object-cover object-center opacity-60 rounded" sizes="350px" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: FOOTER TRUST BAR (NO Installation Partners)
// ═══════════════════════════════════════════════════════════════════════════════

function FooterTrustBar() {
  return (
    <section className="bg-[#050505] border-t border-white/10 py-5">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="font-medium text-white">Need Help?</span>
              <span>Call or Text (248) 332-4120</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="font-medium text-white">Expert Support</span>
              <span>7 Days a Week</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-xs mr-2">Secure Checkout</span>
            <div className="flex items-center gap-2">
              {["Visa", "MC", "Amex", "Disc", "PayPal"].map((card) => (
                <div key={card} className="w-10 h-6 bg-white/10 rounded flex items-center justify-center text-[10px] text-white/50 font-bold">
                  {card}
                </div>
              ))}
            </div>
          </div>
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
      <TrustBar />
      <HeroSection />
      <VehicleSelectorSection />
      <ShopByVehicleType />
      <TrustBadgeStrip />
      <CategoryPromoCards />
      <BrandLogoRow />
      <ReviewsSection />
      <FitmentPromiseBanner />
      <FooterTrustBar />
    </div>
  );
}
