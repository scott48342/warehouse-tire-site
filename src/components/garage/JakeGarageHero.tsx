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
            <Link href="/wheels" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Wheels</Link>
            <Link href="/tires" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Tires</Link>
            <Link href="/wheels?package=1" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Packages</Link>
            <Link href="/lifted" className="text-sm text-white/50 hover:text-white transition-colors font-medium">Lifted</Link>
          </nav>

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

        {/* Main Hero Content */}
        <div className="relative z-10 flex-1 flex">
          
          {/* Left Trust Column - EVEN LARGER TEXT */}
          <div className="hidden xl:flex flex-col justify-center w-80 pl-8 pr-4 py-12">
            <div className="space-y-8">
              {LEFT_TRUST.map((item, idx) => (
                <div key={idx} className="group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-red-500/25 border border-red-500/50 flex items-center justify-center text-red-500 flex-shrink-0 shadow-xl shadow-red-500/30">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-black tracking-wide leading-tight whitespace-pre-line uppercase">
                        {item.title}
                      </h4>
                      <p className="text-white/70 text-base mt-2 leading-relaxed whitespace-pre-line">
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

          {/* Right Trust Column - EVEN LARGER TEXT */}
          <div className="hidden xl:flex flex-col justify-center w-80 pr-8 pl-4 py-12">
            <div className="space-y-8">
              {RIGHT_TRUST.map((item, idx) => (
                <div key={idx} className="group text-right">
                  <div className="flex items-start gap-4 justify-end">
                    <div>
                      <h4 className="text-white text-lg font-black tracking-wide leading-tight whitespace-pre-line uppercase">
                        {item.title}
                      </h4>
                      <p className="text-white/70 text-base mt-2 leading-relaxed whitespace-pre-line">
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
          SECTION 2: BUILD CATEGORY ROW - Large Cinematic Build Portals
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] pb-16 -mt-8 pt-8">
        {/* Section background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[1400px] h-[400px] bg-red-600/5 rounded-full blur-[150px]" />
        </div>
        
        <div className="relative max-w-[1600px] mx-auto px-4 lg:px-8">
          {/* 3 columns on large screens, 2 on medium, 1 on small */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onStart(cat.prompt)}
                className="group relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-red-500/50 transition-all duration-500 shadow-2xl shadow-black/50 hover:shadow-red-500/10"
              >
                {/* Image - BRIGHTER, more dominant */}
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover opacity-70 group-hover:opacity-90 transition-all duration-700 group-hover:scale-110 brightness-110"
                  style={{ objectPosition: "center 40%" }}
                />
                
                {/* Gradient overlay - lighter to show more vehicle */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
                
                {/* Red accent glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-red-600/20 via-transparent to-transparent" />
                
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Icon badge - larger */}
                <div className={`absolute top-5 left-5 w-14 h-14 rounded-2xl bg-black/60 backdrop-blur-md flex items-center justify-center text-2xl border border-white/20 shadow-xl ${cat.iconColor} group-hover:scale-110 group-hover:border-red-500/50 transition-all duration-300`}>
                  {cat.icon}
                </div>
                
                {/* Content - LARGER typography */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h4 className="text-xl lg:text-2xl font-black text-white mb-2 group-hover:text-red-400 transition-colors leading-tight tracking-wide drop-shadow-lg">
                    {cat.title}
                  </h4>
                  <p className="text-white/70 text-sm lg:text-base whitespace-pre-line leading-relaxed drop-shadow-md">
                    {cat.desc.replace('\n', ' ')}
                  </p>
                  
                  {/* CTA hint on hover */}
                  <div className="mt-4 flex items-center gap-2 text-red-400 text-sm font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <span>Start This Build</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
                
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: TRUST + COMMERCE BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-6 border-t border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14">
            {[
              { icon: "✓", title: "100% FITMENT GUARANTEE", desc: "We double check everything" },
              { icon: "📦", title: "FAST, FREE SHIPPING $199+", desc: "To your door or local shop" },
              { icon: "⭐", title: "TOP BRANDS ONLY", desc: "Quality you can trust" },
              { icon: "❤️", title: "EXPERT SUPPORT", desc: "Jake's got your back" },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                  {item.icon}
                </div>
                <div>
                  <p className="text-white font-bold text-xs tracking-wide">{item.title}</p>
                  <p className="text-white/40 text-[10px]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: FEATURED BUILD SHOWCASE
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] py-20 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[1200px] h-[400px] bg-red-600/5 rounded-full blur-[150px]" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-3">
              REAL <span className="text-red-500">BUILDS</span>
            </h3>
            <p className="text-white/50 text-lg">Inspiration for your next setup</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURED_BUILDS.map((build) => (
              <button
                key={build.id}
                onClick={() => onStart(build.prompt)}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 hover:border-red-500/30 transition-all text-left"
              >
                <Image
                  src={build.image}
                  alt={build.title}
                  fill
                  className="object-cover opacity-50 group-hover:opacity-70 transition-all duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                
                {/* Style badge */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-full text-red-400 text-[10px] font-bold uppercase tracking-wide">
                    {build.style}
                  </span>
                </div>
                
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h4 className="text-lg font-black text-white mb-1 group-hover:text-red-400 transition-colors">
                    {build.title}
                  </h4>
                  <p className="text-white/50 text-xs mb-3">{build.vehicle}</p>
                  
                  <div className="space-y-1 text-[10px]">
                    <p className="text-white/40"><span className="text-white/60">Wheels:</span> {build.wheels}</p>
                    <p className="text-white/40"><span className="text-white/60">Tires:</span> {build.tires}</p>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-2 text-red-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Build Something Similar</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
                
                {/* Built by badge */}
                <div className="absolute top-4 right-4 opacity-60">
                  <span className="text-[8px] text-white/50 uppercase tracking-wider">Built by Jake Garage</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: SHOP BY CATEGORY
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-3">
              SHOP BY <span className="text-red-500">CATEGORY</span>
            </h3>
            <p className="text-white/50 text-lg">Find exactly what you need</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SHOP_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                className="group relative p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-red-500/30 hover:bg-white/[0.04] transition-all"
              >
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-red-500/5 to-transparent" />
                
                <div className="relative">
                  <span className="text-3xl mb-3 block">{cat.icon}</span>
                  <h4 className="text-white font-black text-sm tracking-wide mb-1 group-hover:text-red-400 transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-white/40 text-xs">{cat.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6: REAL BUILD PHILOSOPHY
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-[0.03]"
            style={{ backgroundImage: "url('/images/homepage/store-interior.jpg')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />
        </div>
        
        {/* Red accent glow */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[150px]" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[150px]" />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h3 className="text-4xl lg:text-5xl xl:text-6xl font-black mb-8">
            <span className="text-red-500">REAL</span> <span className="text-white">PEOPLE.</span><br />
            <span className="text-red-500">REAL</span> <span className="text-white">EXPERTS.</span><br />
            <span className="text-red-500">REAL</span> <span className="text-white">RESULTS.</span>
          </h3>
          
          <p className="text-white/60 text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
            No pressure. No guesswork. Just honest guidance from people who actually build what they recommend. 
            40+ years of real-world fitment experience, now available to you.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-red-500">✓</span> Fitment First
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-red-500">✓</span> No Pushy Sales
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-red-500">✓</span> Real-World Setups
            </div>
            <div className="flex items-center gap-2 text-white/50">
              <span className="text-red-500">✓</span> Enthusiast Guidance
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 7: JAKE GUIDANCE SECTION
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Jake Image */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px]" />
              </div>
              <div className="relative w-full max-w-md mx-auto aspect-square">
                <Image
                  src="/jake/jake-explaining.png"
                  alt="Jake - Your Build Guide"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            
            {/* Content */}
            <div>
              <div className="inline-block mb-4">
                <span className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-xs font-bold uppercase tracking-wide">
                  Guided Experience
                </span>
              </div>
              
              <h3 className="text-3xl lg:text-4xl font-black text-white mb-6">
                YOUR BUILD.<br />
                <span className="text-red-500">YOUR WAY.</span>
              </h3>
              
              <p className="text-white/60 text-lg mb-8 leading-relaxed">
                Jake helps you build the perfect wheel and tire setup. Tell him what you drive, 
                what look you want, or what you need — and he'll guide you through every step.
              </p>
              
              <div className="space-y-4">
                {[
                  "Get personalized recommendations for your exact vehicle",
                  "Compare options and understand the tradeoffs",
                  "Build complete packages with verified fitment",
                  "Save your build and come back anytime",
                  "Generate ready-to-checkout carts instantly",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-white/70 text-sm">{item}</p>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => onStart("Help me build my setup")}
                className="mt-8 px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center gap-3"
              >
                <span>Start Building</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 8: FEATURED PACKAGES
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#050505] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-3">
              POPULAR <span className="text-red-500">PACKAGES</span>
            </h3>
            <p className="text-white/50 text-lg">Pre-built setups with verified fitment</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURED_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => onStart(pkg.prompt)}
                className="group relative rounded-2xl overflow-hidden bg-neutral-900/50 border border-white/5 hover:border-red-500/30 transition-all text-left"
              >
                {/* Image */}
                <div className="relative aspect-[4/3]">
                  <Image
                    src={pkg.image}
                    alt={pkg.title}
                    fill
                    className="object-cover opacity-40 group-hover:opacity-60 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/50 to-transparent" />
                  
                  {/* Fitment badge */}
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded text-green-400 text-[9px] font-bold uppercase">
                      ✓ Fitment Verified
                    </span>
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-5">
                  <h4 className="text-white font-bold mb-1 group-hover:text-red-400 transition-colors">
                    {pkg.title}
                  </h4>
                  <p className="text-white/40 text-xs mb-4">{pkg.desc}</p>
                  
                  <div className="space-y-1.5 text-[10px] mb-4">
                    <p className="text-white/50">
                      <span className="text-white/30">Wheels:</span> {pkg.wheelBrand}
                    </p>
                    <p className="text-white/50">
                      <span className="text-white/30">Tires:</span> {pkg.tireBrand}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-red-400 font-bold text-sm">{pkg.priceRange}</span>
                    <span className="text-white/40 text-xs group-hover:text-red-400 transition-colors">
                      Start Build →
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 9: WHY JAKE GARAGE WORKS
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#030303] py-20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <h3 className="text-3xl lg:text-4xl font-black text-white mb-3">
              WHY <span className="text-red-500">JAKE GARAGE</span>
            </h3>
            <p className="text-white/50 text-lg">The smarter way to build your setup</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_JAKE_WORKS.map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
              >
                <span className="text-3xl mb-4 block">{item.icon}</span>
                <h4 className="text-white font-bold mb-2">{item.title}</h4>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 10: FINAL CTA
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-[#050505] py-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
            style={{ backgroundImage: "url('/images/homepage/misc-wheel-wall.jpg')" }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050505_70%)]" />
        </div>
        
        {/* Red glows */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-600/10 rounded-full blur-[150px]" />
        
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h3 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-6">
            READY TO BUILD<br />
            <span className="text-red-500 drop-shadow-[0_0_40px_rgba(239,68,68,0.4)]">YOUR SETUP?</span>
          </h3>
          
          <p className="text-white/50 text-lg mb-10 max-w-lg mx-auto">
            Tell Jake what you drive and what you're looking for. 
            He'll guide you to the perfect wheels and tires.
          </p>
          
          {/* Final Input */}
          <form onSubmit={handleFinalSubmit} className="relative mb-8 max-w-2xl mx-auto">
            <div className={`absolute -inset-2 rounded-2xl transition-all duration-500 ${
              finalFocused ? "bg-red-500/30 blur-xl" : "bg-red-500/15 blur-lg"
            }`} />
            
            <div className={`relative flex items-center bg-black/80 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
              finalFocused 
                ? "border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.4)]" 
                : "border-red-500/40 hover:border-red-500/60"
            }`}>
              <input
                type="text"
                value={finalInput}
                onChange={(e) => setFinalInput(e.target.value)}
                onFocus={() => setFinalFocused(true)}
                onBlur={() => setFinalFocused(false)}
                placeholder="What are you building?"
                className="flex-1 bg-transparent px-6 py-5 text-lg text-white placeholder-white/40 focus:outline-none"
              />
              
              <button 
                type="submit" 
                disabled={!finalInput.trim()} 
                className="m-2 px-8 py-3.5 bg-red-600 hover:bg-red-500 disabled:bg-white/10 disabled:text-white/30 text-white font-bold rounded-xl transition-all flex items-center gap-2"
              >
                <span>Start Building</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </form>
          
          {/* Jake presence */}
          <div className="flex items-center justify-center gap-3 text-white/50 text-sm">
            <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-red-500/30">
              <Image src="/jake/jake-avatar-online.png" alt="Jake" fill className="object-cover" />
            </div>
            <span>Jake is ready to help</span>
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
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
