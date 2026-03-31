"use client";

import { type ReactNode } from "react";

// ============================================================================
// Types
// ============================================================================

export type TrustBadgeType = 
  | "fitment_guaranteed"
  | "verified_vehicle"
  | "no_rubbing"
  | "free_shipping"
  | "price_match"
  | "expert_support";

export type TrustBadgeSize = "sm" | "md" | "lg";
export type TrustBadgeVariant = "filled" | "outline" | "subtle";

interface TrustBadgeProps {
  type: TrustBadgeType;
  size?: TrustBadgeSize;
  variant?: TrustBadgeVariant;
  className?: string;
  showLabel?: boolean;
}

interface TrustBadgesRowProps {
  badges: TrustBadgeType[];
  size?: TrustBadgeSize;
  variant?: TrustBadgeVariant;
  className?: string;
}

interface TrustBadgesStackProps {
  badges: TrustBadgeType[];
  size?: TrustBadgeSize;
  className?: string;
}

// ============================================================================
// Badge Configuration
// ============================================================================

const BADGE_CONFIG: Record<TrustBadgeType, {
  icon: string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  fitment_guaranteed: {
    icon: "✓",
    label: "Fitment Guaranteed",
    shortLabel: "Fitment",
    description: "100% guaranteed to fit your vehicle or your money back",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  verified_vehicle: {
    icon: "🛡️",
    label: "Verified for Your Vehicle",
    shortLabel: "Verified",
    description: "Specifications verified against your vehicle's exact requirements",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  no_rubbing: {
    icon: "👍",
    label: "No Rubbing Guarantee",
    shortLabel: "No Rub",
    description: "Engineered to clear fenders and suspension without modifications",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  free_shipping: {
    icon: "🚚",
    label: "Free Shipping",
    shortLabel: "Free Ship",
    description: "Free shipping on orders over $500",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  price_match: {
    icon: "💰",
    label: "Price Match Guarantee",
    shortLabel: "Price Match",
    description: "We'll match any competitor's price on identical products",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  expert_support: {
    icon: "👨‍🔧",
    label: "Expert Support",
    shortLabel: "Expert",
    description: "Real fitment experts, not chat bots",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
};

// ============================================================================
// Size Classes
// ============================================================================

const SIZE_CLASSES: Record<TrustBadgeSize, {
  badge: string;
  icon: string;
  text: string;
}> = {
  sm: {
    badge: "px-2 py-0.5 gap-1",
    icon: "text-xs",
    text: "text-xs",
  },
  md: {
    badge: "px-2.5 py-1 gap-1.5",
    icon: "text-sm",
    text: "text-sm",
  },
  lg: {
    badge: "px-3 py-1.5 gap-2",
    icon: "text-base",
    text: "text-sm font-medium",
  },
};

// ============================================================================
// Single Badge Component
// ============================================================================

export function TrustBadge({
  type,
  size = "md",
  variant = "filled",
  className = "",
  showLabel = true,
}: TrustBadgeProps) {
  const config = BADGE_CONFIG[type];
  const sizeClass = SIZE_CLASSES[size];

  const variantClasses = {
    filled: `${config.bgColor} ${config.color}`,
    outline: `bg-white border ${config.borderColor} ${config.color}`,
    subtle: `bg-neutral-50 ${config.color}`,
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full ${sizeClass.badge}
        ${variantClasses[variant]}
        ${className}
      `}
      title={config.description}
    >
      <span className={sizeClass.icon}>{config.icon}</span>
      {showLabel && (
        <span className={sizeClass.text}>
          {size === "sm" ? config.shortLabel : config.label}
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Badge Row (Horizontal)
// ============================================================================

export function TrustBadgesRow({
  badges,
  size = "sm",
  variant = "subtle",
  className = "",
}: TrustBadgesRowProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {badges.map((badge) => (
        <TrustBadge
          key={badge}
          type={badge}
          size={size}
          variant={variant}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Badge Stack (Vertical, with descriptions)
// ============================================================================

export function TrustBadgesStack({
  badges,
  size = "md",
  className = "",
}: TrustBadgesStackProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {badges.map((badge) => {
        const config = BADGE_CONFIG[badge];
        return (
          <div key={badge} className="flex items-start gap-3">
            <span
              className={`
                flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
                ${config.bgColor} ${config.color} text-lg
              `}
            >
              {config.icon}
            </span>
            <div>
              <p className={`font-medium ${config.color}`}>{config.label}</p>
              <p className="text-sm text-neutral-600">{config.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Quick Trust Bar (for product pages)
// ============================================================================

export function TrustBar({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 py-3 bg-neutral-50 border-y border-neutral-100 ${className}`}>
      <TrustBadge type="fitment_guaranteed" size="sm" variant="subtle" />
      <TrustBadge type="free_shipping" size="sm" variant="subtle" />
      <TrustBadge type="expert_support" size="sm" variant="subtle" />
    </div>
  );
}

// ============================================================================
// Fitment Confidence Badge (for search results)
// ============================================================================

export function FitmentGuaranteeBadge({
  size = "sm",
  className = "",
}: {
  size?: TrustBadgeSize;
  className?: string;
}) {
  return (
    <TrustBadge
      type="fitment_guaranteed"
      size={size}
      variant="filled"
      className={className}
    />
  );
}

// ============================================================================
// Vehicle Verified Badge
// ============================================================================

export function VehicleVerifiedBadge({
  vehicleName,
  size = "sm",
  className = "",
}: {
  vehicleName?: string;
  size?: TrustBadgeSize;
  className?: string;
}) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
        bg-blue-50 text-blue-700
        ${className}
      `}
      title={vehicleName ? `Verified for ${vehicleName}` : "Verified for your vehicle"}
    >
      <span className="text-xs">🛡️</span>
      <span className="text-xs font-medium">
        {vehicleName ? `Fits ${vehicleName}` : "Verified Fit"}
      </span>
    </span>
  );
}

// ============================================================================
// Cart Trust Section
// ============================================================================

export function CartTrustSection({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-4 ${className}`}>
      <h3 className="font-semibold text-neutral-900 mb-3">Why Shop With Us</h3>
      <TrustBadgesStack
        badges={["fitment_guaranteed", "no_rubbing", "free_shipping", "expert_support"]}
        size="sm"
      />
    </div>
  );
}

// ============================================================================
// Package Trust Badges (for package cards)
// ============================================================================

export function PackageTrustBadges({ className = "" }: { className?: string }) {
  return (
    <TrustBadgesRow
      badges={["fitment_guaranteed", "verified_vehicle"]}
      size="sm"
      variant="subtle"
      className={className}
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export { BADGE_CONFIG };
export default TrustBadge;
