"use client";

/**
 * Tire PDP Conversion Enhancements - PHASE 2
 * 
 * ADDITIVE components to boost trust and conversion on tire PDPs.
 * These components are designed to:
 * - Degrade gracefully if data is missing
 * - Not interfere with existing cart/fitment logic
 * - Match the existing design system
 * - Be mobile-first responsive
 * 
 * @created 2026-04-06
 * @updated 2026-04-06 - Phase 2 Conversion Upgrade
 */

import { useState } from "react";

// ============================================================================
// SECTION 1: ABOVE THE FOLD ENHANCEMENTS
// ============================================================================

/**
 * "Best For" Micro Section - UPGRADED
 * Shows 2-3 key use cases + "Ideal for" guidance line
 */
export type TireCategory = 
  | 'All-Season' 
  | 'All-Weather' 
  | 'All-Terrain' 
  | 'Mud-Terrain'
  | 'Highway/Touring'
  | 'Performance'
  | 'Summer'
  | 'Winter'
  | 'Rugged-Terrain'
  | null;

interface BestForMicroProps {
  category: TireCategory;
  mileageWarranty?: number | null;
  isRunFlat?: boolean;
}

export function BestForMicro({ category, mileageWarranty, isRunFlat }: BestForMicroProps) {
  const traits = getBestForTraits(category, mileageWarranty, isRunFlat);
  const idealFor = getIdealForLine(category, mileageWarranty);
  
  if (traits.length === 0 && !idealFor) return null;
  
  return (
    <div className="space-y-1">
      {/* Primary traits line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-700">
        <span className="text-neutral-500 font-medium">Best for:</span>
        {traits.map((trait, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="text-green-600 text-xs">•</span>
            <span>{trait}</span>
          </span>
        ))}
      </div>
      
      {/* Ideal for guidance line - PHASE 2 ADDITION */}
      {idealFor && (
        <div className="text-[13px] text-neutral-600 italic pl-0.5">
          {idealFor}
        </div>
      )}
    </div>
  );
}

function getBestForTraits(
  category: TireCategory, 
  mileageWarranty?: number | null,
  isRunFlat?: boolean
): string[] {
  const traits: string[] = [];
  
  switch (category) {
    case 'All-Season':
      traits.push('Daily driving');
      if (mileageWarranty && mileageWarranty >= 60000) traits.push('Long tread life');
      else traits.push('Year-round use');
      traits.push('Quiet ride');
      break;
    case 'All-Weather':
      traits.push('Year-round use', 'Light snow', 'No seasonal swaps');
      break;
    case 'All-Terrain':
      traits.push('Trucks & SUVs', 'Light off-road', 'Highway comfort');
      break;
    case 'Mud-Terrain':
      traits.push('Serious off-road', 'Mud & rocks', 'Trail driving');
      break;
    case 'Highway/Touring':
      traits.push('Long highway drives', 'Quiet ride', 'Comfort');
      break;
    case 'Performance':
      traits.push('Spirited driving', 'Sharp handling', 'Track days');
      break;
    case 'Summer':
      traits.push('Warm weather', 'Max dry grip', 'Sports cars');
      break;
    case 'Winter':
      traits.push('Snow & ice', 'Cold weather', 'Safety in winter');
      break;
    case 'Rugged-Terrain':
      traits.push('Heavy-duty use', 'Work trucks', 'Durability');
      break;
    default:
      traits.push('Daily driving', 'Balanced performance');
  }
  
  return traits.slice(0, 3);
}

/** PHASE 2: "Ideal for" guidance line based on category */
function getIdealForLine(category: TireCategory, mileageWarranty?: number | null): string | null {
  switch (category) {
    case 'All-Season':
      return mileageWarranty && mileageWarranty >= 60000
        ? "Ideal for: Drivers who want a smooth, low-noise commute with fewer replacements"
        : "Ideal for: Drivers who want reliable all-weather grip without seasonal swaps";
    case 'All-Weather':
      return "Ideal for: Drivers in snow regions who want one tire for all seasons";
    case 'All-Terrain':
      return "Ideal for: Truck and SUV owners who split time between pavement and trails";
    case 'Mud-Terrain':
      return "Ideal for: Off-road enthusiasts who tackle serious terrain regularly";
    case 'Highway/Touring':
      return "Ideal for: Long-distance drivers who prioritize comfort and quiet";
    case 'Performance':
      return "Ideal for: Enthusiasts who want responsive handling and grip";
    case 'Summer':
      return "Ideal for: Performance car owners in warm climates";
    case 'Winter':
      return "Ideal for: Drivers who face harsh winter conditions regularly";
    case 'Rugged-Terrain':
      return "Ideal for: Work truck owners who need durability on and off the job";
    default:
      return null;
  }
}

/**
 * Enhanced Trust Strip - UPGRADED
 * Shows key trust signals under the price
 */
interface EnhancedTrustStripProps {
  hasVehicle: boolean;
  hasWarranty?: boolean;
}

export function EnhancedTrustStrip({ hasVehicle, hasWarranty = true }: EnhancedTrustStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-green-700 py-2 border-t border-green-200/50 mt-3">
      {hasVehicle && (
        <span className="inline-flex items-center gap-1">
          <span>✔</span>
          <span>Verified fit for your vehicle</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span>✔</span>
        <span>Ships fast from trusted suppliers</span>
      </span>
      {hasWarranty && (
        <span className="inline-flex items-center gap-1">
          <span>✔</span>
          <span>Backed by manufacturer warranty</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span>✔</span>
        <span>Support team available if you need help</span>
      </span>
    </div>
  );
}

/**
 * Review Summary for PDP
 * 
 * IMPORTANT: Returns null if no valid review data exists.
 * Does NOT show fake placeholders in production.
 * When real review data is available, pass it via props.
 */
interface ReviewSummaryProps {
  /** Rating from 1-5 */
  rating?: number | null;
  /** Number of reviews */
  reviewCount?: number | null;
  /** Additional CSS classes */
  className?: string;
}

export function ReviewSummary({ rating, reviewCount, className = '' }: ReviewSummaryProps) {
  // NO DATA = HIDE GRACEFULLY
  // This is intentional - we don't show fake reviews in production
  if (!rating || rating <= 0 || !reviewCount || reviewCount <= 0) {
    return null;
  }
  
  const stars = Math.round(rating * 2) / 2; // Round to nearest 0.5
  
  // Format the review count for display
  const formattedCount = reviewCount >= 1000 
    ? `${(reviewCount / 1000).toFixed(1)}K` 
    : `${reviewCount}`;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <span 
            key={star} 
            className={`text-sm ${
              star <= Math.floor(stars) ? 'text-yellow-500' : 
              star - 0.5 === stars ? 'text-yellow-400' : 
              'text-neutral-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-sm font-semibold text-neutral-900">{rating.toFixed(1)}</span>
      <span className="text-sm text-neutral-500">
        ({formattedCount} reviews)
      </span>
    </div>
  );
}

// ============================================================================
// SECTION 2: DECISION SUPPORT - PHASE 2 UPGRADES
// ============================================================================

/**
 * "Why Choose This Tire?" Section - PHASE 2 STRUCTURED FORMAT
 * Bullet format, max 3 bullets, no fluff
 */
interface WhyChooseThisTireProps {
  category: TireCategory;
  mileageWarranty?: number | null;
  isRunFlat?: boolean;
  has3PMSF?: boolean;
}

export function WhyChooseThisTire({ category, mileageWarranty, isRunFlat, has3PMSF }: WhyChooseThisTireProps) {
  const bullets = getWhyChooseBullets(category, mileageWarranty, isRunFlat, has3PMSF);
  
  if (bullets.length === 0) return null;
  
  return (
    <div className="rounded-xl bg-gradient-to-br from-neutral-50 to-white border border-neutral-100 px-4 py-3">
      <div className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-1.5">
        <span>💡</span>
        Why choose this tire?
      </div>
      <ul className="space-y-1.5">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
            <span className="text-green-600 text-xs mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getWhyChooseBullets(
  category: TireCategory,
  mileageWarranty?: number | null,
  isRunFlat?: boolean,
  has3PMSF?: boolean
): string[] {
  const bullets: string[] = [];
  
  // Category-specific primary benefits
  switch (category) {
    case 'All-Season':
      bullets.push('Long-lasting tread designed for daily driving');
      bullets.push('Reliable grip in wet and dry conditions');
      bullets.push('Comfortable, quiet ride for highway use');
      break;
    case 'All-Weather':
      bullets.push('3-peak rated for real winter conditions');
      bullets.push('Year-round use without seasonal swaps');
      bullets.push('Confident grip from summer heat to winter cold');
      break;
    case 'All-Terrain':
      bullets.push('Off-road capable without sacrificing highway comfort');
      bullets.push('Reinforced sidewalls for trail protection');
      bullets.push('Quieter on-road than traditional A/T tires');
      break;
    case 'Mud-Terrain':
      bullets.push('Aggressive tread clears mud and debris fast');
      bullets.push('Built to handle rocks, sand, and trail obstacles');
      bullets.push('Serious off-road capability when you need it');
      break;
    case 'Highway/Touring':
      bullets.push('Whisper-quiet cabin for long highway drives');
      bullets.push('Extended tread life for cost-conscious drivers');
      bullets.push('Smooth, comfortable ride mile after mile');
      break;
    case 'Performance':
      bullets.push('Responsive handling for spirited driving');
      bullets.push('Superior grip through corners and curves');
      bullets.push('Track-ready performance for enthusiasts');
      break;
    case 'Summer':
      bullets.push('Maximum dry grip for warm weather performance');
      bullets.push('Confident wet braking above 45°F');
      bullets.push('Optimized for sports cars and performance vehicles');
      break;
    case 'Winter':
      bullets.push('Specialized compound stays flexible in freezing temps');
      bullets.push('Biting edges grip ice and packed snow');
      bullets.push('Purpose-built for cold weather safety');
      break;
    case 'Rugged-Terrain':
      bullets.push('Heavy-duty construction for work truck demands');
      bullets.push('Puncture-resistant sidewalls handle job sites');
      bullets.push('Smooth enough for daily highway driving');
      break;
    default:
      bullets.push('Reliable grip in everyday conditions');
      bullets.push('Quality construction from a trusted brand');
      bullets.push('Backed by manufacturer warranty');
  }
  
  // Override third bullet with warranty if impressive
  if (mileageWarranty && mileageWarranty >= 60000) {
    bullets[2] = `${Math.round(mileageWarranty/1000)}K mile warranty backs up the quality`;
  }
  
  // Override with run-flat if applicable
  if (isRunFlat) {
    bullets[2] = 'Run-flat tech lets you drive to safety if punctured';
  }
  
  return bullets.slice(0, 3);
}

/**
 * "Good / Better / Best" Context - PHASE 2 NEW
 * Subtle comparison hint based on category
 */
interface ComparisonContextProps {
  category: TireCategory;
  mileageWarranty?: number | null;
}

export function ComparisonContext({ category, mileageWarranty }: ComparisonContextProps) {
  const lines = getComparisonLines(category, mileageWarranty);
  
  if (lines.length === 0) return null;
  
  return (
    <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-3 py-2">
      <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-1">
        Compared to similar tires
      </div>
      <ul className="space-y-0.5">
        {lines.map((line, i) => (
          <li key={i} className="text-xs text-blue-700 flex items-center gap-1.5">
            <span className="text-blue-500">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getComparisonLines(category: TireCategory, mileageWarranty?: number | null): string[] {
  const lines: string[] = [];
  
  switch (category) {
    case 'All-Season':
      if (mileageWarranty && mileageWarranty >= 70000) {
        lines.push('Better tread life than most all-season options');
        lines.push('Comparable comfort to premium touring tires');
      } else if (mileageWarranty && mileageWarranty >= 50000) {
        lines.push('Solid tread life for the price point');
        lines.push('Quieter ride than budget alternatives');
      } else {
        lines.push('Good value for everyday driving');
        lines.push('Reliable all-season performance');
      }
      break;
    case 'All-Weather':
      lines.push('Better snow traction than standard all-season');
      lines.push('More versatile than dedicated winter tires');
      break;
    case 'All-Terrain':
      lines.push('Quieter highway ride than aggressive A/T tires');
      lines.push('More capable off-road than highway tires');
      break;
    case 'Mud-Terrain':
      lines.push('More aggressive than all-terrain options');
      lines.push('Built for serious trail use');
      break;
    case 'Highway/Touring':
      lines.push('Quieter than standard all-season tires');
      lines.push('Better long-distance comfort');
      break;
    case 'Performance':
      lines.push('Sharper handling than touring tires');
      lines.push('Better grip than all-season alternatives');
      break;
    case 'Summer':
      lines.push('Superior dry grip to all-season options');
      lines.push('Designed for performance in warm conditions');
      break;
    case 'Winter':
      lines.push('Far better snow traction than all-season');
      lines.push('Purpose-built compound for cold temps');
      break;
    case 'Rugged-Terrain':
      lines.push('More durable than standard truck tires');
      lines.push('Better for work sites than highway tires');
      break;
    default:
      return [];
  }
  
  return lines.slice(0, 2);
}

/**
 * Performance Snapshot with ENHANCED LABELS - PHASE 2
 * Star ratings with descriptive text
 */
interface EnhancedPerformanceSnapshotProps {
  ratings: {
    treadLife?: number;
    comfort?: number;
    wetGrip?: number;
    quietRide?: number;
    dryGrip?: number;
    snow?: number;
    offRoad?: number;
  };
  category?: TireCategory;
}

export function EnhancedPerformanceSnapshot({ ratings, category }: EnhancedPerformanceSnapshotProps) {
  const displayRatings = getEnhancedDisplayRatings(ratings, category);
  
  if (displayRatings.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
        <span>📊</span>
        Performance Ratings
      </h3>
      
      <div className="space-y-3">
        {displayRatings.map(({ label, value, description }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-neutral-700">{label}</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span 
                      key={star} 
                      className={`text-sm ${star <= value ? 'text-yellow-500' : 'text-neutral-200'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                {/* PHASE 2: Descriptive label */}
                <span className="text-xs text-neutral-500">({description})</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getEnhancedDisplayRatings(
  ratings: EnhancedPerformanceSnapshotProps['ratings'],
  category?: TireCategory
): { label: string; value: number; description: string }[] {
  const result: { label: string; value: number; description: string }[] = [];
  
  // Helper to get description based on value
  const getDescription = (type: string, value: number): string => {
    const descriptions: Record<string, Record<number, string>> = {
      treadLife: { 5: 'Long-lasting', 4: 'Above average', 3: 'Average', 2: 'Below average', 1: 'Limited' },
      comfort: { 5: 'Smooth ride', 4: 'Comfortable', 3: 'Standard', 2: 'Firm', 1: 'Stiff' },
      wetGrip: { 5: 'Excellent in rain', 4: 'Reliable in rain', 3: 'Adequate', 2: 'Fair', 1: 'Use caution' },
      dryGrip: { 5: 'Maximum grip', 4: 'Strong grip', 3: 'Good grip', 2: 'Standard', 1: 'Limited' },
      offRoad: { 5: 'Trail ready', 4: 'Capable', 3: 'Light trails', 2: 'Mild', 1: 'Pavement only' },
      snow: { 5: 'Winter ready', 4: 'Snow capable', 3: 'Light snow', 2: 'Fair', 1: 'Not recommended' },
    };
    return descriptions[type]?.[Math.min(5, Math.max(1, value))] || 'Good';
  };
  
  // Select ratings based on category
  switch (category) {
    case 'All-Terrain':
    case 'Mud-Terrain':
    case 'Rugged-Terrain':
      if (ratings.offRoad) result.push({ label: 'Off-Road', value: Math.min(5, Math.round(ratings.offRoad / 2)), description: getDescription('offRoad', Math.min(5, Math.round(ratings.offRoad / 2))) });
      if (ratings.treadLife) result.push({ label: 'Tread Life', value: Math.min(5, Math.round(ratings.treadLife / 2)), description: getDescription('treadLife', Math.min(5, Math.round(ratings.treadLife / 2))) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)), description: getDescription('wetGrip', Math.min(5, Math.round(ratings.wetGrip / 2))) });
      break;
    case 'Winter':
      if (ratings.snow) result.push({ label: 'Snow Grip', value: Math.min(5, Math.round(ratings.snow / 2)), description: getDescription('snow', Math.min(5, Math.round(ratings.snow / 2))) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)), description: getDescription('wetGrip', Math.min(5, Math.round(ratings.wetGrip / 2))) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)), description: getDescription('comfort', Math.min(5, Math.round(ratings.comfort / 2))) });
      break;
    case 'Performance':
    case 'Summer':
      if (ratings.dryGrip) result.push({ label: 'Dry Grip', value: Math.min(5, Math.round(ratings.dryGrip / 2)), description: getDescription('dryGrip', Math.min(5, Math.round(ratings.dryGrip / 2))) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)), description: getDescription('wetGrip', Math.min(5, Math.round(ratings.wetGrip / 2))) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)), description: getDescription('comfort', Math.min(5, Math.round(ratings.comfort / 2))) });
      break;
    default:
      if (ratings.treadLife) result.push({ label: 'Tread Life', value: Math.min(5, Math.round(ratings.treadLife / 2)), description: getDescription('treadLife', Math.min(5, Math.round(ratings.treadLife / 2))) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)), description: getDescription('comfort', Math.min(5, Math.round(ratings.comfort / 2))) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)), description: getDescription('wetGrip', Math.min(5, Math.round(ratings.wetGrip / 2))) });
  }
  
  return result.slice(0, 3);
}

// ============================================================================
// SECTION 3: COLLAPSIBLE DETAILS
// ============================================================================

/**
 * Collapsible Section Wrapper
 */
interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, icon, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
      >
        <span className="text-sm font-extrabold text-neutral-900 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </span>
        <span className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      
      {isOpen && (
        <div className="px-5 pb-5 border-t border-neutral-100">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Warranty & Support Section
 */
interface WarrantySupportProps {
  mileageWarranty?: number | null;
  hasRoadHazard?: boolean;
}

export function WarrantySupport({ mileageWarranty, hasRoadHazard = true }: WarrantySupportProps) {
  return (
    <CollapsibleSection title="Warranty & Support" icon="🛡️" defaultOpen={false}>
      <ul className="mt-4 space-y-3">
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
          <span>
            {mileageWarranty && mileageWarranty > 0 
              ? `${mileageWarranty.toLocaleString()} mile manufacturer warranty included`
              : 'Manufacturer warranty included'}
          </span>
        </li>
        {hasRoadHazard && (
          <li className="flex items-start gap-3 text-sm text-neutral-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
            <span>Road hazard protection may be available</span>
          </li>
        )}
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs">✓</span>
          <span>Support team available for fitment help</span>
        </li>
        <li className="flex items-start gap-3 text-sm text-neutral-700">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">📞</span>
          <span>Questions? We're here to help</span>
        </li>
      </ul>
    </CollapsibleSection>
  );
}

// ============================================================================
// SECTION 4: CONVERSION REINFORCEMENT - PHASE 2 UPGRADES
// ============================================================================

/**
 * Final Trust Reminder - UPGRADED
 * Reinforces key trust signals near the CTA
 */
interface FinalTrustReminderProps {
  hasVehicle: boolean;
}

export function FinalTrustReminder({ hasVehicle }: FinalTrustReminderProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-green-800">
        {hasVehicle && (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-green-600">✔</span>
            <span className="font-medium">Verified fit for your vehicle</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-600">✔</span>
          <span className="font-medium">Ships fast from trusted suppliers</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-600">✔</span>
          <span className="font-medium">Backed by manufacturer warranty</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-600">✔</span>
          <span className="font-medium">Support team available if you need help</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Confidence Badge - Popular Choice Signal
 * Social proof / popularity indicator
 */
interface ConfidenceBadgeProps {
  message: string | null;
}

export function ConfidenceBadge({ message }: ConfidenceBadgeProps) {
  if (!message) return null;
  
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
      <span>🔥</span>
      <span className="font-medium">{message}</span>
    </div>
  );
}

/**
 * "What Happens Next" Section - PHASE 2 NEW
 * Reduces post-purchase anxiety
 */
export function WhatHappensNext() {
  return (
    <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
      <div className="text-xs font-bold text-neutral-800 mb-2 flex items-center gap-1.5">
        <span>📦</span>
        What happens after you order?
      </div>
      <ul className="space-y-1.5">
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">1.</span>
          <span>Your tires ship quickly from our network</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">2.</span>
          <span>You'll receive tracking information via email</span>
        </li>
        <li className="flex items-start gap-2 text-sm text-neutral-700">
          <span className="text-neutral-400 text-xs mt-0.5">3.</span>
          <span>Need help? Our team is here for fitment and support</span>
        </li>
      </ul>
    </div>
  );
}

/**
 * Popular Choice Signal - PHASE 2 NEW
 * Light social proof based on category/inventory
 */
interface PopularChoiceSignalProps {
  category: TireCategory;
  quantity?: number;
}

export function PopularChoiceSignal({ category, quantity }: PopularChoiceSignalProps) {
  // Only show if we have a reason to show it
  const message = getPopularChoiceMessage(category, quantity);
  
  if (!message) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50/70 rounded-lg px-3 py-2 border border-amber-100">
      <span>🔥</span>
      <span className="font-medium">{message}</span>
    </div>
  );
}

function getPopularChoiceMessage(category: TireCategory, quantity?: number): string | null {
  // High inventory = popular
  if (quantity && quantity >= 50) {
    return "Popular choice — customers love this tire";
  }
  
  if (quantity && quantity >= 20) {
    return "Frequently purchased in this size";
  }
  
  // Category-based fallback
  switch (category) {
    case 'All-Season':
      return "Popular choice — customers often choose this for daily driving";
    case 'Highway/Touring':
      return "Top pick for long-distance comfort";
    case 'All-Terrain':
      return "Popular with truck and SUV owners";
    case 'Performance':
      return "Enthusiast favorite for spirited driving";
    default:
      return null;
  }
}

// ============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// ============================================================================

// Keep old WhyThisTireSection export for any existing references
interface WhyThisTireSectionProps {
  category: TireCategory;
  mileageWarranty?: number | null;
  benefits: string[];
}

export function WhyThisTireSection({ category, mileageWarranty, benefits }: WhyThisTireSectionProps) {
  const description = getWhyThisTireDescription(category, mileageWarranty);
  
  if (!description && benefits.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-neutral-900 mb-3 flex items-center gap-2">
        <span>💡</span>
        Why This Tire?
      </h3>
      
      {description && (
        <p className="text-sm text-neutral-700 leading-relaxed mb-4">
          {description}
        </p>
      )}
      
      {benefits.length > 0 && (
        <ul className="space-y-2">
          {benefits.slice(0, 4).map((benefit, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-800">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs mt-0.5">
                ✓
              </span>
              <span className="leading-snug">{benefit}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getWhyThisTireDescription(category: TireCategory, mileageWarranty?: number | null): string {
  const warrantyNote = mileageWarranty && mileageWarranty >= 50000 
    ? ` With a ${Math.round(mileageWarranty / 1000)}K mile warranty, it's built to go the distance.`
    : '';
  
  switch (category) {
    case 'All-Season':
      return `This tire is designed for drivers who want a balance of long tread life, comfort, and all-season reliability.${warrantyNote}`;
    case 'All-Weather':
      return `Built for drivers who face real winters but don't want seasonal tire swaps.${warrantyNote}`;
    case 'All-Terrain':
      return `The perfect balance for drivers who split time between highways and unpaved roads.${warrantyNote}`;
    case 'Mud-Terrain':
      return `When the trail gets serious, this tire delivers.${warrantyNote}`;
    case 'Highway/Touring':
      return `Engineered for long-distance comfort.${warrantyNote}`;
    case 'Performance':
      return `For drivers who love the feel of the road.${warrantyNote}`;
    case 'Summer':
      return `Optimized for warm weather performance.${warrantyNote}`;
    case 'Winter':
      return `Purpose-built for cold weather safety.${warrantyNote}`;
    case 'Rugged-Terrain':
      return `Heavy-duty construction meets on-road refinement.${warrantyNote}`;
    default:
      return `A quality tire designed for everyday driving.${warrantyNote}`;
  }
}
