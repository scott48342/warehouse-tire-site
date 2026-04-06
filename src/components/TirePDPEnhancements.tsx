"use client";

/**
 * Tire PDP Conversion Enhancements
 * 
 * ADDITIVE components to boost trust and conversion on tire PDPs.
 * These components are designed to:
 * - Degrade gracefully if data is missing
 * - Not interfere with existing cart/fitment logic
 * - Match the existing design system
 * - Be mobile-first responsive
 * 
 * @created 2026-04-06
 */

import { useState } from "react";

// ============================================================================
// SECTION 1: ABOVE THE FOLD ENHANCEMENTS
// ============================================================================

/**
 * "Best For" Micro Section
 * Shows 2-3 key use cases based on tire category
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
  
  if (traits.length === 0) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-700">
      <span className="text-neutral-500 font-medium">Best for:</span>
      {traits.map((trait, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <span className="text-green-600 text-xs">✔</span>
          <span>{trait}</span>
        </span>
      ))}
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
      traits.push('Daily driving', 'Year-round use');
      if (mileageWarranty && mileageWarranty >= 60000) traits.push('Long tread life');
      else traits.push('Quiet ride');
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
  
  if (isRunFlat && traits.length < 4) {
    traits.push('Peace of mind');
  }
  
  return traits.slice(0, 3);
}

/**
 * Enhanced Trust Strip 
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
          <span>✓</span>
          <span>Verified fit for your vehicle</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span>✓</span>
        <span>Fast shipping available</span>
      </span>
      {hasWarranty && (
        <span className="inline-flex items-center gap-1">
          <span>✓</span>
          <span>Backed by manufacturer warranty</span>
        </span>
      )}
    </div>
  );
}

/**
 * Review Summary Placeholder
 * Shows a review summary or gracefully hides if no data
 */
interface ReviewSummaryProps {
  rating?: number | null;
  reviewCount?: number | null;
  showPlaceholder?: boolean;
}

export function ReviewSummary({ rating, reviewCount, showPlaceholder = false }: ReviewSummaryProps) {
  // If we have real data, show it
  if (rating && rating > 0 && reviewCount && reviewCount > 0) {
    const stars = Math.round(rating * 2) / 2; // Round to nearest 0.5
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <span 
              key={star} 
              className={`text-sm ${star <= Math.floor(stars) ? 'text-yellow-500' : star - 0.5 === stars ? 'text-yellow-400' : 'text-neutral-300'}`}
            >
              ★
            </span>
          ))}
        </div>
        <span className="text-sm font-semibold text-neutral-900">{rating.toFixed(1)}</span>
        <span className="text-sm text-neutral-500">
          ({reviewCount >= 1000 ? `${(reviewCount / 1000).toFixed(1)}K` : reviewCount}+ reviews)
        </span>
      </div>
    );
  }
  
  // Show placeholder only if explicitly enabled
  if (showPlaceholder) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <span className="text-yellow-400">★★★★★</span>
        <span>Highly rated tire</span>
      </div>
    );
  }
  
  // Gracefully hide if no data
  return null;
}

// ============================================================================
// SECTION 2: DECISION SUPPORT
// ============================================================================

/**
 * "Why This Tire?" Section
 * Conversational, benefit-driven description
 */
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
      return `This tire is designed for drivers who want a balance of long tread life, comfort, and all-season reliability. It performs well in both wet and dry conditions while maintaining a quiet ride for daily driving.${warrantyNote}`;
    case 'All-Weather':
      return `Built for drivers who face real winters but don't want the hassle of seasonal tire swaps. This tire is 3-peak mountain snowflake rated for severe snow conditions while still performing great year-round.${warrantyNote}`;
    case 'All-Terrain':
      return `The perfect balance for drivers who split time between highways and unpaved roads. Expect confident off-road grip without sacrificing on-road comfort and quietness.${warrantyNote}`;
    case 'Mud-Terrain':
      return `When the trail gets serious, this tire delivers. Aggressive tread with self-cleaning capability bites through mud, rocks, and sand. Built for drivers who venture where pavement ends.${warrantyNote}`;
    case 'Highway/Touring':
      return `Engineered for long-distance comfort. This tire delivers a whisper-quiet cabin, smooth ride, and exceptional tread life for drivers who rack up highway miles.${warrantyNote}`;
    case 'Performance':
      return `For drivers who love the feel of the road. This tire offers responsive handling, confident grip through corners, and the kind of connection enthusiasts crave.${warrantyNote}`;
    case 'Summer':
      return `Optimized for warm weather performance. This tire maximizes dry grip and wet braking when temperatures stay above 45°F. Ideal for sports cars and performance vehicles.${warrantyNote}`;
    case 'Winter':
      return `Purpose-built for cold weather safety. The specialized compound stays flexible in freezing temperatures, providing confident grip on snow, ice, and cold pavement.${warrantyNote}`;
    case 'Rugged-Terrain':
      return `Heavy-duty construction meets on-road refinement. Built with reinforced sidewalls to handle work site hazards while still delivering a comfortable highway ride.${warrantyNote}`;
    default:
      return `A quality tire designed to deliver reliable grip, comfort, and durability for everyday driving conditions.${warrantyNote}`;
  }
}

/**
 * Performance Snapshot
 * Simple star ratings for key attributes
 */
interface PerformanceSnapshotProps {
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

export function PerformanceSnapshot({ ratings, category }: PerformanceSnapshotProps) {
  // Select which ratings to show based on category
  const displayRatings = getDisplayRatings(ratings, category);
  
  if (displayRatings.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-neutral-900 mb-4 flex items-center gap-2">
        <span>📊</span>
        Performance
      </h3>
      
      <div className="space-y-3">
        {displayRatings.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-neutral-600">{label}</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star} 
                  className={`text-sm ${star <= value ? 'text-yellow-500' : 'text-neutral-200'}`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDisplayRatings(
  ratings: PerformanceSnapshotProps['ratings'],
  category?: TireCategory
): { label: string; value: number }[] {
  const result: { label: string; value: number }[] = [];
  
  // Default display order based on category
  switch (category) {
    case 'All-Terrain':
    case 'Mud-Terrain':
    case 'Rugged-Terrain':
      if (ratings.offRoad) result.push({ label: 'Off-Road', value: Math.min(5, Math.round(ratings.offRoad / 2)) });
      if (ratings.treadLife) result.push({ label: 'Tread Life', value: Math.min(5, Math.round(ratings.treadLife / 2)) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)) });
      break;
    case 'Winter':
      if (ratings.snow) result.push({ label: 'Snow Grip', value: Math.min(5, Math.round(ratings.snow / 2)) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)) });
      break;
    case 'Performance':
    case 'Summer':
      if (ratings.dryGrip) result.push({ label: 'Dry Grip', value: Math.min(5, Math.round(ratings.dryGrip / 2)) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)) });
      break;
    default:
      if (ratings.treadLife) result.push({ label: 'Tread Life', value: Math.min(5, Math.round(ratings.treadLife / 2)) });
      if (ratings.comfort) result.push({ label: 'Comfort', value: Math.min(5, Math.round(ratings.comfort / 2)) });
      if (ratings.wetGrip) result.push({ label: 'Wet Grip', value: Math.min(5, Math.round(ratings.wetGrip / 2)) });
      if (ratings.quietRide) result.push({ label: 'Quiet Ride', value: Math.min(5, Math.round(ratings.quietRide / 2)) });
  }
  
  return result.slice(0, 4);
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
          <span>Questions? Call us at <strong>1-800-XXX-XXXX</strong></span>
        </li>
      </ul>
    </CollapsibleSection>
  );
}

// ============================================================================
// SECTION 4: CONVERSION REINFORCEMENT
// ============================================================================

/**
 * Final Trust Reminder
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
            <span className="font-medium">Verified to fit your vehicle</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-600">✔</span>
          <span className="font-medium">Ships fast from trusted suppliers</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-green-600">✔</span>
          <span className="font-medium">Secure checkout guaranteed</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Confidence Badge
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
