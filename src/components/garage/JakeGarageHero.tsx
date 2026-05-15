"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic Commerce Experience
// 
// Identity:
// - Premium, immersive, emotionally engaging
// - Jake is the central figure - your build expert
// - Cinematic atmosphere with commerce integrated naturally
// - NOT a generic ecommerce template
// - Hero DOMINATES the page
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// Cinematic backgrounds - dramatic vehicle shots
const HERO_BACKGROUNDS = [
  "/images/homepage/vehicle-ram-aggressive.jpg",
  "/images/homepage/vehicle-silverado-lifted.jpg",
  "/garage/misc-wheel-wall.jpg",
];

// Build paths - NOT shopping categories, but lifestyle/build directions
const BUILD_PATHS = [
  {
    id: "lifted",
    title: "LIFTED BUILDS",
    subtitle: "Go bigger. Stand out.",
    image: "/garage/card-bg-offroad-overland.jpg",
    prompt: "Build me a lifted truck setup",
    href: "/lifted",
  },
  {
    id: "street",
    title: "STREET PERFORMANCE",
    subtitle: "Low. Fast. Clean.",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    prompt: "Build a performance street setup",
    href: "/wheels?intent=performance",
  },
  {
    id: "overland",
    title: "OVERLAND & OFF-ROAD",
    subtitle: "Built for adventure.",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    prompt: "Build an overland setup",
    href: "/tires?terrain=all-terrain",
  },
];

// Popular brands (shown lower on page)
const WHEEL_BRANDS = [
  { name: "Fuel", href: "/wheels?brand=fuel" },
  { name: "Method", href: "/wheels?brand=method" },
  { name: "Rotiform", href: "/wheels?brand=rotiform" },
  { name: "Black Rhino", href: "/wheels?brand=black-rhino" },
  { name: "Vossen", href: "/wheels?brand=vossen" },
  { name: "American Force", href: "/wheels?brand=american-force" },
];

const TIRE_BRANDS = [
  { name: "BFGoodrich", href: "/tires?brand=bfgoodrich" },
  { name: "Nitto", href: "/tires?brand=nitto" },
  { name: "Toyo", href: "/tires?brand=toyo" },
  { name: "Falken", href: "/tires?brand=falken" },
  { name: "Mickey Thompson", href: "/tires?brand=mickey-thompson" },
  { name: "Cooper", href: "/tires?brand=cooper" },
];

export function JakeGarageHero({ onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [bgImage, setBgImage] = useState(HERO_BACKGROUNDS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setBgImage(HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)]);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onStart(input.trim());
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030303]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          CINEMATIC HERO - Full viewport, immersive, Jake-centered
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col">
        
        {/* Cinematic Background */}
        <div className="absolute inset-0">
          <Image
            src={bgImage}
            alt="Premium wheel and tire setup"
            fill
            className="object-cover scale-105"
            priority
          />
          {/* Dramatic gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-[#030303]" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
        </div>

        {/* Subtle atmospheric particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-red-600/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Header - Minimal, floating */}
        <header className="relative z-20 flex items-center justify-between px-8 lg:px-16 py-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/50 group-hover:ring-red-500 transition-all shadow-lg shadow-red-900/30">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-xs text-white/40 tracking-wide">by Warehouse Tire Direct</p>
            </div>
          </Link>

          {/* Navigation - Desktop only, subtle */}
          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/wheels" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Lifted</Link>
          </nav>

          {/* Jake Status - Prominent */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xl rounded-full px-4 py-2 border border-white/10">
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-green-500/50">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white">Jake</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Online
              </p>
            </div>
          </div>
        </header>

        {/* Hero Content - Centered, dominant */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 lg:px-16 pb-24">
          
          {/* Jake Avatar - Central figure */}
          <div className="relative mb-8">
            <div className="absolute -inset-8 bg-red-500/20 rounded-full blur-3xl" />
            <div className="absolute -inset-4 bg-red-600/10 rounded-full blur-xl animate-pulse" />
            <div className="relative w-32 h-32 lg:w-40 lg:h-40">
              <Image 
                src="/jake/jake-explaining.png" 
                alt="Jake - Your Build Expert" 
                fill 
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Main Headline */}
          <div className="text-center max-w-4xl">
            <p className="text-red-500 text-sm lg:text-base font-semibold uppercase tracking-[0.2em] mb-4">
              Your Build Expert
            </p>
            
            <h2 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tight mb-6">
              LET'S BUILD<br />
              <span className="bg-gradient-to-r from-red-500 via-red-400 to-red-500 bg-clip-text text-transparent">
                SOMETHING SICK
              </span>
            </h2>

            <p className="text-lg lg:text-xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              Tell me what you drive. I'll help you find the perfect wheels, tires, or complete package — 
              <span className="text-white/80"> guaranteed to fit.</span>
            </p>

            {/* Search Input - Premium styled */}
            <form onSubmit={handleSubmit} className="mb-8 max-w-2xl mx-auto">
              <div className={`relative flex items-center bg-black/50 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${isFocused ? "border-red-500/80 bg-black/70 shadow-lg shadow-red-500/20" : "border-white/10 hover:border-white/20"}`}>
                <div className="pl-6 pr-3 text-white/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Tell Jake your vehicle or what you're building..."
                  className="flex-1 bg-transparent py-5 text-lg text-white placeholder-white/30 focus:outline-none"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim()} 
                  className="m-2 px-8 py-3 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-red-900/30 hover:shadow-red-500/40"
                >
                  Start Build
                </button>
              </div>
            </form>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-3 justify-center">
              {["2024 F-150 wheel package", "Lifted Silverado tires", "Mustang staggered setup"].map((q) => (
                <button 
                  key={q} 
                  onClick={() => onStart(q)} 
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/60 hover:text-white text-sm transition-all duration-200"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="flex flex-col items-center gap-2 text-white/30">
            <span className="text-xs uppercase tracking-widest">Explore</span>
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD PATHS - Immersive lifestyle cards, NOT ecommerce grid
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#030303] py-24 overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303] via-[#080808] to-[#030303]" />
        
        <div className="relative max-w-7xl mx-auto px-8 lg:px-16">
          <div className="text-center mb-16">
            <p className="text-red-500/80 text-sm font-semibold uppercase tracking-[0.2em] mb-3">Choose Your Path</p>
            <h3 className="text-3xl lg:text-4xl font-black text-white">What Are You Building?</h3>
          </div>
          
          {/* Immersive cards - larger, more cinematic */}
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {BUILD_PATHS.map((path) => (
              <button
                key={path.id}
                onClick={() => onStart(path.prompt)}
                className="group relative block overflow-hidden rounded-2xl bg-neutral-900 aspect-[3/4] text-left"
              >
                <Image 
                  src={path.image} 
                  alt={path.title} 
                  fill 
                  className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110" 
                  sizes="(max-width: 768px) 100vw, 33vw" 
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80 group-hover:opacity-70 transition-opacity" />
                {/* Red accent on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-red-600/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-8">
                  <h4 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-wide mb-2 group-hover:text-red-400 transition-colors">
                    {path.title}
                  </h4>
                  <p className="text-white/60 text-lg mb-4">{path.subtitle}</p>
                  <div className="flex items-center gap-2 text-red-500 font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <span>Start this build</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Secondary options */}
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/wheels" className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white font-medium transition-all">
              Browse All Wheels
            </Link>
            <Link href="/tires" className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white font-medium transition-all">
              Browse All Tires
            </Link>
            <Link href="/wheels?package=1" className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/70 hover:text-white font-medium transition-all">
              Complete Packages
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST & COMMERCE - Lower on page, integrated
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-8 lg:px-16">
          
          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16 mb-16">
            <div className="flex items-center gap-3 text-white/50">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Fitment Guaranteed</span>
            </div>
            <div className="flex items-center gap-3 text-white/50">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <span>Free Shipping $199+</span>
            </div>
            <div className="flex items-center gap-3 text-white/50">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span>Expert Support</span>
            </div>
          </div>

          {/* Brands */}
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h4 className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mb-6">Popular Wheel Brands</h4>
              <div className="flex flex-wrap gap-3">
                {WHEEL_BRANDS.map((brand) => (
                  <Link 
                    key={brand.name} 
                    href={brand.href} 
                    className="px-5 py-2.5 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 rounded-lg text-white/70 hover:text-white text-sm font-medium transition-all"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white/30 text-xs font-semibold uppercase tracking-[0.2em] mb-6">Popular Tire Brands</h4>
              <div className="flex flex-wrap gap-3">
                {TIRE_BRANDS.map((brand) => (
                  <Link 
                    key={brand.name} 
                    href={brand.href} 
                    className="px-5 py-2.5 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 rounded-lg text-white/70 hover:text-white text-sm font-medium transition-all"
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER - Minimal
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#030303] py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-8 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4">
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
