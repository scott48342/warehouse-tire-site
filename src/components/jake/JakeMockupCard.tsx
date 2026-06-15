"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { trackJakeEvent } from "./JakeAnalytics";

interface JakeMockupCardProps {
  imageUrl: string;
  disclaimer: string;
  vehicle: string;
  wheelStyle: string;
  generationTime?: number;
  cached?: boolean;
  // Conversion CTAs (Phase 3)
  onBuildSetup?: () => void;
  onAddToCart?: () => void;
  onSaveBuild?: () => void;
  onMakeChanges?: () => void;
  // Legacy actions
  onSave?: () => void;
  onShare?: () => void;
}

export function JakeMockupCard({
  imageUrl,
  disclaimer,
  vehicle,
  wheelStyle,
  generationTime,
  cached,
  onBuildSetup,
  onAddToCart,
  onSaveBuild,
  onMakeChanges,
  onSave,
  onShare,
}: JakeMockupCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Track mockup viewed on mount
  useEffect(() => {
    trackJakeEvent("mockup_viewed", {
      vehicle,
      wheelStyle,
      mockupGenerationTime: generationTime,
      mockupCacheHit: cached,
    });
  }, [vehicle, wheelStyle, generationTime, cached]);
  
  if (imageError) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-white/50 text-sm">Failed to load mockup image</p>
      </div>
    );
  }
  
  const handleBuildSetup = () => {
    trackJakeEvent("mockup_build_this", { vehicle, wheelStyle });
    onBuildSetup?.();
  };
  
  const handleAddToCart = () => {
    trackJakeEvent("mockup_to_cart", { vehicle, wheelStyle });
    onAddToCart?.();
  };
  
  const handleSaveBuild = () => {
    trackJakeEvent("mockup_saved", { vehicle, wheelStyle });
    onSaveBuild?.();
    onSave?.();
  };
  
  const handleMakeChanges = () => {
    trackJakeEvent("mockup_make_changes", { vehicle, wheelStyle });
    onMakeChanges?.();
  };
  
  const handleShare = () => {
    trackJakeEvent("mockup_shared", { vehicle, wheelStyle });
    if (imageUrl) {
      navigator.clipboard.writeText(imageUrl);
    }
    onShare?.();
  };
  
  return (
    <div className="rounded-2xl bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 overflow-hidden">
      {/* Image */}
      <div 
        className="relative aspect-video cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        {/* Loading skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-red-500 rounded-full animate-spin mx-auto mb-2" />
              <span className="text-white/40 text-xs">Loading mockup...</span>
            </div>
          </div>
        )}
        
        <Image
          src={imageUrl}
          alt={`${wheelStyle} on ${vehicle}`}
          fill
          className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-sm font-medium">Click to enlarge</span>
        </div>
        
        {/* Visual Inspiration badge */}
        <div className="absolute top-2 left-2">
          <span className="bg-amber-500/90 backdrop-blur-sm text-black text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">
            🎨 Visual Mockup
          </span>
        </div>
        
        {/* Cache indicator (subtle) */}
        {cached && (
          <div className="absolute top-2 right-2">
            <span className="bg-green-500/80 backdrop-blur-sm text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
              ⚡ Instant
            </span>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-4">
        <div className="text-white font-semibold text-sm mb-1">{vehicle}</div>
        <div className="text-white/70 text-xs mb-3">{wheelStyle}</div>
        
        {/* Disclaimer (Phase 3) */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-4">
          <p className="text-amber-200/90 text-[11px] leading-relaxed">
            ⚠️ {disclaimer}
          </p>
        </div>
        
        {/* Conversion CTAs (Phase 3) */}
        <div className="space-y-2">
          {/* Primary CTA Row */}
          <div className="flex gap-2">
            {onBuildSetup && (
              <button
                onClick={handleBuildSetup}
                className="flex-1 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-4 py-2.5 text-white text-sm font-bold transition-all shadow-lg hover:shadow-red-500/20 flex items-center justify-center gap-2"
              >
                🔥 Build This Setup
              </button>
            )}
            {onAddToCart && (
              <button
                onClick={handleAddToCart}
                className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 px-4 py-2.5 text-white text-sm font-bold transition-all shadow-lg hover:shadow-green-500/20 flex items-center justify-center gap-2"
              >
                🛒 Add to Cart
              </button>
            )}
          </div>
          
          {/* Secondary Actions Row */}
          <div className="flex gap-2">
            {onSaveBuild && (
              <button
                onClick={handleSaveBuild}
                className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                💾 Save Build
              </button>
            )}
            {onMakeChanges && (
              <button
                onClick={handleMakeChanges}
                className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
              >
                ✏️ Make Changes
              </button>
            )}
            <button
              onClick={handleShare}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              📤 Share
            </button>
          </div>
        </div>
        
        {/* Generation time (subtle) */}
        {generationTime && !cached && (
          <div className="mt-3 text-center">
            <span className="text-white/30 text-[10px]">
              Generated in {(generationTime / 1000).toFixed(1)}s
            </span>
          </div>
        )}
      </div>
      
      {/* Expanded Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white text-sm font-medium"
            >
              ✕ Close
            </button>
            
            {/* Large image */}
            <div className="relative aspect-video rounded-2xl overflow-hidden">
              <Image
                src={imageUrl}
                alt={`${wheelStyle} on ${vehicle}`}
                fill
                className="object-contain"
              />
            </div>
            
            {/* Caption */}
            <div className="mt-4 text-center">
              <div className="text-white font-semibold">{vehicle}</div>
              <div className="text-white/70 text-sm">{wheelStyle}</div>
              <div className="text-amber-300/80 text-xs mt-2">
                ⚠️ Visual inspiration only — actual product may vary
              </div>
            </div>
            
            {/* Modal CTAs */}
            <div className="mt-6 flex justify-center gap-3">
              {onBuildSetup && (
                <button
                  onClick={handleBuildSetup}
                  className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-6 py-3 text-white font-bold transition-all shadow-lg"
                >
                  🔥 Build This Setup
                </button>
              )}
              {onAddToCart && (
                <button
                  onClick={handleAddToCart}
                  className="rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 px-6 py-3 text-white font-bold transition-all shadow-lg"
                >
                  🛒 Add to Cart
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JakeMockupCard;
