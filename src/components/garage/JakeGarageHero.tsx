"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic AI Build Command Center
// 
// Philosophy:
// - Jake interaction is THE CENTERPIECE
// - Large, immersive command-center feel
// - Cinematic depth with glows and layering
// - Vehicle imagery flanks the center
// - "Walk into Jake's garage" experience
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// Build categories for quick-start grid
const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE STREET",
    desc: "Bold stance. Head turning.",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    icon: "🔥",
    prompt: "Build me an aggressive street setup",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride. Low road noise.",
    image: "/images/homepage/vehicle-tahoe-blackout.jpg",
    icon: "🔇",
    prompt: "Build me a quiet comfortable setup",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean, and mean.",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    icon: "⚫",
    prompt: "Build me a blackout package",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong. Tow with confidence.",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    icon: "🚛",
    prompt: "Build me a towing setup",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther. Explore more.",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    icon: "🏔️",
    prompt: "Build me an off-road overland setup",
  },
  {
    id: "show",
    title: "SHOW & STANCE",
    desc: "For the weekend warriors.",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    icon: "⭐",
    prompt: "Build me a show truck setup",
  },
];

export function JakeGarageHero({ onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onStart(input.trim());
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#030303]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO - Cinematic Command Center
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        
        {/* Background - Dark garage atmosphere */}
        <div className="absolute inset-0">
          {/* Base garage image */}
          <div className="absolute inset-0 bg-[url('/images/homepage/garage-dark-bg.jpg')] bg-cover bg-center opacity-40" />
          
          {/* Vehicle on left */}
          <div className="absolute left-0 top-0 bottom-0 w-1/3 lg:w-2/5">
            <Image
              src="/images/homepage/vehicle-ram-aggressive.jpg"
              alt="Featured Vehicle"
              fill
              className="object-cover object-right opacity-60"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#030303]/80 to-[#030303]" />
          </div>
          
          {/* Jake on right */}
          <div className="absolute right-0 top-0 bottom-0 w-1/4 lg:w-1/3 hidden lg:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[400px] h-[500px]">
                <Image
                  src="/jake/jake-explaining.png"
                  alt="Jake"
                  fill
                  className="object-contain object-bottom"
                  priority
                />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#030303]/60 to-[#030303]" />
          </div>
          
          {/* Center gradient vignette */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#030303]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#030303_80%)]" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/50 group-hover:ring-red-500 transition-all shadow-lg shadow-red-500/20">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Powered by Warehouse Tire Direct</p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/wheels" className="text-sm text-white/60 hover:text-white transition-colors">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/60 hover:text-white transition-colors">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/60 hover:text-white transition-colors">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/60 hover:text-white transition-colors">Lifted</Link>
          </nav>

          {/* Jake Status - Top right */}
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
            <div className="relative w-8 h-8 rounded-full overflow-hidden">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white text-sm font-semibold">Jake is online</p>
              <p className="text-white/50 text-[10px]">Ready to build your setup</p>
            </div>
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════
            CENTRAL COMMAND - The Focal Point
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 lg:px-12 py-12">
          
          {/* Glow effects behind center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[400px] bg-red-600/10 rounded-full blur-[120px]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[400px] h-[200px] bg-red-500/15 rounded-full blur-[80px] translate-y-10" />
          </div>
          
          {/* Central Content */}
          <div className="relative max-w-4xl w-full text-center">
            
            {/* Neon "BUILT DIFFERENT" badge */}
            <div className="inline-block mb-6">
              <div className="relative px-6 py-2 rounded-lg border-2 border-red-500/60 bg-black/60 backdrop-blur-sm">
                {/* Neon glow */}
                <div className="absolute inset-0 rounded-lg bg-red-500/20 blur-md" />
                <div className="absolute inset-0 rounded-lg shadow-[0_0_30px_rgba(239,68,68,0.4)]" />
                <span className="relative text-red-500 text-sm lg:text-base font-black tracking-[0.3em] uppercase">
                  Built Different
                </span>
              </div>
            </div>
            
            {/* Main headline - MASSIVE */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[0.95] tracking-tight mb-6">
              WHAT ARE WE<br />
              <span className="text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]">BUILDING TODAY?</span>
            </h2>
            
            {/* Subheadline */}
            <p className="text-lg lg:text-xl text-white/60 mb-10 max-w-xl mx-auto">
              Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
              He'll handle the rest.
            </p>
            
            {/* ═══════════════════════════════════════════════════════════════
                LARGE CENTERED INPUT - The Primary Action
            ═══════════════════════════════════════════════════════════════ */}
            <form onSubmit={handleSubmit} className="relative mb-8">
              {/* Glow behind input */}
              <div className={`absolute -inset-2 rounded-2xl transition-all duration-500 ${
                isFocused 
                  ? "bg-red-500/20 blur-xl" 
                  : "bg-white/5 blur-lg"
              }`} />
              
              <div className={`relative flex items-center bg-black/70 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
                isFocused 
                  ? "border-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.3)]" 
                  : "border-white/20 hover:border-white/30"
              }`}>
                {/* Chat icon */}
                <div className="pl-5 pr-2">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Tell Jake what you drive or what look you want..."
                  className="flex-1 bg-transparent px-4 py-5 lg:py-6 text-lg lg:text-xl text-white placeholder-white/40 focus:outline-none"
                />
                
                <button 
                  type="submit" 
                  disabled={!input.trim()} 
                  className="m-2 px-8 py-4 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold text-lg rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 hover:shadow-red-500/40"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
            
            {/* Helper text */}
            <p className="text-white/40 text-sm mb-4">Not sure where to start? Try one of these:</p>
            
            {/* Quick prompts - chevron below */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { text: "2024 Ford F-150", icon: "🚙" },
                { text: "Lifted truck build", icon: "🔺" },
                { text: "Quiet highway tires", icon: "🔇" },
                { text: "Aggressive street look", icon: "🔥" },
              ].map((q) => (
                <button
                  key={q.text}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStart(q.text);
                  }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white/70 hover:text-white transition-all flex items-center gap-2"
                >
                  <span>{q.icon}</span>
                  <span>{q.text}</span>
                </button>
              ))}
            </div>
            
            {/* Scroll indicator */}
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD CATEGORIES GRID - Quick Start Options
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#030303] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          {/* Grid of category cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStart(cat.prompt);
                }}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900"
              >
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover opacity-60 group-hover:opacity-80 transition-all duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                {/* Icon badge */}
                <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center text-lg border border-white/10">
                  {cat.icon}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h4 className="text-sm lg:text-base font-black text-white mb-1 group-hover:text-red-400 transition-colors leading-tight">
                    {cat.title}
                  </h4>
                  <p className="text-white/50 text-xs">{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#050505] py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">100% FITMENT GUARANTEE</p>
                <p className="text-white/40 text-xs">We double check everything</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">FAST, FREE SHIPPING</p>
                <p className="text-white/40 text-xs">To your door or local shop</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">TOP BRANDS ONLY</p>
                <p className="text-white/40 text-xs">Quality you can trust</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm">EXPERT SUPPORT</p>
                <p className="text-white/40 text-xs">Jake's got your back</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAGLINE BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-2xl lg:text-3xl font-black">
            <span className="text-red-500">REAL</span> <span className="text-white">PEOPLE.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">EXPERTS.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">RESULTS.</span>
          </h3>
          <p className="text-white/40 text-sm mt-3">
            Secure checkout powered by <span className="text-white font-semibold">WAREHOUSE TIRE DIRECT</span>
          </p>
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
