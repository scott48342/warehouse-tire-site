"use client";

import { useState } from "react";
import Image from "next/image";

interface JakeMockupCardProps {
  imageUrl: string;
  disclaimer: string;
  vehicle: string;
  wheelStyle: string;
  onSave?: () => void;
  onShare?: () => void;
}

export function JakeMockupCard({
  imageUrl,
  disclaimer,
  vehicle,
  wheelStyle,
  onSave,
  onShare,
}: JakeMockupCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (imageError) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <p className="text-white/50 text-sm">Failed to load mockup image</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Image */}
      <div 
        className="relative aspect-video cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <Image
          src={imageUrl}
          alt={`${wheelStyle} on ${vehicle}`}
          fill
          className="object-cover"
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
      </div>
      
      {/* Info */}
      <div className="p-4">
        <div className="text-white font-semibold text-sm mb-1">{vehicle}</div>
        <div className="text-white/70 text-xs mb-3">{wheelStyle}</div>
        
        {/* Disclaimer */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-3">
          <p className="text-amber-200/90 text-[11px] leading-relaxed">
            ⚠️ {disclaimer}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={onSave}
              className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white text-xs font-medium transition-colors"
            >
              💾 Save
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white text-xs font-medium transition-colors"
            >
              📤 Share
            </button>
          )}
        </div>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default JakeMockupCard;
