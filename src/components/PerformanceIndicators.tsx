/**
 * Performance Indicators for Tire Cards
 * 
 * Displays simple bar ratings (1-10 style) derived from UTQG + category.
 * Similar to Belle Tire's performance ratings display.
 */

import React from "react";
import type { PerformanceRatings } from "@/lib/tires/tireSpecs";

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceIndicatorsProps {
  /** Performance ratings object */
  ratings: PerformanceRatings | null;
  /** Which ratings to show (default: primary 4) */
  show?: ('treadLife' | 'wetTraction' | 'dryTraction' | 'comfort' | 'noise' | 'offRoad' | 'winter')[];
  /** Compact mode for card view */
  compact?: boolean;
  /** Show labels */
  showLabels?: boolean;
  /** Show numeric values */
  showValues?: boolean;
}

// ============================================================================
// RATING BAR
// ============================================================================

interface RatingBarProps {
  /** Rating name */
  label: string;
  /** Rating value 1-10 */
  value: number;
  /** Color based on rating */
  color?: 'auto' | 'green' | 'amber' | 'red' | 'blue';
  /** Compact mode */
  compact?: boolean;
  /** Show numeric value */
  showValue?: boolean;
}

function RatingBar({ 
  label, 
  value, 
  color = 'auto',
  compact = false,
  showValue = true,
}: RatingBarProps) {
  // Determine color based on value or explicit color - using gradients for premium feel
  const getBarColor = () => {
    if (color !== 'auto') {
      switch (color) {
        case 'green': return 'bg-gradient-to-r from-green-500 to-emerald-400';
        case 'amber': return 'bg-gradient-to-r from-amber-500 to-yellow-400';
        case 'red': return 'bg-gradient-to-r from-red-500 to-rose-400';
        case 'blue': return 'bg-gradient-to-r from-blue-500 to-cyan-400';
      }
    }
    
    // Auto color based on value - premium gradients
    if (value >= 8) return 'bg-gradient-to-r from-green-500 to-emerald-400';
    if (value >= 6) return 'bg-gradient-to-r from-blue-500 to-cyan-400';
    if (value >= 4) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-red-400 to-rose-300';
  };
  
  const percentage = Math.max(0, Math.min(100, value * 10));
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-neutral-600 w-16 truncate">
          {label}
        </span>
        <div className="flex-1 h-2.5 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-300 ease-out ${getBarColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showValue && (
          <span className="text-[10px] font-bold text-neutral-800 w-5 text-right">
            {value}
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-neutral-700 w-24 truncate">
        {label}
      </span>
      <div className="flex-1 h-3 bg-neutral-100 rounded-full overflow-hidden shadow-inner">
        <div 
          className={`h-full rounded-full transition-all duration-300 ease-out ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showValue && (
        <span className="text-xs font-bold text-neutral-900 w-6 text-right">
          {value}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// RATING LABELS
// ============================================================================

const RATING_LABELS: Record<string, string> = {
  treadLife: 'Tread Life',
  wetTraction: 'Wet Traction',
  dryTraction: 'Dry Traction',
  comfort: 'Ride Comfort',
  noise: 'Noise',
  offRoad: 'Off-Road',
  winter: 'Winter',
  overall: 'Overall',
};

const RATING_LABELS_SHORT: Record<string, string> = {
  treadLife: 'Tread',
  wetTraction: 'Wet',
  dryTraction: 'Dry',
  comfort: 'Comfort',
  noise: 'Noise',
  offRoad: 'Off-Road',
  winter: 'Winter',
  overall: 'Overall',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PerformanceIndicators({
  ratings,
  show = ['treadLife', 'wetTraction', 'comfort', 'winter'],
  compact = false,
  showLabels = true,
  showValues = true,
}: PerformanceIndicatorsProps) {
  if (!ratings) return null;
  
  const labels = compact ? RATING_LABELS_SHORT : RATING_LABELS;
  
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {show.map((key) => {
        const value = ratings[key as keyof PerformanceRatings];
        if (typeof value !== 'number') return null;
        
        return (
          <RatingBar
            key={key as string}
            label={showLabels ? labels[key as string] || key : ''}
            value={value}
            compact={compact}
            showValue={showValues}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// MINI RATINGS (for card summary)
// ============================================================================

export interface MiniRatingsProps {
  /** Performance ratings */
  ratings: PerformanceRatings | null;
  /** Category to highlight relevant ratings */
  category?: string | null;
}

export function MiniRatings({ ratings, category }: MiniRatingsProps) {
  if (!ratings) return null;
  
  // Choose 3 most relevant ratings based on category
  let keys: (keyof PerformanceRatings)[] = ['treadLife', 'wetTraction', 'comfort'];
  
  switch (category) {
    case 'All-Terrain':
    case 'Mud-Terrain':
    case 'Rugged-Terrain':
    case 'Off-Road':
      keys = ['offRoad', 'treadLife', 'wetTraction'];
      break;
    case 'Winter':
      keys = ['winter', 'wetTraction', 'treadLife'];
      break;
    case 'Performance':
    case 'Summer':
      keys = ['dryTraction', 'wetTraction', 'comfort'];
      break;
    case 'Highway/Touring':
      keys = ['comfort', 'noise', 'treadLife'];
      break;
  }
  
  // Get bar color based on value - subtle premium colors
  const getBarColor = (value: number) => {
    if (value >= 8) return 'bg-green-500';
    if (value >= 6) return 'bg-blue-500';
    if (value >= 4) return 'bg-amber-500';
    return 'bg-red-400';
  };
  
  return (
    <div className="flex flex-col gap-2">
      {keys.map((key) => {
        const value = ratings[key as keyof PerformanceRatings];
        if (typeof value !== 'number') return null;
        
        const label = RATING_LABELS_SHORT[key as string] || key;
        const percentage = Math.max(0, Math.min(100, value * 10));
        
        return (
          <div 
            key={key as string} 
            className="flex items-center gap-2"
            title={`${RATING_LABELS[key as string]}: ${value}/10`}
          >
            <span className="text-[10px] font-medium text-neutral-500 w-14 shrink-0">{label}</span>
            <div className="flex-1 h-[5px] bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${getBarColor(value)}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-neutral-500 w-4 text-right shrink-0">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// FULL RATINGS CARD (for PDP)
// ============================================================================

export interface FullRatingsCardProps {
  /** Performance ratings */
  ratings: PerformanceRatings;
  /** Optional title */
  title?: string;
}

export function FullRatingsCard({ 
  ratings,
  title = 'Performance Ratings',
}: FullRatingsCardProps) {
  const allKeys: (keyof PerformanceRatings)[] = [
    'treadLife', 'wetTraction', 'dryTraction', 'comfort', 'noise', 'offRoad', 'winter'
  ];
  
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
        <div className="flex items-center gap-1">
          <span className="text-lg font-extrabold text-neutral-900">{ratings.overall}</span>
          <span className="text-xs text-neutral-500">/10</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {allKeys.map((key) => (
          <RatingBar
            key={key}
            label={RATING_LABELS[key]}
            value={ratings[key]}
            showValue={true}
          />
        ))}
      </div>
      
      <p className="mt-3 text-[10px] text-neutral-400">
        Ratings derived from UTQG specifications and tire category
      </p>
    </div>
  );
}

// ============================================================================
// UTQG DISPLAY
// ============================================================================

export interface UTQGDisplayProps {
  /** Raw UTQG string */
  utqg: string | null;
  /** Parsed treadwear */
  treadwear?: number | null;
  /** Parsed traction grade */
  traction?: string | null;
  /** Parsed temperature grade */
  temperature?: string | null;
  /** Compact mode */
  compact?: boolean;
}

export function UTQGDisplay({
  utqg,
  treadwear,
  traction,
  temperature,
  compact = false,
}: UTQGDisplayProps) {
  if (!utqg && !treadwear && !traction && !temperature) return null;
  
  if (compact) {
    // Show just the raw UTQG string
    return (
      <span className="text-[10px] font-mono text-neutral-500">
        UTQG: {utqg || `${treadwear || '?'}${traction || '?'}${temperature || '?'}`}
      </span>
    );
  }
  
  return (
    <div className="flex items-center gap-3 text-xs">
      {treadwear && (
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900">{treadwear}</div>
          <div className="text-[10px] text-neutral-500">Treadwear</div>
        </div>
      )}
      {traction && (
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900">{traction}</div>
          <div className="text-[10px] text-neutral-500">Traction</div>
        </div>
      )}
      {temperature && (
        <div className="text-center">
          <div className="text-lg font-bold text-neutral-900">{temperature}</div>
          <div className="text-[10px] text-neutral-500">Temperature</div>
        </div>
      )}
    </div>
  );
}
