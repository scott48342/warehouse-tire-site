"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { JakeAvatar } from "@/components/jake";

/**
 * PREMIUM NATIONAL HOMEPAGE - CINEMATIC REBUILD
 * 
 * Goals:
 * - Cinematic, alive, premium, immersive
 * - Emotional engagement + conversion focused
 * - Modern automotive brand feel
 * - NOT flat, static, or template-like
 */

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 35 }, (_, i) => String(THIS_YEAR + 1 - i));

// ═══════════════════════════════════════════════════════════════════════════════
// HERO BACKGROUNDS (rotate randomly)
// ═══════════════════════════════════════════════════════════════════════════════

const HERO_BACKGROUNDS = [
  "/images/homepage/hero-garage-02.jpg",
  "/images/homepage/hero-garage-04.jpg",
  "/images/homepage/misc-wheel-wall.jpg",
];

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CinematicHero() {
  const [bgImage, setBgImage] = useState(HERO_BACKGROUNDS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const randomBg = HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)];
    setBgImage(randomBg);
  }, []);

  return (
    <section className="relative min-h-[600px] lg:min-h-[700px] flex items-center overflow-hidden">
      {/* Background Image Layer */}
      <div className="absolute inset-0">
        <Image
          src={bgImage}
          alt="Premium garage showroom"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      {/* Gradient Overlays - Lifted shadows for visibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      
      {/* Red Glow Accent - Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[300px] bg-gradient-to-t from-red-900/20 to-transparent pointer-events-none" />
      
      {/* Radial Glow Behind Content */}
      <div 
        className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(220,38,38,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Floating Particles (subtle) */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `float-particle ${8 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Soft Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)",
      }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 lg:px-8 py-16">
        <div className="max-w-2xl">
          {/* Tagline */}
          <p className="text-red-500 text-lg lg:text-xl font-semibold tracking-wide mb-2 animate-fade-in-up">
            AMERICA'S FITMENT-FIRST
          </p>

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[0.95] tracking-tight uppercase animate-fade-in-up animation-delay-100">
            TIRE & WHEEL
            <br />
            <span className="text-red-500">DESTINATION</span>
          </h1>

          {/* Subcopy */}
          <p className="mt-6 text-white/70 text-xl lg:text-2xl leading-relaxed max-w-lg animate-fade-in-up animation-delay-200">
            The right fit for your vehicle.
            <br />
            The style for your build.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap gap-4 animate-fade-in-up animation-delay-300">
            <Link
              href="#find-your-fit"
              className="group inline-flex items-center gap-3 bg-red-600 hover:bg-red-500 text-white font-bold text-base uppercase tracking-wide px-8 py-4 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.4)] rounded-lg"
            >
              Find Your Fit
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/jake"
              className="group inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 hover:border-white/40 text-white font-bold text-base uppercase tracking-wide px-8 py-4 transition-all duration-300 hover:scale-105 rounded-lg"
            >
              <JakeAvatar size="xs" />
              Ask Jake
            </Link>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.2; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.4; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.3; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.2; }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST BAR (Enhanced with subtle glow)
// ═══════════════════════════════════════════════════════════════════════════════

function TrustBar() {
  const items = [
    { icon: "shipping", title: "Fast Shipping", sub: "Orders over $199", color: "text-white/60" },
    { icon: "fitment", title: "Fitment Guaranteed", sub: "The right fit or we fix it", color: "text-red-500" },
    { icon: "support", title: "Expert Support", sub: "7 days a week", color: "text-white/60" },
    { icon: "brands", title: "Top Brands", sub: "Built to perform", color: "text-amber-500" },
  ];

  const getIcon = (type: string) => {
    switch(type) {
      case "shipping": return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>;
      case "fitment": return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
      case "support": return <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
      case "brands": return <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
      default: return null;
    }
  };

  return (
    <div className="bg-[#0f0f0f] border-b border-white/5">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between py-4 gap-6 overflow-x-auto">
          {items.map((item) => (
            <div key={item.title} className="flex items-center gap-3 text-sm whitespace-nowrap group">
              <div className={`${item.color} transition-all duration-300 group-hover:scale-110`}>
                {getIcon(item.icon)}
              </div>
              <div>
                <p className="text-white font-semibold">{item.title}</p>
                <p className="text-white/40 text-xs">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM VEHICLE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════════

type ShoppingIntent = "tires" | "wheels" | "package";

const INTENT_CONFIG: Record<ShoppingIntent, { label: string; buttonText: string; }> = {
  tires: { label: "Tires", buttonText: "Shop Tires" },
  wheels: { label: "Wheels", buttonText: "Shop Wheels" },
  package: { label: "Package", buttonText: "Build Package" },
};

function VehicleSelectorSection() {
  const router = useRouter();
  const [intent, setIntent] = useState<ShoppingIntent>("tires");
  const [focused, setFocused] = useState(false);
  
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState<string | null>(null);

  // Vehicle cascading effects
  useEffect(() => {
    if (!year) { setMakes([]); setMake(""); return; }
    setLoading("makes");
    fetch(`/api/vehicles/makes?year=${year}`)
      .then(r => r.json())
      .then(data => setMakes(data.results || data.makes || []))
      .catch(() => setMakes([]))
      .finally(() => setLoading(null));
  }, [year]);

  useEffect(() => {
    if (!year || !make) { setModels([]); setModel(""); return; }
    setLoading("models");
    fetch(`/api/vehicles/models?year=${year}&make=${make}`)
      .then(r => r.json())
      .then(data => setModels(data.results || data.models || []))
      .catch(() => setModels([]))
      .finally(() => setLoading(null));
  }, [year, make]);

  useEffect(() => {
    if (!year || !make || !model) { setTrims([]); setTrim(""); return; }
    setLoading("trims");
    fetch(`/api/vehicles/trims?year=${year}&make=${make}&model=${model}`)
      .then(r => r.json())
      .then(data => {
        const rawTrims = data.results || data.trims || [];
        const trimList = rawTrims.map((t: any) => ({
          value: typeof t === "string" ? t : t.trim || t.value,
          label: typeof t === "string" ? t : t.trimDisplay || t.label || t.trim,
        }));
        setTrims(trimList);
      })
      .catch(() => setTrims([]))
      .finally(() => setLoading(null));
  }, [year, make, model]);

  const handleSearch = () => {
    if (!year || !make || !model) return;
    const params = new URLSearchParams({ year, make, model });
    if (trim) params.set("trim", trim);
    
    if (intent === "tires") {
      router.push(`/tires?${params.toString()}`);
    } else if (intent === "wheels") {
      router.push(`/wheels?${params.toString()}`);
    } else {
      params.set("package", "1");
      router.push(`/wheels?${params.toString()}`);
    }
  };

  const selectClass = `h-12 px-4 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer transition-all duration-300 ${loading ? "opacity-50" : ""}`;

  return (
    <section id="find-your-fit" className="relative bg-[#0a0a0a] py-12 overflow-hidden">
      {/* Atmospheric gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tight">
            Find Your <span className="text-red-500">Perfect Fit</span>
          </h2>
          <p className="mt-2 text-white/50">
            Enter your vehicle and we'll show guaranteed fitment options
          </p>
        </div>

        {/* Selector Card with Glow */}
        <div 
          className={`relative max-w-4xl mx-auto transition-all duration-500 ${focused ? "scale-[1.01]" : ""}`}
        >
          {/* Glow Effect */}
          <div 
            className={`absolute -inset-1 bg-gradient-to-r from-red-600/20 via-red-500/10 to-red-600/20 rounded-2xl blur-xl transition-opacity duration-500 ${focused ? "opacity-100" : "opacity-0"}`}
          />
          
          <div className="relative bg-[#111] border border-white/10 rounded-xl overflow-hidden backdrop-blur-xl">
            {/* Intent Selector */}
            <div className="flex border-b border-white/10">
              {(Object.keys(INTENT_CONFIG) as ShoppingIntent[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setIntent(key)}
                  className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide transition-all duration-300 ${
                    intent === key
                      ? "bg-red-600 text-white"
                      : "bg-transparent text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {INTENT_CONFIG[key].label}
                </button>
              ))}
            </div>

            {/* Form */}
            <div 
              className="p-6"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            >
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Year</label>
                  <select value={year} onChange={(e) => setYear(e.target.value)} className={`${selectClass} w-full`}>
                    <option value="">Select</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Make</label>
                  <select value={make} onChange={(e) => setMake(e.target.value)} disabled={!year} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Select</option>
                    {makes.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!make} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Select</option>
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wide mb-2">Trim</label>
                  <select value={trim} onChange={(e) => setTrim(e.target.value)} disabled={!model} className={`${selectClass} w-full disabled:opacity-40`}>
                    <option value="">Optional</option>
                    {trims.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSearch}
                    disabled={!year || !make || !model}
                    className="w-full h-12 bg-red-600 hover:bg-red-500 disabled:bg-red-600/30 disabled:cursor-not-allowed text-white font-bold text-sm uppercase tracking-wide transition-all duration-300 rounded-lg hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]"
                  >
                    {INTENT_CONFIG[intent].buttonText}
                  </button>
                </div>
              </div>

              {/* Bottom info */}
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-white/40">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Guaranteed fitment
                </span>
                <span>
                  or <Link href="/jake" className="text-red-500 hover:text-red-400">ask Jake</Link> for help
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE AI ADVISOR SECTION (Premium Rebuild)
// ═══════════════════════════════════════════════════════════════════════════════

function JakeAdvisorSection() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="relative bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] py-16 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-red-900/10 blur-[100px] pointer-events-none" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8">
        <div 
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glassmorphism Card */}
          <div className={`relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden transition-all duration-500 ${isHovered ? "border-red-500/30 shadow-[0_0_60px_rgba(220,38,38,0.15)]" : ""}`}>
            {/* Animated Border Shimmer */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div 
                className="absolute inset-0 opacity-0 transition-opacity duration-500"
                style={{
                  opacity: isHovered ? 0.5 : 0,
                  background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.3), transparent)",
                  animation: isHovered ? "shimmer 2s infinite" : "none",
                }}
              />
            </div>

            <div className="relative flex flex-col lg:flex-row items-center gap-8 p-8 lg:p-12">
              {/* Jake Image */}
              <div className="relative flex-shrink-0">
                <div className={`relative transition-transform duration-500 ${isHovered ? "scale-105" : ""}`}>
                  {/* Glow behind image */}
                  <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-2xl opacity-60" />
                  <Image
                    src="/images/jake/jake-explaining.png"
                    alt="Jake - Your AI Fitment Advisor"
                    width={200}
                    height={200}
                    className="relative rounded-xl object-cover shadow-2xl"
                  />
                  {/* Online indicator */}
                  <div className="absolute -bottom-2 -right-2 flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-3 py-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-white/70 font-medium">Online</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 text-center lg:text-left">
                <p className="text-red-500 text-sm font-semibold uppercase tracking-wider mb-2">
                  AI Build Advisor
                </p>
                <h2 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tight">
                  Meet <span className="text-red-500">Jake</span>
                </h2>
                <p className="mt-4 text-white/60 text-lg leading-relaxed max-w-lg">
                  Not sure what fits? Jake knows every bolt pattern, offset, and tire size. 
                  Tell him your vehicle and build style — he'll recommend the perfect setup.
                </p>

                {/* Quick prompts */}
                <div className="mt-6 flex flex-wrap gap-2 justify-center lg:justify-start">
                  {["Best tires for my truck", "Build me a package", "Will 35s fit?"].map((prompt) => (
                    <Link
                      key={prompt}
                      href={`/jake?q=${encodeURIComponent(prompt)}`}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/70 hover:text-white text-sm transition-all"
                    >
                      "{prompt}"
                    </Link>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href="/jake"
                  className="inline-flex items-center gap-3 mt-8 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-base uppercase tracking-wide rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.4)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Ask Jake Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD CATEGORY CARDS (Cinematic Rebuild)
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_CATEGORIES = [
  { 
    title: "Trucks & Jeeps", 
    subtitle: "Half-ton, 3/4-ton, Jeeps", 
    image: "/images/homepage/vehicle-ram-aggressive.jpg", 
    href: "/wheels?intent=truck",
    accent: "from-red-600/40"
  },
  { 
    title: "Lifted Builds", 
    subtitle: "Lift kits, bigger tires, aggressive stance", 
    image: "/images/homepage/vehicle-silverado-lifted.jpg", 
    href: "/lifted",
    accent: "from-orange-600/40"
  },
  { 
    title: "Performance", 
    subtitle: "Street, track, staggered setups", 
    image: "/images/homepage/vehicle-corvette-track.jpg", 
    href: "/wheels?intent=performance",
    accent: "from-blue-600/40"
  },
  { 
    title: "Daily Drivers", 
    subtitle: "Cars, sedans, crossovers", 
    image: "/images/homepage/vehicle-camaro-street.jpg", 
    href: "/tires?intent=daily",
    accent: "from-purple-600/40"
  },
  { 
    title: "Off-Road", 
    subtitle: "All-terrain, mud-terrain, overland", 
    image: "/images/homepage/vehicle-tacoma-overland.jpg", 
    href: "/tires?intent=offroad",
    accent: "from-green-600/40"
  },
  { 
    title: "SUVs", 
    subtitle: "Family haulers, luxury SUVs", 
    image: "/images/homepage/vehicle-tahoe-blackout.jpg", 
    href: "/tires?intent=suv",
    accent: "from-cyan-600/40"
  },
];

function BuildCategoryCards() {
  return (
    <section className="relative bg-[#0a0a0a] py-16">
      {/* Section divider gradient */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#0d0d0d] to-transparent pointer-events-none" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tight">
            Shop Your <span className="text-red-500">Build Style</span>
          </h2>
          <p className="mt-2 text-white/50">Find the perfect setup for how you drive</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {BUILD_CATEGORIES.map((cat) => (
            <Link 
              key={cat.title} 
              href={cat.href}
              className="group relative block overflow-hidden rounded-xl bg-neutral-900 aspect-[4/3] lg:aspect-[16/10]"
            >
              {/* Image */}
              <Image 
                src={cat.image} 
                alt={cat.title} 
                fill 
                className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110" 
                sizes="(max-width: 768px) 50vw, 33vw" 
              />
              
              {/* Overlay */}
              <div className={`absolute inset-0 bg-gradient-to-t ${cat.accent} via-black/50 to-black/30 transition-opacity duration-500 group-hover:opacity-80`} />
              
              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-5 lg:p-6">
                <h3 className="text-white font-black text-xl lg:text-2xl uppercase tracking-tight group-hover:text-red-400 transition-colors">
                  {cat.title}
                </h3>
                <p className="text-white/60 text-sm mt-1 group-hover:text-white/80 transition-colors">
                  {cat.subtitle}
                </p>
                
                {/* Arrow */}
                <div className="mt-3 flex items-center gap-2 text-red-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                  <span className="text-sm font-semibold uppercase">Shop Now</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl ring-2 ring-red-500/30" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE PANELS (Cinematic Storytelling)
// ═══════════════════════════════════════════════════════════════════════════════

function FeaturePanels() {
  const panels = [
    {
      title: "Fitment Guaranteed",
      subtitle: "The right fit or we make it right",
      description: "Every wheel and tire we sell is verified to fit your exact vehicle. No guessing, no returns, no hassle.",
      image: "/images/homepage/misc-wheel-wall.jpg",
      cta: "Learn More",
      href: "/about/fitment-guarantee",
      align: "left" as const,
    },
    {
      title: "Built by Experts",
      subtitle: "30+ years in the business",
      description: "We're not just another online retailer. We're enthusiasts who know these builds inside and out.",
      image: "/images/homepage/misc-neon-wtd.jpg",
      cta: "About Us",
      href: "/about",
      align: "right" as const,
    },
  ];

  return (
    <section className="bg-[#0a0a0a]">
      {panels.map((panel, idx) => (
        <div key={panel.title} className="relative min-h-[400px] lg:min-h-[500px] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <Image
              src={panel.image}
              alt={panel.title}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className={`absolute inset-0 bg-gradient-to-${panel.align === "left" ? "r" : "l"} from-black/90 via-black/60 to-transparent`} />
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8 h-full min-h-[400px] lg:min-h-[500px] flex items-center">
            <div className={`max-w-lg ${panel.align === "right" ? "ml-auto text-right" : ""}`}>
              <p className="text-red-500 text-sm font-semibold uppercase tracking-wider mb-2">
                {panel.subtitle}
              </p>
              <h2 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-tight">
                {panel.title}
              </h2>
              <p className="mt-4 text-white/60 text-lg leading-relaxed">
                {panel.description}
              </p>
              <Link
                href={panel.href}
                className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-lg transition-all"
              >
                {panel.cta}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS SECTION (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

function ReviewsSection() {
  return (
    <section className="bg-[#111] py-12 border-y border-white/5">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Rating */}
          <div className="flex items-center gap-4">
            <div className="text-5xl font-black text-white">4.8</div>
            <div>
              <div className="flex text-yellow-400 mb-1">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-white font-semibold">24,000+ Reviews</p>
              <p className="text-white/40 text-sm">Real customers. Real results.</p>
            </div>
          </div>

          {/* CTA */}
          <Link href="/reviews" className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold rounded-lg transition-all">
            Read All Reviews →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL CTA SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function FinalCTA() {
  return (
    <section className="relative bg-[#0a0a0a] py-20 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-900/20 blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-4 lg:px-8 text-center">
        <h2 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tight">
          Ready to Build?
        </h2>
        <p className="mt-4 text-white/60 text-lg max-w-lg mx-auto">
          Find your perfect setup in minutes. Fitment guaranteed.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#find-your-fit"
            className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold text-base uppercase tracking-wide rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.4)]"
          >
            Find Your Fit
          </Link>
          <Link
            href="/jake"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-base uppercase tracking-wide rounded-xl transition-all"
          >
            Ask Jake
          </Link>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER TRUST BAR
// ═══════════════════════════════════════════════════════════════════════════════

function FooterTrustBar() {
  return (
    <section className="bg-[#050505] border-t border-white/10 py-6">
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Expert Support 7 Days a Week</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-xs mr-2">Secure Checkout</span>
            <div className="flex items-center gap-2">
              {["Visa", "MC", "Amex", "PayPal"].map((card) => (
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
      <CinematicHero />
      <TrustBar />
      <VehicleSelectorSection />
      <JakeAdvisorSection />
      <BuildCategoryCards />
      <FeaturePanels />
      <ReviewsSection />
      <FinalCTA />
      <FooterTrustBar />
    </div>
  );
}
