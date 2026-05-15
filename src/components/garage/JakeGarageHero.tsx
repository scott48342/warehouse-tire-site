"use client";

import React, { useState } from "react";
import Image from "next/image";
import { JakeAvatar } from "@/components/jake/JakeAvatar";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Cinematic Build Experience
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamplePrompt {
  text: string;
  icon: string;
}

interface JakeGarageHeroProps {
  examplePrompts: ExamplePrompt[];
  onStart: (prompt: string) => void;
}

// Build category cards with cinematic imagery
const BUILD_CATEGORIES = [
  {
    id: "aggressive",
    title: "AGGRESSIVE STREET",
    desc: "Bold stance. Head turning.",
    image: "/garage/cat-lifted-builds.jpg",
    prompt: "Build an aggressive street setup",
  },
  {
    id: "quiet",
    title: "QUIET & COMFORT",
    desc: "Smooth ride. Low road noise.",
    image: "/garage/cat-suv-crossovers.jpg",
    prompt: "I need quiet comfortable tires for my SUV",
  },
  {
    id: "blackout",
    title: "BLACKOUT BUILDS",
    desc: "Sleek, clean, and mean.",
    image: "/garage/cat-wheels-only.jpg",
    prompt: "I want a full blackout wheel setup",
  },
  {
    id: "towing",
    title: "TOWING & HAULING",
    desc: "Built strong. Tow with confidence.",
    image: "/garage/cat-trucks-jeeps.jpg",
    prompt: "I need wheels and tires for towing",
  },
  {
    id: "offroad",
    title: "OFF-ROAD & OVERLAND",
    desc: "Go farther. Explore more.",
    image: "/garage/cat-lifted-builds.jpg",
    prompt: "Build an off-road overland setup",
  },
  {
    id: "stance",
    title: "SHOW & STANCE",
    desc: "For the weekend warriors.",
    image: "/garage/cat-performance-street.jpg",
    prompt: "Build a show stance setup",
  },
];

const TRUST_BADGES = [
  { icon: "✓", text: "100% Fitment Guarantee" },
  { icon: "🚚", text: "Fast Shipping" },
  { icon: "⭐", text: "Top Brands Only" },
  { icon: "💬", text: "Expert Support" },
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
          BACKGROUND LAYERS
      ═══════════════════════════════════════════════════════════════════════ */}
      
      {/* Hero Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/garage/hero-vehicles.jpg"
          alt="Custom builds"
          fill
          className="object-cover object-center opacity-40"
          priority
        />
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
      </div>

      {/* Subtle Animated Noise Texture */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Red Ambient Glow */}
      <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[120px]" />

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════════════════════ */}
      
      <div className="flex-1 flex flex-col lg:flex-row relative z-10">
        
        {/* LEFT + CENTER: Main Hero Content */}
        <div className="flex-1 flex flex-col justify-center px-6 lg:px-12 xl:px-20 py-12 lg:py-0">
          
          {/* "BUILT DIFFERENT" Label */}
          <div className="mb-6">
            <span className="inline-block px-4 py-1.5 text-xs font-bold tracking-[0.3em] text-red-500 border border-red-500/30 rounded-full bg-red-500/5 uppercase">
              Built Different
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-4 leading-[0.95] tracking-tight">
            WHAT ARE WE<br />
            <span className="text-red-500">BUILDING TODAY?</span>
          </h1>

          {/* Subtext */}
          <p className="text-lg lg:text-xl text-white/60 mb-10 max-w-xl">
            Tell Jake what you drive or what look you want. He&apos;ll handle the rest.
          </p>

          {/* ═══════════════════════════════════════════════════════════════════
              CONVERSATIONAL INPUT BAR
          ═══════════════════════════════════════════════════════════════════ */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-12">
            <div className="relative group">
              {/* Animated Glow Effect */}
              <div 
                className={`absolute -inset-1 rounded-2xl blur-lg transition-all duration-500 ${
                  isFocused 
                    ? "bg-gradient-to-r from-red-600/60 via-red-500/60 to-red-600/60 opacity-100" 
                    : "bg-red-600/20 opacity-50"
                }`}
              />
              
              {/* Glassmorphism Container */}
              <div className={`relative flex items-center bg-white/5 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 ${
                isFocused ? "border-red-500/50 bg-white/10" : "border-white/10"
              }`}>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Tell Jake what you drive or what look you want..."
                  className="flex-1 bg-transparent px-6 py-5 text-lg text-white placeholder-white/40 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="m-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-neutral-700 disabled:to-neutral-800 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="hidden sm:inline">Start Building</span>
                  <span className="sm:hidden text-xl">→</span>
                </button>
              </div>
            </div>
          </form>

          {/* ═══════════════════════════════════════════════════════════════════
              BUILD CATEGORY CARDS
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="w-full max-w-4xl">
            <p className="text-white/40 text-sm mb-4 uppercase tracking-wider font-medium">Or choose a build type:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BUILD_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.prompt)}
                  className="group relative h-32 sm:h-36 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-red-500/20"
                >
                  {/* Card Image */}
                  <Image
                    src={cat.image}
                    alt={cat.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  
                  {/* Dark Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  
                  {/* Red Hover Glow */}
                  <div className="absolute inset-0 bg-red-600/0 group-hover:bg-red-600/20 transition-colors duration-300" />
                  
                  {/* Card Content */}
                  <div className="absolute inset-0 p-4 flex flex-col justify-end">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-0.5">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors">
                      {cat.desc}
                    </p>
                  </div>
                  
                  {/* Corner Accent */}
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500/50 group-hover:bg-red-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            RIGHT: JAKE PANEL
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col items-center justify-center w-80 xl:w-96 px-8 py-12 border-l border-white/5 bg-gradient-to-b from-black/50 via-transparent to-black/50">
          
          {/* Jake Status */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-white/60">Jake is online</span>
          </div>

          {/* Jake Avatar with Glow */}
          <div className="relative mb-6">
            <div className="absolute inset-0 -m-8 rounded-full bg-red-600/20 blur-3xl animate-pulse" />
            <JakeAvatar 
              size="xl" 
              showGlow={true} 
              showOnlineIndicator={false} 
              animated={true}
            />
          </div>

          {/* Jake Identity */}
          <h2 className="text-2xl font-black text-white mb-1">JAKE</h2>
          <p className="text-sm text-white/40 mb-6">Your wheel & tire expert</p>

          {/* Trust Stat */}
          <div className="text-center px-6 py-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-2xl font-bold text-red-500 mb-1">30,000+</p>
            <p className="text-xs text-white/50">builds and counting</p>
          </div>

          {/* Ready Message */}
          <p className="mt-6 text-sm text-white/40 text-center">
            Ready to build your setup
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST STRIP
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 border-t border-white/5 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {TRUST_BADGES.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 text-white/50">
                <span className="text-red-500">{badge.icon}</span>
                <span className="text-sm font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM STATEMENT
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 py-8 text-center bg-gradient-to-t from-red-950/20 to-transparent">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white/90 tracking-tight">
          REAL PEOPLE. <span className="text-red-500">REAL EXPERTS.</span> REAL RESULTS.
        </h2>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ANIMATIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <style jsx>{`
        @keyframes subtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
