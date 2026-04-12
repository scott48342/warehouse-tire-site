/**
 * Visual Badges for Tire Cards
 * 
 * Displays tread category, mileage warranty, sale/free shipping badges
 * on tire cards for improved conversion confidence.
 */

import React from "react";
import type { TreadCategory } from "@/lib/tires/normalization";

// ============================================================================
// TYPES
// ============================================================================

export interface TireBadgesProps {
  /** Tread category (All-Terrain, Highway/Touring, etc.) */
  treadCategory?: TreadCategory | string | null;
  /** Mileage warranty in miles */
  warrantyMiles?: number | null;
  /** Is on sale */
  onSale?: boolean;
  /** Has free shipping */
  freeShipping?: boolean;
  /** Has 3-Peak Mountain Snowflake rating */
  has3PMSF?: boolean;
  /** Is run-flat tire */
  isRunFlat?: boolean;
  /** Compact mode for smaller cards */
  compact?: boolean;
  /** Max badges to show (default: 4) */
  maxBadges?: number;
}

// ============================================================================
// BADGE STYLES BY CATEGORY
// ============================================================================

const CATEGORY_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'All-Terrain': { bg: 'bg-amber-100', text: 'text-amber-800', icon: '🏔️' },
  'Mud-Terrain': { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🪨' },
  'Rugged-Terrain': { bg: 'bg-stone-100', text: 'text-stone-800', icon: '⛰️' },
  'Highway/Touring': { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🛣️' },
  'All-Season': { bg: 'bg-green-100', text: 'text-green-800', icon: '🌤️' },
  'All-Weather': { bg: 'bg-teal-100', text: 'text-teal-800', icon: '🌦️' },
  'Winter': { bg: 'bg-sky-100', text: 'text-sky-800', icon: '❄️' },
  'Summer': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '☀️' },
  'Performance': { bg: 'bg-red-100', text: 'text-red-800', icon: '🏎️' },
  'Off-Road': { bg: 'bg-neutral-200', text: 'text-neutral-800', icon: '🚙' },
};

// ============================================================================
// INDIVIDUAL BADGES
// ============================================================================

function CategoryBadge({ 
  category, 
  compact = false 
}: { 
  category: string; 
  compact?: boolean;
}) {
  const style = CATEGORY_STYLES[category] || { 
    bg: 'bg-neutral-100', 
    text: 'text-neutral-700', 
    icon: '🛞' 
  };
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold
        ${style.bg} ${style.text}
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>{style.icon}</span>
      {category}
    </span>
  );
}

function MileageBadge({ 
  miles, 
  compact = false 
}: { 
  miles: number; 
  compact?: boolean;
}) {
  const k = Math.round(miles / 1000);
  const isUltra = k >= 80;
  const isLong = k >= 60;
  
  if (k < 40) return null;
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-bold
        ${isUltra ? 'bg-purple-100 text-purple-800' : isLong ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-50 text-blue-700'}
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>📏</span>
      {k}K mi
    </span>
  );
}

function SaleBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-bold bg-red-500 text-white
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      SALE
    </span>
  );
}

function FreeShippingBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold bg-green-100 text-green-800
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>🚚</span>
      Free Ship
    </span>
  );
}

function SnowflakeBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold bg-sky-100 text-sky-800
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
      title="3-Peak Mountain Snowflake - Severe Snow Rated"
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>❄️🏔️</span>
      {!compact && '3PMSF'}
    </span>
  );
}

function RunFlatBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold bg-neutral-800 text-white
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
      title="Run-Flat Technology"
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>🛡️</span>
      {!compact && 'Run-Flat'}
    </span>
  );
}

// ============================================================================
// REBATE BADGE
// ============================================================================

export interface RebateBadgeProps {
  /** Rebate amount text (e.g., "$80", "Up to $100") */
  amount?: string | null;
  /** Compact mode for smaller cards */
  compact?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export function RebateBadge({ 
  amount, 
  compact = false,
  onClick,
}: RebateBadgeProps) {
  // Format display text
  let displayText = "Rebate Available";
  if (amount) {
    const trimmed = amount.trim();
    if (trimmed.startsWith("$") || trimmed.toLowerCase().startsWith("up to")) {
      displayText = `${trimmed} Rebate`;
    } else {
      displayText = trimmed;
    }
  }
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-bold 
        bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-sm
        ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'}
        ${onClick ? 'cursor-pointer hover:from-emerald-600 hover:to-green-700 transition-colors' : ''}
      `}
      title="Manufacturer rebate available"
      onClick={onClick}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>💰</span>
      {displayText}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TireBadges({
  treadCategory,
  warrantyMiles,
  onSale = false,
  freeShipping = false,
  has3PMSF = false,
  isRunFlat = false,
  compact = false,
  maxBadges = 4,
}: TireBadgesProps) {
  const badges: React.ReactNode[] = [];
  
  // Priority order: Sale > Category > Mileage > 3PMSF > Run-Flat > Free Shipping
  
  if (onSale) {
    badges.push(<SaleBadge key="sale" compact={compact} />);
  }
  
  if (treadCategory && typeof treadCategory === 'string') {
    badges.push(<CategoryBadge key="cat" category={treadCategory} compact={compact} />);
  }
  
  if (warrantyMiles && warrantyMiles >= 40000) {
    badges.push(<MileageBadge key="miles" miles={warrantyMiles} compact={compact} />);
  }
  
  if (has3PMSF) {
    badges.push(<SnowflakeBadge key="3pmsf" compact={compact} />);
  }
  
  if (isRunFlat) {
    badges.push(<RunFlatBadge key="rf" compact={compact} />);
  }
  
  if (freeShipping) {
    badges.push(<FreeShippingBadge key="ship" compact={compact} />);
  }
  
  // Limit badges shown
  const visibleBadges = badges.slice(0, maxBadges);
  const remainingCount = badges.length - maxBadges;
  
  if (visibleBadges.length === 0) return null;
  
  return (
    <div className={`flex flex-wrap items-center gap-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {visibleBadges}
      {remainingCount > 0 && (
        <span 
          className={`
            inline-flex items-center justify-center rounded-full font-medium bg-neutral-100 text-neutral-600
            ${compact ? 'h-4 w-4 text-[8px]' : 'h-5 w-5 text-[9px]'}
          `}
        >
          +{remainingCount}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// STOCK BADGE
// ============================================================================

export interface StockBadgeProps {
  /** Total quantity available */
  quantity: number;
  /** Stock status */
  status?: 'in-stock' | 'low-stock' | 'special-order' | 'out-of-stock';
  /** Show as compact */
  compact?: boolean;
}

export function StockBadge({ 
  quantity, 
  status,
  compact = false,
}: StockBadgeProps) {
  const resolvedStatus = status || (
    quantity >= 8 ? 'in-stock' :
    quantity >= 4 ? 'low-stock' :
    quantity > 0 ? 'low-stock' : 'special-order'
  );
  
  const styles = {
    'in-stock': 'bg-green-100 text-green-800',
    'low-stock': 'bg-amber-100 text-amber-800',
    'special-order': 'bg-neutral-100 text-neutral-600',
    'out-of-stock': 'bg-red-100 text-red-700',
  };
  
  const icons = {
    'in-stock': '✓',
    'low-stock': '⚡',
    'special-order': '📦',
    'out-of-stock': '✕',
  };
  
  const messages = {
    'in-stock': `${quantity} in stock`,
    'low-stock': quantity > 0 ? `Only ${quantity} left` : 'Low stock',
    'special-order': 'Special order',
    'out-of-stock': 'Out of stock',
  };
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-semibold
        ${styles[resolvedStatus]}
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>{icons[resolvedStatus]}</span>
      {messages[resolvedStatus]}
    </span>
  );
}

// ============================================================================
// DELIVERY BADGE
// ============================================================================

export interface DeliveryBadgeProps {
  /** Estimated delivery in business days */
  days: number | null;
  /** Show as compact */
  compact?: boolean;
}

export function DeliveryBadge({ 
  days,
  compact = false,
}: DeliveryBadgeProps) {
  if (days == null) return null;
  
  let message: string;
  let style: string;
  
  if (days <= 2) {
    message = 'Ships tomorrow';
    style = 'bg-green-100 text-green-800';
  } else if (days <= 4) {
    message = 'Ships in 3-4 days';
    style = 'bg-blue-50 text-blue-700';
  } else if (days <= 7) {
    message = 'Ships in 5-7 days';
    style = 'bg-neutral-100 text-neutral-600';
  } else {
    message = 'Ships in 1-2 weeks';
    style = 'bg-neutral-100 text-neutral-500';
  }
  
  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${style}
        ${compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}
      `}
    >
      <span className={compact ? 'text-[10px]' : 'text-xs'}>📦</span>
      {message}
    </span>
  );
}
