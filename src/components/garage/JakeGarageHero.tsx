"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HOMEPAGE - Complete Cinematic Build Experience
// 
// Page Structure:
// 1. Cinematic Hero / Command Center
// 2. Build Category Row
// 3. Trust + Commerce Bar
// 4. Featured Build Showcase
// 5. Shop by Category
// 6. Real Build Philosophy
// 7. Jake Guidance Section
// 8. Featured Packages
// 9. Why Jake Garage Works
// 10. Final CTA
// 11. Footer
// ═══════════════════════════════════════════════════════════════════════════════

interface JakeGarageHeroProps {
  examplePrompts?: { text: string; icon: string }[];
  onStart: (prompt: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE STREET",
    desc: "Bold stance. Head-turning presence. Make a statement.",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    icon: "🔥",
    iconColor: "text-red-500",
    prompt: "Build me an aggressive street setup",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride. Low road noise. Premium daily driving.",
    image: "/images/homepage/vehicle-tahoe-blackout.jpg",
    icon: "🔇",
    iconColor: "text-blue-400",
    prompt: "Build me a quiet comfortable setup",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean, and mean. Murdered-out perfection.",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    icon: "⚫",
    iconColor: "text-white",
    prompt: "Build me a blackout package",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong. Tow with confidence. Heavy duty ready.",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    icon: "🚛",
    iconColor: "text-amber-500",
    prompt: "Build me a towing setup",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther. Explore more. Adventure awaits.",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    icon: "🏔️",
    iconColor: "text-green-500",
    prompt: "Build me an off-road overland setup",
  },
  {
    id: "show",
    title: "SHOW & STANCE",
    desc: "Weekend warriors. Car meets. All eyes on you.",
    image: "/images/homepage/vehicle-corvette-track.jpg",
    icon: "⭐",
    iconColor: "text-purple-400",
    prompt: "Build me a show truck setup",
  },
];

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

const FEATURED_BUILDS = [
  {
    id: "tahoe-blackout",
    title: "Blacked Out Tahoe",
    vehicle: "2024 Chevrolet Tahoe RST",
    wheels: "Fuel Rebel D679 22x10",
    tires: "Nitto Ridge Grappler 305/45R22",
    style: "Blackout",
    image: "/images/homepage/vehicle-tahoe-blackout.jpg",
    prompt: "Build me a blacked out Tahoe setup",
  },
  {
    id: "ram-lifted",
    title: "Lifted RAM Build",
    vehicle: "2024 RAM 1500 TRX",
    wheels: "Fuel Assault D576 20x12",
    tires: "Toyo Open Country M/T 35x12.50R20",
    style: "Aggressive Lifted",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    prompt: "Build me a lifted RAM with aggressive wheels",
  },
  {
    id: "camaro-stance",
    title: "Staggered Camaro",
    vehicle: "2024 Chevrolet Camaro SS",
    wheels: "Vossen HF-5 20x9/20x11",
    tires: "Michelin Pilot Sport 4S 275/35/305/30",
    style: "Performance Stance",
    image: "/images/homepage/vehicle-camaro-street.jpg",
    prompt: "Build me a staggered Camaro SS setup",
  },
  {
    id: "tacoma-overland",
    title: "Overland Tacoma",
    vehicle: "2024 Toyota Tacoma TRD Pro",
    wheels: "Method MR305 NV 17x8.5",
    tires: "BFGoodrich KO2 285/70R17",
    style: "Overland Ready",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    prompt: "Build me an overland Tacoma setup",
  },
];

const SHOP_CATEGORIES = [
  { id: "wheels", title: "WHEELS", desc: "Premium aftermarket", icon: "⚙️", href: "/wheels" },
  { id: "tires", title: "TIRES", desc: "All terrains to track", icon: "🛞", href: "/tires" },
  { id: "packages", title: "PACKAGES", desc: "Wheel + tire combos", icon: "📦", href: "/wheels?package=1" },
  { id: "lifted", title: "LIFTED", desc: "Lift-ready setups", icon: "🔺", href: "/lifted" },
  { id: "staggered", title: "STAGGERED", desc: "Performance fitments", icon: "⚡", href: "/wheels?staggered=1" },
  { id: "winter", title: "WINTER", desc: "Cold weather ready", icon: "❄️", href: "/tires?season=winter" },
  { id: "towing", title: "TOWING", desc: "Heavy duty rated", icon: "🚛", href: "/tires?use=towing" },
  { id: "daily", title: "DAILY DRIVER", desc: "Comfort focused", icon: "🚗", href: "/tires?use=daily" },
];

const FEATURED_PACKAGES = [
  {
    id: "aggressive",
    title: "Aggressive Street Package",
    desc: "Bold stance. Head-turning presence.",
    wheelBrand: "Fuel Off-Road",
    tireBrand: "Nitto",
    priceRange: "$2,400 - $4,200",
    image: "/images/homepage/vehicle-ram-aggressive.jpg",
    prompt: "Build me an aggressive street package",
  },
  {
    id: "quiet-luxury",
    title: "Quiet Luxury Package",
    desc: "Smooth ride. Premium comfort.",
    wheelBrand: "Vossen",
    tireBrand: "Michelin",
    priceRange: "$3,200 - $5,800",
    image: "/images/homepage/vehicle-tahoe-blackout.jpg",
    prompt: "Build me a quiet luxury package",
  },
  {
    id: "overland",
    title: "Overland Adventure Package",
    desc: "Go anywhere. Do anything.",
    wheelBrand: "Method Race",
    tireBrand: "BFGoodrich",
    priceRange: "$2,800 - $4,600",
    image: "/images/homepage/vehicle-tacoma-overland.jpg",
    prompt: "Build me an overland package",
  },
  {
    id: "towing",
    title: "Heavy Duty Towing Setup",
    desc: "Built for serious hauling.",
    wheelBrand: "XD Series",
    tireBrand: "Toyo",
    priceRange: "$2,200 - $3,800",
    image: "/images/homepage/vehicle-silverado-lifted.jpg",
    prompt: "Build me a towing setup",
  },
];

const WHY_JAKE_WORKS = [
  {
    icon: "🎯",
    title: "Fitment First",
    desc: "Every recommendation is verified for your exact vehicle. No guessing.",
  },
  {
    icon: "💬",
    title: "Real Guidance",
    desc: "Jake understands your goals — aggressive, quiet, towing, whatever you need.",
  },
  {
    icon: "✅",
    title: "Verified Packages",
    desc: "Pre-built combos that work. Wheels, tires, and specs that fit together.",
  },
  {
    icon: "📊",
    title: "Thousands of Builds",
    desc: "Real setups on real vehicles. Proven recommendations.",
  },
  {
    icon: "💾",
    title: "Save & Resume",
    desc: "Come back anytime. Your conversation and selections are saved.",
  },
  {
    icon: "🛒",
    title: "Checkout Ready",
    desc: "Jake builds your cart. One click to purchase your complete setup.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeGarageHero({ onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [finalInput, setFinalInput] = useState("");
  const [finalFocused, setFinalFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) onStart(input.trim());
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalInput.trim()) onStart(finalInput.trim());
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050505]">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: CINEMATIC HERO / COMMAND CENTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[100vh] flex flex-col overflow-hidden">
        
        {/* Background Layers */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#030303]" />
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-[0.05]"
            style={{ backgroundImage: "url('/images/homepage/misc-wheel-wall.jpg')" }}
          />
          
          {/* Left Vehicle - FULL BRIGHTNESS, no opacity */}
          <div className="absolute left-0 top-0 bottom-0 w-[50%] hidden lg:block">
            <Image
              src="/images/homepage/vehicle-ram-aggressive.jpg"
              alt="Featured Vehicle"
              fill
              className="object-cover object-right scale-110"
              style={{ objectPosition: "70% center" }}
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#030303]/50 to-[#030303]" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/40 via-transparent to-[#030303]/60" />
          </div>
          
          {/* Right Jake - FULL BRIGHTNESS, moved up more */}
          <div className="absolute right-[180px] top-0 bottom-0 w-[40%] hidden lg:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[620px] h-[800px] -translate-y-16">
                <Image
                  src="/jake/jake-explaining.png"
                  alt="Jake"
                  fill
                  className="object-contain object-bottom drop-shadow-[0_0_100px_rgba(239,68,68,0.25)]"
                  priority
                />
              </div>
            </div>
            {/* Very light fade */}
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#030303]/30 to-[#030303]" />
          </div>
          
          {/* Center Glows */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[1000px] h-[700px] bg-red-600/10 rounded-full blur-[180px]" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[700px] h-[400px] bg-red-500/15 rounded-full blur-[120px] translate-y-12" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[200px] bg-red-600/20 rounded-full blur-[80px] translate-y-24" />
          </div>
          
          {/* Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#030303_70%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#000000_100%)] opacity-60" />
        </div>

        {/* Header */}
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
            <Link href="/wheels" className="text-base text-white hover:text-red-400 transition-colors font-semibold">Wheels</Link>
            <Link href="/tires" className="text-base text-white hover:text-red-400 transition-colors font-semibold">Tires</Link>
            <Link href="/wheels?package=1" className="text-base text-white hover:text-red-400 transition-colors font-semibold">Packages</Link>
            <Link href="/lifted" className="text-base text-white hover:text-red-400 transition-colors font-semibold">Lifted</Link>
          </nav>

          <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md rounded-full px-6 py-3 border border-white/10">
            <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/30">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <p className="text-white text-base font-bold">Jake is online</p>
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              </div>
              <p className="text-white/50 text-sm">Ready to build your setup</p>
            </div>
          </div>
        </header>

        {/* Main Hero Content */}
        <div className="relative z-10 flex-1 flex">
          
          {/* Left Trust Column - Bebas Neue headings */}
          <div className="hidden xl:flex flex-col justify-center w-80 pl-8 pr-4 py-12">
            <div className="space-y-8">
              {LEFT_TRUST.map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-red-500/25 border border-red-500/50 flex items-center justify-center text-red-500 flex-shrink-0 shadow-xl shadow-red-500/30">
                      {item.icon}
                    </div>
                    <div>
                      <h4 
                        className="text-white text-3xl tracking-[0.03em] leading-tight whitespace-pre-line uppercase"
                        style={{ fontFamily: 'var(--font-bebas), Bebas Neue, sans-serif', fontWeight: 400 }}
                      >
                        {item.title}
                      </h4>
                      <p className="text-white/60 text-sm mt-2 leading-relaxed whitespace-pre-line font-light">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 ml-[72px] w-14 h-[2px] bg-gradient-to-r from-red-500/70 to-transparent" />
                </div>
              ))}
            </div>
          </div>

          {/* Center Command Zone */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-8 py-8">
            <div className="relative max-w-3xl w-full text-center">
              
              <div className="inline-block mb-4">
                <div className="relative px-6 py-2 rounded border-2 border-red-500/80 bg-red-500/15">
                  <div className="absolute inset-0 rounded bg-red-500/30 blur-lg" />
                  <div className="absolute inset-0 rounded shadow-[0_0_40px_rgba(239,68,68,0.5)]" />
                  <span className="relative text-red-500 text-sm font-black tracking-[0.4em] uppercase">
                    Built Different
                  </span>
                </div>
              </div>
              
              <h2 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[0.85] tracking-tight mb-4">
                WHAT ARE WE<br />
                <span className="text-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,0.6)] drop-shadow-[0_0_120px_rgba(239,68,68,0.3)]">
                  BUILDING TODAY?
                </span>
              </h2>
              
              <p className="text-lg lg:text-xl text-white/50 mb-8 max-w-lg mx-auto leading-relaxed">
                Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
                He'll handle the rest.
              </p>
              
              <form onSubmit={handleSubmit} className="relative mb-6">
                <div className={`absolute -inset-3 rounded-3xl transition-all duration-500 ${
                  isFocused ? "bg-red-500/40 blur-2xl" : "bg-red-500/20 blur-xl"
                }`} />
                <div className={`absolute -inset-1 rounded-2xl transition-all duration-500 ${
                  isFocused ? "bg-red-500/30 blur-md" : "bg-red-500/10 blur-sm"
                }`} />
                
                <div className={`relative flex items-center bg-black/90 backdrop-blur-xl border-[3px] rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl ${
                  isFocused 
                    ? "border-red-500 shadow-[0_0_80px_rgba(239,68,68,0.5),inset_0_0_30px_rgba(239,68,68,0.1)]" 
                    : "border-red-500/50 hover:border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                }`}>
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
                    className="m-3 w-14 h-14 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white rounded-xl transition-all flex items-center justify-center shadow-xl shadow-red-600/40"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </form>
              
              <p className="text-white/40 text-sm mb-2">Not sure where to start? Try one of these:</p>
              <div className="mb-4">
                <svg className="w-5 h-5 text-red-500 mx-auto animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>
          </div>

          {/* Right Trust Column - Bebas Neue headings */}
          <div className="hidden xl:flex flex-col justify-center w-80 pr-8 pl-4 py-12">
            <div className="space-y-8">
              {RIGHT_TRUST.map((item, idx) => (
                <div key={idx} className="group text-right">
                  <div className="flex items-start gap-4 justify-end">
                    <div>
                      <h4 
                        className="text-white text-3xl tracking-[0.03em] leading-tight whitespace-pre-line uppercase"
                        style={{ fontFamily: 'var(--font-bebas), Bebas Neue, sans-serif', fontWeight: 400 }}
                      >
                        {item.title}
                      </h4>
                      <p className="text-white/60 text-sm mt-2 leading-relaxed whitespace-pre-line font-light">
                        {item.desc}
                      </p>
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-red-500/25 border border-red-500/50 flex items-center justify-center text-red-500 flex-shrink-0 shadow-xl shadow-red-500/30">
                      {item.icon}
                    </div>
                  </div>
                  <div className="mt-4 mr-[72px] ml-auto w-14 h-[2px] bg-gradient-to-l from-red-500/70 to-transparent" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: BUILD CATEGORY ROW - 6 cards in ONE row
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] pb-8 -mt-4 pt-4">
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-6">
          {/* 6 columns on XL, 3 on lg, 2 on md */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onStart(cat.prompt)}
                className="group relative rounded-xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-red-500/40 transition-all duration-300"
              >
                {/* Image area - portrait aspect */}
                <div className="relative aspect-[4/5]">
                  <Image
                    src={cat.image}
                    alt={cat.title}
                    fill
                    className="object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
                
                {/* Text below image */}
                <div className="p-4 text-center bg-gradient-to-b from-neutral-900 to-black">
                  <h4 className="text-sm lg:text-base font-black text-white mb-1 group-hover:text-red-400 transition-colors leading-tight tracking-wide">
                    {cat.title}
                  </h4>
                  <p className="text-white/50 text-xs lg:text-sm leading-snug">
                    {cat.desc.split('.').slice(0, 2).join('.')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: TRUST + COMMERCE BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-8 border-t border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-10 lg:gap-16">
            {[
              { icon: "✓", title: "100% FITMENT GUARANTEE", desc: "We double check everything" },
              { icon: "📦", title: "FAST, FREE SHIPPING $1500+", desc: "To your door or local shop" },
              { icon: "⭐", title: "TOP BRANDS ONLY", desc: "Quality you can trust" },
              { icon: "❤️", title: "EXPERT SUPPORT", desc: "Jake's got your back" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center text-red-500 text-xl">
                  {item.icon}
                </div>
                <div>
                  <p className="text-white font-bold text-sm tracking-wide">{item.title}</p>
                  <p className="text-white/50 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: TAGLINE
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#050505] py-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-2xl lg:text-3xl font-black tracking-wide">
            <span className="text-red-500">REAL</span> <span className="text-white">PEOPLE.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">EXPERTS.</span>{" "}
            <span className="text-red-500">REAL</span> <span className="text-white">RESULTS.</span>
          </h3>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 11: FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#020202] py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <Link href="/" className="flex items-center gap-3 mb-4">
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-1 ring-red-500/30">
                  <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
                </div>
                <div>
                  <h4 className="text-white font-bold">Jake Garage</h4>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider">By Warehouse Tire Direct</p>
                </div>
              </Link>
              <p className="text-white/40 text-sm leading-relaxed">
                The smarter way to build your wheel and tire setup. 
                Real guidance, real fitment, real results.
              </p>
            </div>
            
            {/* Shop */}
            <div>
              <h5 className="text-white font-bold text-sm mb-4">SHOP</h5>
              <div className="space-y-2">
                <Link href="/wheels" className="block text-white/40 hover:text-white text-sm transition-colors">Wheels</Link>
                <Link href="/tires" className="block text-white/40 hover:text-white text-sm transition-colors">Tires</Link>
                <Link href="/wheels?package=1" className="block text-white/40 hover:text-white text-sm transition-colors">Packages</Link>
                <Link href="/lifted" className="block text-white/40 hover:text-white text-sm transition-colors">Lifted</Link>
              </div>
            </div>
            
            {/* Support */}
            <div>
              <h5 className="text-white font-bold text-sm mb-4">SUPPORT</h5>
              <div className="space-y-2">
                <Link href="/contact" className="block text-white/40 hover:text-white text-sm transition-colors">Contact</Link>
                <Link href="/shipping" className="block text-white/40 hover:text-white text-sm transition-colors">Shipping</Link>
                <Link href="/returns" className="block text-white/40 hover:text-white text-sm transition-colors">Returns</Link>
                <Link href="/faq" className="block text-white/40 hover:text-white text-sm transition-colors">FAQ</Link>
              </div>
            </div>
            
            {/* Company */}
            <div>
              <h5 className="text-white font-bold text-sm mb-4">COMPANY</h5>
              <div className="space-y-2">
                <Link href="/about" className="block text-white/40 hover:text-white text-sm transition-colors">About</Link>
                <Link href="/reviews" className="block text-white/40 hover:text-white text-sm transition-colors">Reviews</Link>
                <Link href="/privacy" className="block text-white/40 hover:text-white text-sm transition-colors">Privacy</Link>
                <Link href="/terms" className="block text-white/40 hover:text-white text-sm transition-colors">Terms</Link>
              </div>
            </div>
          </div>
          
          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-white/30 text-xs">Secure checkout powered by</span>
              <span className="text-white/50 font-semibold text-sm">Stripe</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
