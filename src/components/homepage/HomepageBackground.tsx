"use client";

import { useState, useEffect } from "react";

/**
 * Homepage Background Wrapper
 * Provides continuous dark cinematic background throughout the page
 * Rotates through garage/showroom backgrounds on each page load
 */

const HERO_BACKGROUNDS = [
  "/images/homepage/hero-garage-01.jpg",
  "/images/homepage/hero-garage-02.jpg",
  "/images/homepage/hero-garage-03.jpg",
  "/images/homepage/hero-garage-04.jpg",
  "/images/homepage/hero-garage-05.jpg",
  "/images/homepage/hero-garage-06.jpg",
];

interface HomepageBackgroundProps {
  children: React.ReactNode;
}

export function HomepageBackground({ children }: HomepageBackgroundProps) {
  const [bgImage, setBgImage] = useState(HERO_BACKGROUNDS[0]);
  
  useEffect(() => {
    // Random background on mount
    const randomBg = HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)];
    setBgImage(randomBg);
  }, []);

  return (
    <div className="relative min-h-screen bg-neutral-950">
      {/* Fixed background image layer */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
        style={{
          backgroundImage: `url('${bgImage}')`,
        }}
      />
      
      {/* Dark gradient overlay for readability - lighter for new images */}
      <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />
      
      {/* Additional texture overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-transparent via-black/10 to-black/30" />

      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
