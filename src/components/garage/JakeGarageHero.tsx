"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic Premium Rebuild
// 
// Goals:
// - Cinematic, alive, premium, immersive
// - Jake feels like a real advisor, not a mascot
// - Emotional engagement + conversion focused
// - Modern automotive brand feel
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamplePrompt {
  text: string;
  icon: string;
}

interface JakeGarageHeroProps {
  examplePrompts: ExamplePrompt[];
  onStart: (prompt: string) => void;
}

// Hero backgrounds - brighter garage shots
const HERO_BACKGROUNDS = [
  "/garage/hero-garage-02.jpg",
  "/garage/hero-garage-03.jpg", 
  "/garage/hero-garage-04.jpg",
];

// Build category cards with vehicle images
const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE BUILDS",
    desc: "Bold stance. Head turning.",
    image: "/garage/card-bg-aggressive-street.jpg",
    prompt: "Build an aggressive street setup",
    accent: "from-red-600/50",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride. Low road noise.",
    image: "/garage/card-bg-quiet-comfort.jpg",
    prompt: "I need quiet comfortable tires for my SUV",
    accent: "from-blue-600/50",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean, and mean.",
    image: "/garage/card-bg-blackout-builds.jpg",
    prompt: "I want a full blackout wheel setup",
    accent: "from-neutral-600/50",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong. Tow with confidence.",
    image: "/garage/card-bg-towing-hauling.jpg",
    prompt: "I need wheels and tires for towing",
    accent: "from-amber-600/50",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther. Explore more.",
    image: "/garage/card-bg-offroad-overland.jpg",
    prompt: "Build an off-road overland setup",
    accent: "from-green-600/50",
  },
  {
    id: "stance",
    title: "SHOW & STANCE",
    desc: "For the weekend warriors.",
    image: "/garage/card-bg-show-stance.jpg",
    prompt: "Build a show stance setup",
    accent: "from-purple-600/50",
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
  const [bgImage, setBgImage] = useState(HERO_BACKGROUNDS[0]);
  const [mounted, setMounted] = useState(false);
  const [jakeHovered, setJakeHovered] = useState(false);

  useEffect(() => {
    setMounted(true);
    const randomBg = HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)];
    setBgImage(randomBg);
  }, []);

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
          BACKGROUND - Cinematic Garage (BRIGHTER)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        <Image
          src={bgImage}
          alt="Jake's Garage"
          fill
          className="object-cover object-center"
          priority
        />
        
        {/* Gradient overlays - LIGHTER for visibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
        
        {/* Red glow accent at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-red-950/30 to-transparent pointer-events-none" />
        
        {/* Radial glow behind content */}
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(220,38,38,0.06) 0%, transparent 60%)",
          }}
        />

        {/* Soft vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
        }} />
      </div>

      {/* Floating particles (subtle) */}
      {mounted && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/10 rounded-full"
              style={{
                left: `${10 + i * 12}%`,
                top: `${15 + (i % 4) * 20}%`,
                animation: `float-particle ${10 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.7}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER ROW
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-4">
        {/* Left: Jake Garage Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center transition-transform group-hover:scale-110">
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
        </Link>

        {/* Right: Jake Online Status Card */}
        <div className="hidden sm:flex items-center gap-3 bg-white/5 backdrop-blur-md rounded-xl px-4 py-2 border border-white/10">
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm text-white font-medium">Jake is online</span>
            </div>
            <p className="text-xs text-white/50">Ready to build your setup</p>
          </div>
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/30">
            <Image
              src="/jake/jake-avatar-online.png"
              alt="Jake"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col lg:flex-row relative z-10">
        
        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 py-8 lg:py-0">
          
          {/* "BUILT DIFFERENT" Neon Badge */}
          <div className="mb-6 animate-fade-in-up">
            <div className="relative inline-block">
              <div className="absolute -inset-2 rounded-lg bg-red-500/20 blur-xl animate-pulse-slow" />
              <div className="absolute -inset-1 rounded-lg bg-red-600/30 blur-md" />
              <div className="relative px-8 py-2.5 border-2 border-red-500 rounded-lg bg-red-950/40 backdrop-blur-sm shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                <span className="text-base sm:text-lg font-bold tracking-[0.25em] text-red-400 uppercase">
                  Built Different
                </span>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white text-center mb-4 leading-[0.95] tracking-tight animate-fade-in-up animation-delay-100">
            WHAT ARE WE<br />
            <span className="text-red-500">BUILDING</span> TODAY?
          </h2>

          {/* Subtext */}
          <p className="text-lg lg:text-xl text-white/70 text-center mb-8 max-w-xl animate-fade-in-up animation-delay-200">
            Tell Jake what you drive or what look you want.<br className="hidden sm:block" />
            He'll handle the rest.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              INPUT BAR - Premium with animated glow
          ═══════════════════════════════════════════════════════════════════ */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8 animate-fade-in-up animation-delay-300">
            <div className="relative group">
              {/* Animated Glow Effect */}
              <div 
                className={`absolute -inset-1 rounded-2xl blur-xl transition-all duration-500 ${
                  isFocused 
                    ? "bg-gradient-to-r from-red-600/50 via-red-500/50 to-red-600/50 opacity-100" 
                    : "bg-red-600/10 opacity-50"
                }`}
              />
              
              {/* Input Container */}
              <div className={`relative flex items-center bg-white/5 backdrop-blur-xl border-2 rounded-2xl overflow-hidden transition-all duration-300 ${
                isFocused ? "border-red-500/60 bg-white/10 shadow-[0_0_40px_rgba(220,38,38,0.15)]" : "border-white/15 hover:border-white/25"
              }`}>
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
                  className="m-2 p-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {/* "Not sure where to start?" */}
          <div className="text-center mb-6 animate-fade-in-up animation-delay-400">
            <p className="text-white/50 text-sm mb-2">Not sure where to start? Choose a build style:</p>
            <svg className="w-5 h-5 mx-auto text-red-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT SIDE - Jake AI Advisor Panel (Desktop Only)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="hidden xl:flex flex-col items-center justify-center w-[340px] px-6 py-8">
          <div 
            className={`relative transition-all duration-500 ${jakeHovered ? "scale-105" : ""}`}
            onMouseEnter={() => setJakeHovered(true)}
            onMouseLeave={() => setJakeHovered(false)}
          >
            {/* Glassmorphism Card */}
            <div className={`relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-500 ${jakeHovered ? "border-red-500/40 shadow-[0_0_60px_rgba(220,38,38,0.2)]" : "border-white/10"}`}>
              {/* Animated shimmer on hover */}
              {jakeHovered && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div 
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.2), transparent)",
                      animation: "shimmer 2s infinite",
                    }}
                  />
                </div>
              )}

              <div className="relative p-6">
                {/* Jake Image */}
                <div className="relative mb-4">
                  <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-2xl opacity-60" />
                  <Image
                    src="/jake/jake-explaining.png"
                    alt="Jake - Your AI Fitment Advisor"
                    width={180}
                    height={180}
                    className="relative rounded-xl object-cover mx-auto shadow-2xl"
                  />
                  {/* Online indicator */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#111] border border-white/10 rounded-full px-3 py-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-xs text-white/70 font-medium">Online</span>
                  </div>
                </div>

                {/* Jake Info */}
                <div className="text-center">
                  <p className="text-red-500 text-xs font-semibold uppercase tracking-wider mb-1">AI Build Advisor</p>
                  <h3 className="text-2xl font-black text-white mb-2">JAKE</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Your wheel & tire expert. Tell me what you're building — I'll find the perfect setup.
                  </p>
                </div>

                {/* Jake's capabilities */}
                <div className="mt-4 space-y-2">
                  {["Fitment verified", "30K+ builds", "24/7 available"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-white/50 text-xs">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          BUILD CATEGORY CARDS - Cinematic with better hover
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 px-4 lg:px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
            {BUILD_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.prompt)}
                className="group relative h-40 sm:h-44 lg:h-48 rounded-xl overflow-hidden transition-all duration-500 hover:scale-[1.05] hover:z-10"
              >
                {/* Card Image */}
                <Image
                  src={cat.image}
                  alt={cat.title}
                  fill
                  className="object-cover transition-all duration-700 group-hover:scale-115 group-hover:brightness-110"
                  sizes="(max-width: 640px) 50vw, 16vw"
                />
                
                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t ${cat.accent} via-black/60 to-black/20 transition-opacity duration-300 group-hover:opacity-70`} />
                
                {/* Hover Glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-red-500/10 rounded-xl ring-2 ring-red-500/40" />
                
                {/* Card Content */}
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <h3 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide mb-0.5 group-hover:text-red-400 transition-colors">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                    {cat.desc}
                  </p>
                  
                  {/* Arrow on hover */}
                  <div className="mt-2 flex items-center gap-1.5 text-red-500 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    <span className="text-xs font-semibold uppercase">Build</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST STRIP - Enhanced
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 border-t border-white/10 bg-black/70 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {TRUST_BADGES.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <span className="text-red-500 text-xl transition-transform group-hover:scale-110">{badge.icon}</span>
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
          FOOTER
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

      {/* ═══════════════════════════════════════════════════════════════════════
          CSS ANIMATIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <style jsx>{`
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.1; }
          25% { transform: translateY(-30px) translateX(15px); opacity: 0.3; }
          50% { transform: translateY(-15px) translateX(-10px); opacity: 0.2; }
          75% { transform: translateY(-40px) translateX(8px); opacity: 0.15; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
          opacity: 0;
        }
        .animation-delay-100 { animation-delay: 0.1s; }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-300 { animation-delay: 0.3s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-pulse-slow {
          animation: pulse 3s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .group-hover\\:scale-115:hover {
          transform: scale(1.15);
        }
      `}</style>
    </div>
  );
}
