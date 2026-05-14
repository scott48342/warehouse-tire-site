"use client";

import React, { useState } from "react";
import Link from "next/link";
import { trackJakeEvent } from "./JakeAnalytics";
import { JakeAvatar } from "./JakeAvatar";

// ═══════════════════════════════════════════════════════════════════════════════
// SUGGESTED PROMPTS FOR HOMEPAGE
// ═══════════════════════════════════════════════════════════════════════════════

const QUICK_PROMPTS = [
  { text: "Best tires for my truck", category: "tires" },
  { text: "Build me a wheel package", category: "packages" },
  { text: "Will bigger tires fit?", category: "fitment" },
  { text: "Quiet highway tires", category: "tires" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE HOMEPAGE SECTION - Premium Prominent Placement
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeHomepageSection() {
  const handleAskJake = () => {
    trackJakeEvent("jake_opened", { source: "homepage" });
  };

  const handlePromptClick = (prompt: string) => {
    trackJakeEvent("suggested_prompt_clicked", { prompt });
  };

  return (
    <section className="bg-gradient-to-b from-[#0a0a0a] to-[#111] py-12 border-y border-white/10">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
          
          {/* Left: Jake Avatar & Intro */}
          <div className="flex-shrink-0 text-center lg:text-left">
            <JakeAvatar 
              size="homepage" 
              showGlow 
              showOnlineIndicator 
              className="shadow-2xl shadow-red-500/30 mx-auto lg:mx-0"
            />
            
            <div className="mt-4">
              <h3 className="text-white font-bold text-xl">Meet Jake</h3>
              <p className="text-white/50 text-sm">Your Fitment Expert</p>
            </div>
          </div>

          {/* Center: Main CTA */}
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Not sure what fits?{" "}
              <span className="text-red-500">Ask Jake.</span>
            </h2>
            <p className="text-white/60 max-w-lg mb-6">
              Jake is our fitment expert, available 24/7 to help you. Tell him your vehicle and 
              what you're looking for — he'll recommend the right tires, wheels, or complete packages.
            </p>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start mb-6">
              {QUICK_PROMPTS.map((prompt) => (
                <Link
                  key={prompt.text}
                  href={`/jake?q=${encodeURIComponent(prompt.text)}`}
                  onClick={() => handlePromptClick(prompt.text)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-white/80 hover:text-white text-sm transition-all"
                >
                  "{prompt.text}"
                </Link>
              ))}
            </div>

            {/* Main CTA Button */}
            <Link
              href="/jake"
              onClick={handleAskJake}
              className="inline-flex items-center gap-3 px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-xl transition-all hover:scale-[1.02] shadow-lg shadow-red-500/30"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Ask Jake Now
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Right: What Jake Helps With */}
          <div className="hidden xl:block flex-shrink-0 w-64">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Jake helps with:</p>
            <ul className="space-y-2">
              {[
                { icon: "🔧", text: "Tire recommendations" },
                { icon: "⚫", text: "Wheel packages" },
                { icon: "📏", text: "Fitment questions" },
                { icon: "🏔️", text: "Lifted truck setups" },
                { icon: "🏎️", text: "Staggered fitments" },
                { icon: "💰", text: "Budget options" },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2 text-white/70 text-sm">
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE COMPACT BANNER - For use in other pages
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeCompactBanner() {
  return (
    <div className="bg-gradient-to-r from-[#1a1a1a] to-[#111] border border-white/10 rounded-xl p-4 flex items-center gap-4">
      <JakeAvatar size="lg" />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">Need help choosing?</p>
        <p className="text-white/50 text-xs">Ask Jake for personalized recommendations</p>
      </div>
      <Link
        href="/jake"
        onClick={() => trackJakeEvent("jake_opened", { source: "page" })}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap"
      >
        Ask Jake
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE FLOATING BUTTON - Optional floating CTA
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeFloatingButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link
        href="/jake"
        onClick={() => trackJakeEvent("jake_opened", { source: "floating" })}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="flex items-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-lg shadow-red-500/30 transition-all hover:scale-105"
      >
        <JakeAvatar size="sm" />
        <span className={`transition-all duration-300 ${isHovered ? "max-w-[200px] opacity-100" : "max-w-0 opacity-0"} overflow-hidden whitespace-nowrap`}>
          Ask Jake
        </span>
        {!isHovered && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-red-600" />
        )}
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE HEADER LINK - For site header integration
// ═══════════════════════════════════════════════════════════════════════════════

export function JakeHeaderLink() {
  return (
    <Link
      href="/jake"
      onClick={() => trackJakeEvent("jake_opened", { source: "header" })}
      className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-full text-red-400 hover:text-red-300 text-sm font-medium transition-all"
    >
      <JakeAvatar size="xs" />
      <span>Ask Jake</span>
    </Link>
  );
}

export default JakeHomepageSection;
