"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic Build Command Center
// 
// EXACT MOCKUP RECREATION - 5 Zone Composition:
// [ LEFT TRUST ] [ LEFT VEHICLE ] [ CENTER COMMAND ] [ RIGHT JAKE ] [ RIGHT TRUST ]
//
// This layout creates a triangular composition:
// - Truck on left
// - Jake on right  
// - Command center in middle
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

// Left trust column items
const LEFT_TRUST = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "NO PRESSURE SALES",
    desc: "Honest advice.\nZero pushy upsells.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "REAL GUIDED HELP",
    desc: "Talk to Jake.\nGet real answers.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "NEVER GUESS SETUP",
    desc: "100% fitment focus.\nAlways double-checked.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: "40+ YEARS\nOF EXPERIENCE",
    desc: "Real builds. Real world.\nReal results.",
  },
];

// Right trust column items
const RIGHT_TRUST = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "BUILT BY\nENTHUSIASTS",
    desc: "We build what\nwe recommend.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "FITMENT FIRST",
    desc: "Wheels, tires,\nand packages that actually fit.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "THOUSANDS\nOF BUILDS",
    desc: "Proven setups.\nHappy customers.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "SECURE & SIMPLE",
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
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HERO - Cinematic 5-Zone Composition
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col overflow-hidden">
        
        {/* ═══════════════════════════════════════════════════════════════════
            BACKGROUND LAYERS
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="absolute inset-0">
          {/* Base dark gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0f0f0f] to-[#0a0a0a]" />
          
          {/* Subtle wheel wall texture - very faint */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: "url('/images/homepage/misc-wheel-wall.jpg')" }}
          />
          
          {/* Left Vehicle Zone - RAM/TRX style truck */}
          <div className="absolute left-0 top-0 bottom-0 w-[45%] hidden lg:block">
            <Image
              src="/images/homepage/vehicle-ram-aggressive.jpg"
              alt="Featured Vehicle"
              fill
              className="object-cover object-right opacity-70"
              priority
            />
            {/* Fade into center */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0a0a0a]/70 to-[#0a0a0a]" />
            {/* Top fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/60 via-transparent to-[#0a0a0a]/80" />
          </div>
          
          {/* Right Jake Zone */}
          <div className="absolute right-0 top-0 bottom-0 w-[35%] hidden lg:block">
            <div className="absolute inset-0 flex items-center justify-end pr-4">
              <div className="relative w-[380px] h-[520px]">
                <Image
                  src="/jake/jake-explaining.png"
                  alt="Jake"
                  fill
                  className="object-contain object-bottom"
                  priority
                />
              </div>
            </div>
            {/* Fade into center */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]" />
          </div>
          
          {/* Center red glow */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[800px] h-[500px] bg-red-600/8 rounded-full blur-[150px]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[300px] bg-red-500/12 rounded-full blur-[100px] translate-y-8" />
          </div>
          
          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0a0a_85%)]" />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════════ */}
        <header className="relative z-20 flex items-center justify-between px-6 lg:px-10 py-5">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-red-500/50 group-hover:ring-red-500 transition-all shadow-lg shadow-red-500/20">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Jake <span className="text-red-500">Garage</span></h1>
              <p className="text-[9px] text-white/40 uppercase tracking-[0.2em]">Powered by Warehouse Tire Direct</p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-10">
            <Link href="/wheels" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Lifted</Link>
          </nav>

          {/* Jake Online Badge - Top right */}
          <div className="flex items-center gap-2.5 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
            <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/20">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm font-semibold">Jake is online</p>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              </div>
              <p className="text-white/40 text-[10px]">Ready to build your setup</p>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN CONTENT - 5 Zone Layout
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex">
          
          {/* ═══════════════════════════════════════════════════════════════
              LEFT TRUST COLUMN - Ambient overlays
          ═══════════════════════════════════════════════════════════════ */}
          <div className="hidden xl:flex flex-col justify-center w-52 pl-8 pr-4 py-20">
            <div className="space-y-10">
              {LEFT_TRUST.map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-white text-xs font-bold tracking-wide leading-tight whitespace-pre-line">
                        {item.title}
                      </h4>
                      <p className="text-white/40 text-[10px] mt-1 leading-snug whitespace-pre-line">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  {/* Red accent line */}
                  <div className="mt-3 ml-11 w-8 h-[2px] bg-gradient-to-r from-red-500/40 to-transparent" />
                </div>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              CENTER COMMAND ZONE - Primary Focus
          ═══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 py-8">
            <div className="relative max-w-2xl w-full text-center">
              
              {/* BUILT DIFFERENT badge */}
              <div className="inline-block mb-5">
                <div className="relative px-5 py-1.5 rounded border-2 border-red-500/70 bg-red-500/10">
                  {/* Neon glow */}
                  <div className="absolute inset-0 rounded bg-red-500/20 blur-md" />
                  <div className="absolute inset-0 rounded shadow-[0_0_25px_rgba(239,68,68,0.35)]" />
                  <span className="relative text-red-500 text-xs font-black tracking-[0.35em] uppercase">
                    Built Different
                  </span>
                </div>
              </div>
              
              {/* Main headline - MASSIVE */}
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[0.9] tracking-tight mb-5">
                WHAT ARE WE<br />
                <span className="text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.5)]">BUILDING TODAY?</span>
              </h2>
              
              {/* Subheadline */}
              <p className="text-base lg:text-lg text-white/50 mb-8 max-w-md mx-auto">
                Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
                He'll handle the rest.
              </p>
              
              {/* ═══════════════════════════════════════════════════════════
                  LARGE COMMAND INPUT
              ═══════════════════════════════════════════════════════════ */}
              <form onSubmit={handleSubmit} className="relative mb-6">
                {/* Outer glow */}
                <div className={`absolute -inset-1 rounded-2xl transition-all duration-500 ${
                  isFocused 
                    ? "bg-red-500/30 blur-xl" 
                    : "bg-red-500/10 blur-lg"
                }`} />
                
                <div className={`relative flex items-center bg-black/80 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
                  isFocused 
                    ? "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]" 
                    : "border-red-500/40 hover:border-red-500/60"
                }`}>
                  {/* Chat icon */}
                  <div className="pl-5 pr-2">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="flex-1 bg-transparent px-3 py-4 lg:py-5 text-base lg:text-lg text-white placeholder-white/35 focus:outline-none"
                  />
                  
                  <button 
                    type="submit" 
                    disabled={!input.trim()} 
                    className="m-2 w-12 h-12 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl transition-all flex items-center justify-center shadow-lg shadow-red-600/30"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              
              {/* Helper text + arrow */}
              <p className="text-white/40 text-sm mb-3">Not sure where to start? Try one of these:</p>
              <div className="mb-4">
                <svg className="w-4 h-4 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              RIGHT TRUST COLUMN - Ambient overlays
          ═══════════════════════════════════════════════════════════════ */}
          <div className="hidden xl:flex flex-col justify-center w-52 pr-8 pl-4 py-20">
            <div className="space-y-10">
              {RIGHT_TRUST.map((item, idx) => (
                <div key={idx} className="group text-right">
                  <div className="flex items-start gap-3 justify-end">
                    <div>
                      <h4 className="text-white text-xs font-bold tracking-wide leading-tight whitespace-pre-line">
                        {item.title}
                      </h4>
                      <p className="text-white/40 text-[10px] mt-1 leading-snug whitespace-pre-line">
                        {item.desc}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0">
                      {item.icon}
                    </div>
                  </div>
                  {/* Red accent line */}
                  <div className="mt-3 mr-11 ml-auto w-8 h-[2px] bg-gradient-to-l from-red-500/40 to-transparent" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD CATEGORIES GRID
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#0a0a0a] pb-12 -mt-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          
          {/* Grid of category cards */}
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
                  className="object-cover opacity-50 group-hover:opacity-70 transition-all duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                
                {/* Icon badge */}
                <div className={`absolute bottom-14 left-1/2 -translate-x-1/2 w-10 h-10 rounded-xl bg-black/70 backdrop-blur-sm flex items-center justify-center text-lg border border-white/10 ${cat.iconColor}`}>
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
      <section className="bg-[#080808] py-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">100% FITMENT GUARANTEE</p>
                <p className="text-white/35 text-[10px]">We double check everything</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">FAST, FREE SHIPPING $199+</p>
                <p className="text-white/35 text-[10px]">To your door or local shop</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">TOP BRANDS ONLY</p>
                <p className="text-white/35 text-[10px]">Quality you can trust</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide">EXPERT SUPPORT</p>
                <p className="text-white/35 text-[10px]">Jake's got your back</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAGLINE BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] py-8 border-t border-white/5">
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
      <footer className="bg-[#080808] py-6 border-t border-white/5">
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
