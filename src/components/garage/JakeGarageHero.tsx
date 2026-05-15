"use client";

import React, { useState } from "react";
import { JakeAvatar } from "@/components/jake/JakeAvatar";

// ═══════════════════════════════════════════════════════════════════════════════
// JAKE GARAGE HERO - Landing Experience
// ═══════════════════════════════════════════════════════════════════════════════

interface ExamplePrompt {
  text: string;
  icon: string;
}

interface JakeGarageHeroProps {
  examplePrompts: ExamplePrompt[];
  onStart: (prompt: string) => void;
}

export function JakeGarageHero({ examplePrompts, onStart }: JakeGarageHeroProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onStart(input.trim());
    }
  };

  const handlePromptClick = (prompt: string) => {
    onStart(prompt);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0a] to-[#0f0f0f]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-transparent to-transparent" />
      
      {/* Subtle Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        
        {/* Jake Avatar with Glow */}
        <div className="relative mb-8">
          <JakeAvatar 
            size="homepage" 
            showGlow={true} 
            showOnlineIndicator={true} 
            animated={true}
          />
        </div>

        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight">
            Jake <span className="text-red-500">Garage</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 max-w-lg mx-auto">
            Build your perfect wheel & tire setup with Jake.
          </p>
        </div>

        {/* Main Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
          <div className="relative group">
            {/* Input Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600/50 via-red-500/50 to-red-600/50 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            
            <div className="relative flex items-center bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden focus-within:border-red-500/50 transition-colors">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell Jake what you drive or what look you want..."
                className="flex-1 bg-transparent px-6 py-5 text-lg text-white placeholder-white/40 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="m-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-500/25"
              >
                <span className="hidden md:inline">Start Building</span>
                <span className="md:hidden">→</span>
              </button>
            </div>
          </div>
        </form>

        {/* Example Prompts */}
        <div className="w-full max-w-3xl">
          <p className="text-white/40 text-sm text-center mb-4">Try one of these:</p>
          <div className="flex flex-wrap justify-center gap-2 md:gap-3">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handlePromptClick(prompt.text)}
                className="group px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full text-sm text-white/70 hover:text-white transition-all flex items-center gap-2"
              >
                <span className="text-base">{prompt.icon}</span>
                <span>{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-white/30 text-sm">
          Powered by{" "}
          <a 
            href="https://shop.warehousetiredirect.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/50 hover:text-red-400 transition-colors"
          >
            Warehouse Tire Direct
          </a>
        </p>
      </footer>
    </div>
  );
}
