"use client";

import React, { useState } from "react";
import Image from "next/image";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Matches Reference Design Exactly
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamplePrompt {
  text: string;
  icon: string;
}

interface JakeGarageHeroProps {
  examplePrompts: ExamplePrompt[];
  onStart: (prompt: string) => void;
}

// Build category cards - using new asset images
const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE STREET",
    desc: "Bold stance. Head turning.",
    icon: "/icons/icon-fitment.svg",
    iconBg: "bg-red-500",
    image: "/garage/card-aggressive-street.jpg",
    prompt: "Build an aggressive street setup",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride. Low road noise.",
    icon: "/icons/icon-support.svg",
    iconBg: "bg-red-500",
    image: "/garage/card-quiet-comfort.jpg",
    prompt: "I need quiet comfortable tires for my SUV",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean, and mean.",
    icon: null, // Black circle
    iconBg: "bg-neutral-900",
    image: "/garage/card-blackout-builds.jpg",
    prompt: "I want a full blackout wheel setup",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong. Tow with confidence.",
    icon: "/icons/icon-shipping.svg",
    iconBg: "bg-red-500",
    image: "/garage/card-towing-hauling.jpg",
    prompt: "I need wheels and tires for towing",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther. Explore more.",
    icon: "/icons/icon-brands.svg",
    iconBg: "bg-green-600",
    image: "/garage/card-offroad-overland.jpg",
    prompt: "Build an off-road overland setup",
  },
  {
    id: "stance",
    title: "SHOW & STANCE",
    desc: "For the weekend warriors.",
    icon: "/icons/icon-fitment.svg",
    iconBg: "bg-purple-500",
    image: "/garage/card-show-stance.jpg",
    prompt: "Build a show stance setup",
  },
];

const TRUST_BADGES = [
  { icon: "✓", title: "100% FITMENT GUARANTEE", subtitle: "We double check everything" },
  { icon: "🚚", title: "FAST, FREE SHIPPING", subtitle: "To your door or local shop" },
  { icon: "⚙️", title: "TOP BRANDS ONLY", subtitle: "Quality you can trust" },
  { icon: "💬", title: "EXPERT SUPPORT", subtitle: "Jake's got your back." },
];

export function JakeGarageHero({ onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onStart(input.trim());
    }
  };

  const handleCategoryClick = (prompt: string) => {
    onStart(prompt);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-black">
      {/* ═══════════════════════════════════════════════════════════════════════
          BACKGROUND - Cinematic Garage
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        <Image
          src="/garage/hero-garage-bg.png"
          alt="Jake's Garage"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER ROW - Logo Left, Jake Status Right
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-4">
        {/* Left: Jake Garage Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Jake <span className="text-red-500">Garage</span>
            </h1>
            <p className="text-xs text-white/50">Powered by Warehouse Tire Direct</p>
          </div>
        </div>

        {/* Right: Jake Online Status Card */}
        <div className="hidden sm:flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-white font-medium">Jake is online</span>
            </div>
            <p className="text-xs text-white/50">Ready to build your setup</p>
          </div>
          <div className="relative w-14 h-14">
            <Image
              src="/jake/jake-avatar-online.png"
              alt="Jake"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT - Centered Hero
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col lg:flex-row relative z-10">
        
        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 py-8 lg:py-0">
          
          {/* "BUILT DIFFERENT" Neon Sign Badge */}
          <div className="mb-6">
            <div className="relative inline-block">
              {/* Outer glow */}
              <div className="absolute -inset-2 rounded-lg bg-red-500/30 blur-xl" />
              <div className="absolute -inset-1 rounded-lg bg-red-600/40 blur-md" />
              {/* Inner badge */}
              <div className="relative px-8 py-2.5 border-2 border-red-500 rounded-lg bg-red-950/50 shadow-[0_0_20px_rgba(239,68,68,0.5),inset_0_0_20px_rgba(239,68,68,0.1)]">
                <span className="relative text-base sm:text-lg font-bold tracking-[0.25em] text-red-500 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                  Built Different
                </span>
              </div>
            </div>
          </div>

          {/* Main Headline - Centered */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white text-center mb-4 leading-[0.95] tracking-tight">
            WHAT ARE WE<br />
            BUILDING TODAY?
          </h2>

          {/* Subtext */}
          <p className="text-lg lg:text-xl text-white/70 text-center mb-8 max-w-xl">
            Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
            He&apos;ll handle the rest.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              INPUT BAR - Glassmorphism with red glow
          ═══════════════════════════════════════════════════════════════════ */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
            <div className="relative group">
              {/* Animated Glow Effect */}
              <div 
                className={`absolute -inset-1 rounded-2xl blur-lg transition-all duration-500 ${
                  isFocused 
                    ? "bg-gradient-to-r from-red-600/60 via-red-500/60 to-red-600/60 opacity-100" 
                    : "bg-red-600/20 opacity-50"
                }`}
              />
              
              {/* Input Container */}
              <div className={`relative flex items-center bg-white/5 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
                isFocused ? "border-red-500/70 bg-white/10" : "border-white/20"
              }`}>
                {/* Chat Icon */}
                <div className="pl-5 pr-2 text-white/40">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Tell Jake what you drive or what look you want..."
                  className="flex-1 bg-transparent py-5 text-lg text-white placeholder-white/40 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="m-2 p-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg hover:shadow-red-500/30"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {/* "Not sure where to start?" */}
          <div className="text-center mb-6">
            <p className="text-white/50 text-sm mb-2">Not sure where to start? Try one of these:</p>
            <svg className="w-5 h-5 mx-auto text-red-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT SIDE - Jake Panel (Desktop Only)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="hidden xl:flex flex-col items-center justify-center w-80 px-6 py-8">
          {/* Jake Avatar with Glow */}
          <div className="relative mb-4">
            <div className="absolute inset-0 -m-4 rounded-full bg-red-600/30 blur-2xl" />
            <div className="relative w-36 h-36">
              <Image
                src="/jake/jake-avatar-online.png"
                alt="Jake"
                fill
                className="object-contain"
              />
            </div>
          </div>

          {/* Jake Name Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-6 py-4 border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <h3 className="text-xl font-black text-white">JAKE</h3>
              <span className="px-2 py-0.5 text-xs font-bold bg-red-600 text-white rounded">AI</span>
            </div>
            <p className="text-sm text-white/60 mb-3">
              Your wheel & tire expert<br />
              Here to build your perfect setup
            </p>
            <div className="flex items-center justify-center gap-2 text-red-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-sm font-medium">30,000+ builds and counting.</span>
            </div>
            <p className="text-xs text-white/40 mt-1">Let&apos;s build yours.</p>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD CATEGORY CARDS - 6 in a row
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 lg:px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.prompt)}
                className="group relative h-36 sm:h-40 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-red-500/20"
              >
                {/* Card Image */}
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                
                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
                
                {/* Red Hover Glow */}
                <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/20 transition-colors duration-300" />
                
                {/* Icon Badge */}
                <div className={`absolute top-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full ${cat.iconBg} flex items-center justify-center shadow-lg`}>
                  {cat.icon ? (
                    <Image src={cat.icon} alt="" width={20} height={20} className="invert" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-black" />
                  )}
                </div>
                
                {/* Card Content */}
                <div className="absolute inset-0 p-3 flex flex-col justify-end text-center">
                  <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide mb-0.5">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                    {cat.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST STRIP
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {TRUST_BADGES.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-red-500 text-xl">{badge.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white">{badge.title}</p>
                  <p className="text-xs text-white/50">{badge.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER - Brand Statement
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 py-6 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight">
            <span className="text-red-500">REAL</span>
            <span className="text-white"> PEOPLE. </span>
            <span className="text-red-500">REAL</span>
            <span className="text-white"> EXPERTS. </span>
            <span className="text-red-500">REAL</span>
            <span className="text-white"> RESULTS.</span>
          </h2>
          <p className="text-xs text-white/40">
            Secure checkout powered by <span className="text-white font-semibold">WAREHOUSE</span><span className="text-red-500 font-semibold">TIRE</span> <span className="text-white font-semibold">DIRECT</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
