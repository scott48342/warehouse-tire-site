"use client";

import Image from "next/image";

interface JakeAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "homepage";
  className?: string;
  showGlow?: boolean;
  showOnlineIndicator?: boolean;
}

const sizeClasses = {
  xs: "w-5 h-5",                    // Header link
  sm: "w-8 h-8",                    // Floating button
  md: "w-10 h-10",                  // Chat header
  lg: "w-12 h-12",                  // Compact banner
  xl: "w-20 h-20",                  // Welcome main
  homepage: "w-24 h-24 lg:w-28 lg:h-28", // Homepage section (responsive)
};

const sizePx = {
  xs: 20,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 80,
  homepage: 112, // Use larger size for quality
};

export function JakeAvatar({ 
  size = "md", 
  className = "",
  showGlow = false,
  showOnlineIndicator = false,
}: JakeAvatarProps) {
  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {/* Glow Effect */}
      {showGlow && (
        <div className="absolute inset-0 blur-2xl opacity-30 bg-red-500 rounded-full scale-150" />
      )}
      
      {/* Avatar Image */}
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden`}>
        <Image
          src="/jake-avatar.png"
          alt="Jake - Your Fitment Expert"
          width={sizePx[size]}
          height={sizePx[size]}
          className="w-full h-full object-cover"
          priority={size === "xl" || size === "homepage"}
        />
      </div>
      
      {/* Online Indicator */}
      {showOnlineIndicator && (
        <div className={`absolute bottom-0 right-0 bg-green-500 rounded-full border-2 border-[#0a0a0a] ${
          size === "xl" || size === "homepage" ? "w-5 h-5 border-4" : size === "lg" ? "w-4 h-4" : "w-3 h-3"
        }`} />
      )}
    </div>
  );
}

export default JakeAvatar;
