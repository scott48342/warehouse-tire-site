"use client";

import Image from "next/image";

interface JakeAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "homepage";
  className?: string;
  showGlow?: boolean;
  showOnlineIndicator?: boolean;
  animated?: boolean; // Enable pulse/glow animations
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
  animated = true,
}: JakeAvatarProps) {
  const isLarge = size === "xl" || size === "homepage";
  
  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {/* Animated Glow Effect */}
      {showGlow && (
        <div 
          className={`absolute inset-0 bg-red-500 rounded-full scale-150 ${
            animated 
              ? "animate-[glow-pulse_3s_ease-in-out_infinite] blur-2xl" 
              : "blur-2xl opacity-30"
          }`}
          style={animated ? {
            animation: "glow-pulse 3s ease-in-out infinite",
          } : undefined}
        />
      )}
      
      {/* Pulsing Ring */}
      {animated && isLarge && (
        <>
          <div 
            className="absolute inset-0 rounded-full border-2 border-red-500/40"
            style={{
              animation: "ring-pulse 2.5s ease-out infinite",
            }}
          />
          <div 
            className="absolute inset-0 rounded-full border border-red-500/20"
            style={{
              animation: "ring-pulse 2.5s ease-out infinite 0.5s",
            }}
          />
        </>
      )}
      
      {/* Avatar Image */}
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden ring-2 ring-red-500/30`}>
        <Image
          src="/jake-avatar.png"
          alt="Jake - Your Fitment Expert"
          width={sizePx[size]}
          height={sizePx[size]}
          className="w-full h-full object-cover"
          priority={size === "xl" || size === "homepage"}
        />
      </div>
      
      {/* Online Indicator with Pulse */}
      {showOnlineIndicator && (
        <div className={`absolute bottom-0 right-0 ${
          isLarge ? "w-5 h-5" : size === "lg" ? "w-4 h-4" : "w-3 h-3"
        }`}>
          {/* Pulse ring */}
          {animated && (
            <div 
              className="absolute inset-0 bg-green-500 rounded-full"
              style={{
                animation: "online-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
          )}
          {/* Solid dot */}
          <div className={`relative w-full h-full bg-green-500 rounded-full border-2 ${
            isLarge ? "border-4" : "border-2"
          } border-[#0a0a0a]`} />
        </div>
      )}
      
      {/* CSS Animations */}
      <style jsx>{`
        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1.4);
          }
          50% {
            opacity: 0.35;
            transform: scale(1.6);
          }
        }
        
        @keyframes ring-pulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }
        
        @keyframes online-ping {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default JakeAvatar;
