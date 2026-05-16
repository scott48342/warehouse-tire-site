"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic Build Command Center
// 
// HIERARCHY (Critical):
// 1. MASSIVE headline (dominates)
// 2. HUGE glowing command input
// 3. Jake presence (large, cinematic anchor)
// 4. Truck/build atmosphere (left anchor)
// 5. Trust messaging (ambient, readable)
// 6. Build categories
//
// The CENTER must emotionally dominate the page.
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts?: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// Build categories for quick-start grid
const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE STREET",
    desc: "Bold stance.\nHead turning style.",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    icon: "🔥",
    iconColor: "text-red-500",
    prompt: "Build me an aggressive street setup",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride.\nLow road noise.",
    image: "/images/homepage/vehicle-tahoe-blackout.jpg",
    icon: "🔇",
    iconColor: "text-gray-400",
    prompt: "Build me a quiet comfortable setup",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean,\nand mean.",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    icon: "⚫",
    iconColor: "text-gray-300",
    prompt: "Build me a blackout package",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong.\nTow with confidence.",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    icon: "📦",
    iconColor: "text-red-400",
    prompt: "Build me a towing setup",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther.\nExplore more.",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    icon: "🏔️",
    iconColor: "text-green-500",
    prompt: "Build me an off-road overland setup",
  },
  {
    id: "show",
    title: "SHOW & STANCE",
    desc: "For the weekend\nwarriors.",
    image: "/images/homepage/vehicle-corvette-track.jpg",
    icon: "⭐",
    iconColor: "text-purple-500",
    prompt: "Build me a show truck setup",
  },
];

// Left trust column items - LARGER text
const LEFT_TRUST = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "NO PRESSURE\nSALES",
    desc: "Honest advice.\nZero pushy upsells.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "REAL GUIDED\nHELP",
    desc: "Talk to Jake.\nGet real answers.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "NEVER GUESS\nSETUP",
    desc: "100% fitment focus.\nAlways double-checked.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: "40+ YEARS\nEXPERIENCE",
    desc: "Real builds. Real world.\nReal results.",
  },
];

// Right trust column items - LARGER text
const RIGHT_TRUST = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "BUILT BY\nENTHUSIASTS",
    desc: "We build what\nwe recommend.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "FITMENT\nFIRST",
    desc: "Wheels, tires, packages\nthat actually fit.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "THOUSANDS\nOF BUILDS",
    desc: "Proven setups.\nHappy customers.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "SECURE\n& SIMPLE",
    desc: "Safe checkout.\nFast, reliable shipping.",
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
    <div className="min-h-screen flex flex-col bg-[#050505]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO - Cinematic Command Center (FULL HEIGHT)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[100vh] flex flex-col overflow-hidden">
        
        {/* ═══════════════════════════════════════════════════════════════════
            BACKGROUND LAYERS - Darker, more focused
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="absolute inset-0">
          {/* Base dark */}
          <div className="absolute inset-0 bg-[#030303]" />
          
          {/* Subtle wheel wall texture - very faint */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-[0.05]"
            style={{ backgroundImage: "url('/images/homepage/misc-wheel-wall.jpg')" }}
          />
          
          {/* Left Vehicle Zone - RAM/TRX - LARGER, more dramatic */}
          <div className="absolute left-0 top-0 bottom-0 w-[50%] hidden lg:block">
            <Image
              src="/images/homepage/vehicle-ram-aggressive.jpg"
              alt="Featured Vehicle"
              fill
              className="object-cover object-right opacity-60 scale-110"
              style={{ objectPosition: "70% center" }}
              priority
            />
            {/* Heavy fade into center */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#030303]/80 to-[#030303]" />
            {/* Top/bottom fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/70 via-transparent to-[#030303]/90" />
          </div>
          
          {/* Right Jake Zone - MUCH LARGER, moved inward */}
          <div className="absolute right-0 top-0 bottom-0 w-[45%] hidden lg:block">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Jake - 50% BIGGER, more centered */}
              <div className="relative w-[550px] h-[700px] translate-x-8">
                <Image
                  src="/jake/jake-explaining.png"
                  alt="Jake"
                  fill
                  className="object-contain object-bottom drop-shadow-[0_0_60px_rgba(239,68,68,0.15)]"
                  priority
                />
              </div>
            </div>
            {/* Fade into center */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#030303]/60 to-[#030303]" />
          </div>
          
          {/* CENTER GLOW - MUCH STRONGER */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[1000px] h-[700px] bg-red-600/10 rounded-full blur-[180px]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[400px] bg-red-500/15 rounded-full blur-[120px] translate-y-12" />
          </div>
          {/* Extra glow behind input area */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[200px] bg-red-600/20 rounded-full blur-[80px] translate-y-24" />
          </div>
          
          {/* HEAVY Vignette - force eye to center */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#030303_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#000000_100%)] opacity-60" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════════ */}
        <header className="relative z-20 flex items-center justify-between px-8 lg:px-12 py-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/50 group-hover:ring-red-500 transition-all shadow-lg shadow-red-500/20">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Powered by Warehouse Tire Direct</p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-12">
            <Link href="/wheels" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Lifted</Link>
          </nav>

          {/* Jake Online Badge */}
          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-full px-5 py-2.5 border border-white/10">
            <div className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/20">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-bold">Jake is online</p>
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              </div>
              <p className="text-white/40 text-[10px]">Ready to build your setup</p>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN CONTENT - 5 Zone Layout with EPIC scale
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex">
          
          {/* ═══════════════════════════════════════════════════════════════
              LEFT TRUST COLUMN - LARGER, more readable
          ═══════════════════════════════════════════════════════════════ */}
          <div className="hidden xl:flex flex-col justify-center w-64 pl-10 pr-6 py-16">
            <div className="space-y-12">
              {LEFT_TRUST.map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0 shadow-lg shadow-red-500/10">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-black tracking-wide leading-tight whitespace-pre-line uppercase">
                        {item.title}
                      </h4>
                      <p className="text-white/50 text-xs mt-1.5 leading-relaxed whitespace-pre-line">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  {/* Red accent line */}
                  <div className="mt-4 ml-[60px] w-10 h-[2px] bg-gradient-to-r from-red-500/50 to-transparent" />
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              CENTER COMMAND ZONE - MASSIVE, Dominant
          ═══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-8 py-8">
            <div className="relative max-w-3xl w-full text-center">
              
              {/* BUILT DIFFERENT badge - tighter to headline */}
              <div className="inline-block mb-4">
                <div className="relative px-6 py-2 rounded border-2 border-red-500/80 bg-red-500/15">
                  {/* Neon glow */}
                  <div className="absolute inset-0 rounded bg-red-500/30 blur-lg" />
                  <div className="absolute inset-0 rounded shadow-[0_0_40px_rgba(239,68,68,0.5)]" />
                  <span className="relative text-red-500 text-sm font-black tracking-[0.4em] uppercase">
                    Built Different
                  </span>
                </div>
              </div>
              
              {/* Main headline - MASSIVE (30% bigger) */}
              <h2 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.85] tracking-tight mb-4">
                WHAT ARE WE<br />
                <span className="text-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,0.6)] drop-shadow-[0_0_120px_rgba(239,68,68,0.3)]">
                  BUILDING TODAY?
                </span>
              </h2>
              
              {/* Subheadline - tighter */}
              <p className="text-lg lg:text-xl text-white/50 mb-8 max-w-lg mx-auto leading-relaxed">
                Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
                He'll handle the rest.
              </p>
              
              {/* ═══════════════════════════════════════════════════════════
                  HUGE COMMAND INPUT - Cinematic, unavoidable
              ═══════════════════════════════════════════════════════════ */}
              <form onSubmit={handleSubmit} className="relative mb-6">
                {/* STRONG outer glow */}
                <div className={`absolute -inset-3 rounded-3xl transition-all duration-500 ${
                  isFocused 
                    ? "bg-red-500/40 blur-2xl" 
                    : "bg-red-500/20 blur-xl"
                }`} />
                
                {/* Secondary glow layer */}
                <div className={`absolute -inset-1 rounded-2xl transition-all duration-500 ${
                  isFocused 
                    ? "bg-red-500/30 blur-md" 
                    : "bg-red-500/10 blur-sm"
                }`} />
                
                <div className={`relative flex items-center bg-black/90 backdrop-blur-xl border-[3px] rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl ${
                  isFocused 
                    ? "border-red-500 shadow-[0_0_80px_rgba(239,68,68,0.5),inset_0_0_30px_rgba(239,68,68,0.1)]" 
                    : "border-red-500/50 hover:border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                }`}>
                  {/* Chat icon - larger */}
                  <div className="pl-6 pr-3">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="flex-1 bg-transparent px-4 py-6 lg:py-7 text-lg lg:text-xl text-white placeholder-white/35 focus:outline-none"
                  />
                  
                  <button 
                    type="submit" 
                    disabled={!input.trim()} 
                    className="m-3 w-14 h-14 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl transition-all flex items-center justify-center shadow-xl shadow-red-600/40 hover:shadow-red-500/50"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              
              {/* Helper text + arrow - tighter */}
              <p className="text-white/40 text-sm mb-2">Not sure where to start? Try one of these:</p>
              <div className="mb-4">
                <svg className="w-5 h-5 text-red-500 mx-auto animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT TRUST COLUMN - LARGER, more readable
          ═══════════════════════════════════════════════════════════════ */}
          <div className="hidden xl:flex flex-col justify-center w-64 pr-10 pl-6 py-16">
            <div className="space-y-12">
              {RIGHT_TRUST.map((item, idx) => (
                <div key={idx} className="group text-right">
                  <div className="flex items-start gap-4 justify-end">
                    <div>
                      <h4 className="text-white text-sm font-black tracking-wide leading-tight whitespace-pre-line uppercase">
                        {item.title}
                      </h4>
                      <p className="text-white/50 text-xs mt-1.5 leading-relaxed whitespace-pre-line">
                        {item.desc}
                      </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0 shadow-lg shadow-red-500/10">
                      {item.icon}
                    </div>
                  </div>
                  {/* Red accent line */}
                  <div className="mt-4 mr-[60px] ml-auto w-10 h-[2px] bg-gradient-to-l from-red-500/50 to-transparent" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD CATEGORIES GRID
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] pb-12 -mt-12 pt-4">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          
          {/* Grid of category cards - slightly smaller to not compete */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onStart(cat.prompt);
                }}
                className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-900 border border-white/5 hover:border-red-500/30 transition-all"
              >
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover opacity-40 group-hover:opacity-60 transition-all duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
                
                {/* Icon badge */}
                <div className={`absolute bottom-14 left-1/2 -translate-x-1/2 w-10 h-10 rounded-xl bg-black/80 backdrop-blur-sm flex items-center justify-center text-lg border border-white/10 ${cat.iconColor}`}>
                  {cat.icon}
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
                  <h4 className="text-[11px] lg:text-xs font-black text-white mb-0.5 group-hover:text-red-400 transition-colors leading-tight tracking-wide">
                    {cat.title}
                  </h4>
                  <p className="text-white/40 text-[9px] lg:text-[10px] whitespace-pre-line leading-snug">{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">100% FITMENT GUARANTEE</p>
                <p className="text-white/40 text-[10px]">We double check everything</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">FAST, FREE SHIPPING $199+</p>
                <p className="text-white/40 text-[10px]">To your door or local shop</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">TOP BRANDS ONLY</p>
                <p className="text-white/40 text-[10px]">Quality you can trust</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">EXPERT SUPPORT</p>
                <p className="text-white/40 text-[10px]">Jake's got your back</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAGLINE BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#050505] py-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-xl lg:text-2xl font-black tracking-wide">
            <span className="text-red-500">REAL</span> <span className="text-white">PEOPLE.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">EXPERTS.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">RESULTS.</span>
          </h3>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#030303] py-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Warehouse Tire Direct • Secure checkout powered by Stripe
          </p>
          <div className="flex items-center gap-6 text-xs">
            <Link href="/about" className="text-white/25 hover:text-white/50 transition-colors">About</Link>
            <Link href="/contact" className="text-white/25 hover:text-white/50 transition-colors">Contact</Link>
            <Link href="/shipping" className="text-white/25 hover:text-white/50 transition-colors">Shipping</Link>
            <Link href="/returns" className="text-white/25 hover:text-white/50 transition-colors">Returns</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
