"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Build-First Cinematic Experience
// 
// Philosophy:
// - BUILD-FIRST with AI guidance (not AI-first)
// - Vehicle spectacle is the centerpiece
// - Wheels/tires MUST be highly visible
// - Jake guides, doesn't dominate
// - "I want MY vehicle to look like THAT" reaction
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// Featured builds - rotating showcase
const FEATURED_BUILDS = [
  {
    id: "ram-aggressive",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    title: "AGGRESSIVE RAM",
    subtitle: "35\" Nitto Ridge Grapplers • 20\" Fuel Rebels • 3\" Lift",
    category: "lifted",
    prompt: "Build me an aggressive RAM setup like this",
  },
  {
    id: "silverado-lifted",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    title: "LIFTED SILVERADO",
    subtitle: "37\" BFG KO2s • 22\" American Force • 6\" Suspension",
    category: "lifted",
    prompt: "Build me a lifted Silverado package",
  },
  {
    id: "camaro-street",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    title: "STREET CAMARO",
    subtitle: "Staggered 20/21\" • Michelin PS4S • Lowered Stance",
    category: "street",
    prompt: "Build me a staggered Camaro setup",
  },
  {
    id: "tacoma-overland",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    title: "OVERLAND TACOMA",
    subtitle: "33\" Falken Wildpeak • 17\" Method 703 • 2.5\" Lift",
    category: "offroad",
    prompt: "Build me an overland Tacoma setup",
  },
];

// Build style categories for interactive showcase
const BUILD_STYLES = [
  { id: "lifted", label: "Lifted", icon: "🔺", color: "red" },
  { id: "street", label: "Street", icon: "🏎️", color: "blue" },
  { id: "offroad", label: "Off-Road", icon: "🏔️", color: "amber" },
  { id: "blackout", label: "Blackout", icon: "⚫", color: "neutral" },
];

// Transformation showcase data
const TRANSFORMATIONS = [
  { 
    before: "/images/homepage/truck-stock.png",
    after: "/images/homepage/truck-lifted.png",
    label: "Stock → Lifted",
    desc: "+6\" lift • 35\" tires • 20\" wheels",
  },
];

export function JakeGarageHero({ onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [currentBuild, setCurrentBuild] = useState(0);
  const [showTransform, setShowTransform] = useState(false);
  const [transformProgress, setTransformProgress] = useState(0);

  // Rotate featured builds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBuild((prev) => (prev + 1) % FEATURED_BUILDS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onStart(input.trim());
  };

  const featured = FEATURED_BUILDS[currentBuild];

  return (
    <div className="min-h-screen flex flex-col bg-[#030303]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO - Vehicle Spectacle as Centerpiece
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        
        {/* Featured Build - MASSIVE, Dominant */}
        <div className="absolute inset-0">
          {FEATURED_BUILDS.map((build, idx) => (
            <div
              key={build.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                idx === currentBuild ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={build.image}
                alt={build.title}
                fill
                className="object-cover object-center"
                priority={idx === 0}
                sizes="100vw"
              />
            </div>
          ))}
          
          {/* Gradient overlays - minimal to show build detail */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-black/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-black/40" />
          
          {/* Bottom fade for content */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-[#030303] to-transparent" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-red-500/50 group-hover:ring-red-500 transition-all">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Build Studio</p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/wheels" className="text-sm text-white/60 hover:text-white transition-colors">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/60 hover:text-white transition-colors">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/60 hover:text-white transition-colors">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/60 hover:text-white transition-colors">Lifted</Link>
          </nav>

          {/* Jake Status - Smaller, supporting */}
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/10">
            <span className="text-xs text-white/60">Jake Online</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </header>

        {/* Main Content - Build Info Left, Search Center-Right */}
        <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center lg:items-end px-6 lg:px-12 pb-8 lg:pb-16 gap-8">
          
          {/* Left: Featured Build Info */}
          <div className="flex-1 flex flex-col justify-end">
            {/* Build badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600/30 border border-red-500/40 rounded-full mb-4 w-fit">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Featured Build</span>
            </div>
            
            {/* Build title - MASSIVE */}
            <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[0.9] tracking-tight mb-3">
              {featured.title.split(" ")[0]}<br />
              <span className="text-red-500">{featured.title.split(" ").slice(1).join(" ")}</span>
            </h2>
            
            {/* Build specs */}
            <p className="text-lg lg:text-xl text-white/70 mb-6 max-w-md">
              {featured.subtitle}
            </p>
            
            {/* Build this button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onStart(featured.prompt);
              }}
              className="inline-flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all w-fit group"
            >
              <span>Build This Setup</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            
            {/* Build selector dots */}
            <div className="flex gap-2 mt-6">
              {FEATURED_BUILDS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCurrentBuild(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentBuild 
                      ? "bg-red-500 w-8" 
                      : "bg-white/30 hover:bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Right: Search & Quick Start */}
          <div className="w-full lg:w-[420px] flex-shrink-0">
            {/* Search Card */}
            <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-red-500/30">
                  <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
                </div>
                <div>
                  <p className="text-white font-bold">Start Your Build</p>
                  <p className="text-white/50 text-xs">Jake will guide your fitment</p>
                </div>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className={`relative flex items-center bg-white/5 border-2 rounded-xl overflow-hidden transition-all mb-4 ${
                  isFocused ? "border-red-500/60 bg-white/10" : "border-white/10"
                }`}>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="What do you drive?"
                    className="flex-1 bg-transparent px-4 py-3.5 text-white placeholder-white/40 focus:outline-none"
                  />
                  <button 
                    type="submit" 
                    disabled={!input.trim()} 
                    className="m-1.5 px-5 py-2 bg-red-600 hover:bg-red-500 disabled:bg-white/10 text-white font-bold rounded-lg transition-all"
                  >
                    Go
                  </button>
                </div>
              </form>

              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2">
                {["Lifted truck", "Staggered setup", "Off-road build"].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onStart(q);
                    }}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-sm transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Trust Bar */}
        <div className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-12 text-xs lg:text-sm">
              <div className="flex items-center gap-2 text-white/50">
                <span className="text-green-500">✓</span> Fitment Guaranteed
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <span className="text-green-500">✓</span> Free Shipping $1500+
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <span className="text-green-500">✓</span> Expert Support
              </div>
              <div className="flex items-center gap-2 text-white/50">
                <span className="text-green-500">✓</span> Top Brands Only
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD TRANSFORMATION SHOWCASE - Interactive WOW Moment
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center mb-12">
            <p className="text-red-500 text-sm font-bold uppercase tracking-[0.2em] mb-3">Transform Your Ride</p>
            <h3 className="text-3xl lg:text-5xl font-black text-white mb-4">
              See The <span className="text-red-500">Difference</span>
            </h3>
            <p className="text-white/50 max-w-xl mx-auto">
              Drag to see how a wheel and tire package transforms an ordinary truck into something extraordinary.
            </p>
          </div>

          {/* Before/After Slider */}
          <div className="relative max-w-4xl mx-auto">
            <div 
              className="relative aspect-[16/9] rounded-2xl overflow-hidden cursor-ew-resize group"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                setTransformProgress(Math.max(0, Math.min(100, (x / rect.width) * 100)));
              }}
              onMouseEnter={() => setShowTransform(true)}
              onMouseLeave={() => setShowTransform(false)}
            >
              {/* After (bottom layer) */}
              <Image
                src="/images/homepage/truck-lifted.png"
                alt="After: Lifted Package"
                fill
                className="object-contain bg-gradient-to-br from-neutral-900 to-black"
              />
              
              {/* Before (top layer, clipped) */}
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - transformProgress}% 0 0)` }}
              >
                <Image
                  src="/images/homepage/truck-stock.png"
                  alt="Before: Stock"
                  fill
                  className="object-contain bg-gradient-to-br from-neutral-800 to-neutral-900"
                />
              </div>
              
              {/* Slider line */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-red-500 shadow-lg shadow-red-500/50"
                style={{ left: `${transformProgress}%` }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-xl">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
              
              {/* Labels */}
              <div className="absolute top-4 left-4 px-3 py-1 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm font-bold">
                STOCK
              </div>
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-600/90 backdrop-blur-sm rounded-full text-white text-sm font-bold">
                LIFTED PACKAGE
              </div>
            </div>
            
            {/* Package details */}
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-center">
              <div>
                <p className="text-2xl font-black text-white">+6"</p>
                <p className="text-white/50 text-sm">Lift Height</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <p className="text-2xl font-black text-white">35"</p>
                <p className="text-white/50 text-sm">Tire Size</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <p className="text-2xl font-black text-white">20"</p>
                <p className="text-white/50 text-sm">Wheel Diameter</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <p className="text-2xl font-black text-red-500">WOW</p>
                <p className="text-white/50 text-sm">Factor</p>
              </div>
            </div>
            
            {/* CTA */}
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStart("Build me a lifted truck package");
                }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all text-lg"
              >
                Build Your Transformation
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD STYLE GALLERY - Inspiration Grid
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#030303] py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center mb-12">
            <p className="text-red-500 text-sm font-bold uppercase tracking-[0.2em] mb-3">Find Your Style</p>
            <h3 className="text-3xl lg:text-4xl font-black text-white">
              What's Your <span className="text-red-500">Build?</span>
            </h3>
          </div>

          {/* Style cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { 
                id: "lifted",
                title: "LIFTED", 
                desc: "Go bigger. Stand taller.", 
                image: "/images/homepage/vehicle-silverado-lifted.jpg",
                prompt: "Build me a lifted truck setup"
              },
              { 
                id: "street",
                title: "STREET", 
                desc: "Low. Fast. Clean.", 
                image: "/images/homepage/vehicle-camaro-street.jpg",
                prompt: "Build me a street performance setup"
              },
              { 
                id: "offroad",
                title: "OFF-ROAD", 
                desc: "Built for adventure.", 
                image: "/images/homepage/vehicle-tacoma-overland.jpg",
                prompt: "Build me an off-road setup"
              },
              { 
                id: "blackout",
                title: "BLACKOUT", 
                desc: "Murdered out perfection.", 
                image: "/images/homepage/vehicle-tahoe-blackout.jpg",
                prompt: "Build me a blackout package"
              },
            ].map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStart(style.prompt);
                }}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden"
              >
                <Image
                  src={style.image}
                  alt={style.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/20 transition-colors" />
                
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h4 className="text-2xl font-black text-white mb-1 group-hover:text-red-400 transition-colors">
                    {style.title}
                  </h4>
                  <p className="text-white/60 text-sm mb-3">{style.desc}</p>
                  <div className="flex items-center gap-2 text-red-500 text-sm font-bold opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <span>Start Build</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          JAKE SECTION - Supporting Guide Role
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#080808] py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            
            {/* Jake */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-4 bg-red-500/10 rounded-full blur-2xl" />
              <div className="relative w-24 h-24 lg:w-28 lg:h-28">
                <Image src="/jake/jake-explaining.png" alt="Jake" fill className="object-contain" />
              </div>
            </div>
            
            <div className="flex-1 text-center lg:text-left">
              <p className="text-red-500 text-xs font-bold uppercase tracking-wider mb-2">Your Build Expert</p>
              <h3 className="text-2xl lg:text-3xl font-black text-white mb-3">
                Not Sure Where to Start?
              </h3>
              <p className="text-white/60 mb-6 max-w-lg">
                Jake knows fitment inside and out. Tell him your vehicle and budget — 
                he'll recommend the perfect wheels, tires, and packages guaranteed to fit.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStart("Help me find the right setup for my truck");
                  }}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all"
                >
                  Ask Jake
                </button>
                <Link 
                  href="/wheels" 
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all border border-white/10"
                >
                  Browse Wheels
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#030303] py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} Warehouse Tire Direct
          </p>
          <div className="flex items-center gap-8 text-sm">
            <Link href="/about" className="text-white/30 hover:text-white/60 transition-colors">About</Link>
            <Link href="/contact" className="text-white/30 hover:text-white/60 transition-colors">Contact</Link>
            <Link href="/shipping" className="text-white/30 hover:text-white/60 transition-colors">Shipping</Link>
            <Link href="/returns" className="text-white/30 hover:text-white/60 transition-colors">Returns</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
