"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Commerce-First Premium Experience
// 
// Goals:
// - Premium wheel & tire ecommerce platform identity
// - Products visible, Jake assists
// - Cinematic but commerce-focused
// - User understands "this is where I shop" in 2-3 seconds
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// Product-focused backgrounds (trucks, wheels, fitment - NOT landscapes)
const HERO_BACKGROUNDS = [
  "/images/homepage/vehicle-ram-aggressive.jpg",
  "/images/homepage/vehicle-silverado-lifted.jpg",
  "/garage/misc-wheel-wall.jpg",
];

// Product-focused category cards
const SHOP_CATEGORIES = [
  {
    id: "wheels",
    title: "SHOP WHEELS",
    desc: "2,000+ styles from top brands",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    prompt: "Show me wheels for my vehicle",
    href: "/wheels",
  },
  {
    id: "tires",
    title: "SHOP TIRES",
    desc: "All-terrain, performance, touring",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    prompt: "Find tires for my vehicle",
    href: "/tires",
  },
  {
    id: "packages",
    title: "WHEEL & TIRE PACKAGES",
    desc: "Mounted, balanced, ready to bolt on",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    prompt: "Build me a wheel and tire package",
    href: "/wheels?package=1",
  },
  {
    id: "lifted",
    title: "LIFTED TRUCK BUILDS",
    desc: "Bigger tires, aggressive stance",
    image: "/garage/card-bg-offroad-overland.jpg",
    prompt: "Build a lifted truck setup",
    href: "/lifted",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & A/T TIRES",
    desc: "BFG, Nitto, Toyo & more",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    prompt: "Show me off-road tires",
    href: "/tires?terrain=all-terrain",
  },
  {
    id: "performance",
    title: "PERFORMANCE & STREET",
    desc: "Staggered fitments available",
    image: "/images/homepage/vehicle-corvette-track.jpg",
    prompt: "Build a performance street setup",
    href: "/wheels?intent=performance",
  },
];

// Popular brands
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
    <div className="min-h-screen flex flex-col bg-[#050505]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION - Product-Focused Background
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[600px] lg:min-h-[650px] flex flex-col">
        
        {/* Background - Trucks/Wheels/Fitment */}
        <div className="absolute inset-0">
          <Image
            src={bgImage}
            alt="Premium wheel and tire setup"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/30" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-xs text-white/50">by Warehouse Tire Direct</p>
            </div>
          </Link>

          {/* Quick Shop Links - Desktop */}
          <nav className="hidden lg:flex items-center gap-6">
            <Link href="/wheels" className="text-sm text-white/70 hover:text-white transition-colors">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/70 hover:text-white transition-colors">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/70 hover:text-white transition-colors">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/70 hover:text-white transition-colors">Lifted Builds</Link>
          </nav>

          {/* Jake Status */}
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
            <div className="relative w-8 h-8 rounded-full overflow-hidden">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <span className="hidden sm:block text-sm text-white/70">Jake Online</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center px-6 lg:px-12">
          <div className="max-w-2xl">
            
            {/* Commerce Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-600/20 border border-red-500/30 rounded-full mb-6">
              <span className="text-red-400 text-sm font-semibold">WHEELS • TIRES • PACKAGES</span>
            </div>

            {/* Main Headline */}
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-4">
              BUILD YOUR<br />
              <span className="text-red-500">PERFECT SETUP</span>
            </h2>

            {/* Commerce-Focused Subtext */}
            <p className="text-lg lg:text-xl text-white/70 mb-6 max-w-lg">
              Shop wheels, tires, and complete packages with <strong className="text-white">AI-powered fitment guidance</strong>. 
              Tell Jake your vehicle — he'll find what fits.
            </p>

            {/* Search Input */}
            <form onSubmit={handleSubmit} className="mb-6">
              <div className={`relative flex items-center bg-white/5 backdrop-blur-xl border-2 rounded-xl overflow-hidden transition-all ${isFocused ? "border-red-500/60 bg-white/10" : "border-white/15"}`}>
                <div className="pl-4 pr-2 text-white/40">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Enter your vehicle or what you're looking for..."
                  className="flex-1 bg-transparent py-4 text-white placeholder-white/40 focus:outline-none"
                />
                <button type="submit" disabled={!input.trim()} className="m-1.5 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-neutral-700 text-white font-bold rounded-lg transition-all">
                  Search
                </button>
              </div>
            </form>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <span className="text-white/40 text-sm py-2">Popular:</span>
              {["Lifted truck wheels", "Quiet SUV tires", "Staggered package"].map((q) => (
                <button key={q} onClick={() => onStart(q)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 hover:text-white text-sm transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trust Bar */}
        <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
              <div className="flex items-center gap-2 text-white/60"><span className="text-green-500">✓</span> Fitment Guaranteed</div>
              <div className="flex items-center gap-2 text-white/60"><span className="text-green-500">✓</span> Free Shipping $199+</div>
              <div className="flex items-center gap-2 text-white/60"><span className="text-green-500">✓</span> Expert Support 7 Days</div>
              <div className="flex items-center gap-2 text-white/60"><span className="text-green-500">✓</span> Top Brands Only</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SHOP BY CATEGORY - Product Cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-bold text-white">Shop by Category</h3>
            <Link href="/wheels" className="text-red-500 hover:text-red-400 text-sm font-semibold">View All →</Link>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {SHOP_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                className="group relative block overflow-hidden rounded-xl bg-neutral-900 aspect-[4/3]"
              >
                <Image src={cat.image} alt={cat.title} fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width: 768px) 50vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/10 transition-colors" />
                
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-white font-bold text-lg uppercase tracking-wide">{cat.title}</h4>
                  <p className="text-white/60 text-sm">{cat.desc}</p>
                  <div className="mt-2 text-red-500 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Shop Now →</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          ASK JAKE SECTION - Positioned as Assistant
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0f0f0f] py-12 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            
            {/* Jake Card */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-4 bg-red-500/10 rounded-full blur-2xl" />
              <div className="relative w-28 h-28 lg:w-32 lg:h-32">
                <Image src="/jake/jake-explaining.png" alt="Jake" fill className="object-contain" />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-red-500 text-sm font-semibold uppercase tracking-wider mb-1">Need Help Choosing?</p>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">Ask Jake — Your Fitment Expert</h3>
              <p className="text-white/60 mb-4 max-w-lg">
                Not sure what fits? Jake knows every bolt pattern, offset, and tire size. 
                Tell him your vehicle and he'll recommend the perfect wheels, tires, or packages.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <button onClick={() => onStart("Help me find wheels for my truck")} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-all">
                  Ask Jake Now
                </button>
                <button onClick={() => onStart("What tires do you recommend?")} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-all border border-white/10">
                  Get Recommendations
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          POPULAR BRANDS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Wheel Brands */}
            <div>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Popular Wheel Brands</h4>
              <div className="flex flex-wrap gap-2">
                {WHEEL_BRANDS.map((brand) => (
                  <Link key={brand.name} href={brand.href} className="px-4 py-2 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 rounded-lg text-white/80 hover:text-white text-sm font-medium transition-all">
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
            
            {/* Tire Brands */}
            <div>
              <h4 className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-4">Popular Tire Brands</h4>
              <div className="flex flex-wrap gap-2">
                {TIRE_BRANDS.map((brand) => (
                  <Link key={brand.name} href={brand.href} className="px-4 py-2 bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 rounded-lg text-white/80 hover:text-white text-sm font-medium transition-all">
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-neutral-950 py-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm">
            © {new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/about" className="text-white/40 hover:text-white/70">About</Link>
            <Link href="/contact" className="text-white/40 hover:text-white/70">Contact</Link>
            <Link href="/shipping" className="text-white/40 hover:text-white/70">Shipping</Link>
            <Link href="/returns" className="text-white/40 hover:text-white/70">Returns</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
