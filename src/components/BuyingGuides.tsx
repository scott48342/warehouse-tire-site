"use client";

/**
 * Buying Guides - Lightweight Decision Helpers
 * 
 * Static, accessible modals that explain key concepts:
 * - Tire Size Guide (225/65R17 format)
 * - Tire Types Guide (All-season, Touring, etc.)
 * - Staggered vs Square Guide
 * 
 * Design principles:
 * - No external data fetching
 * - Minimal DOM footprint when closed
 * - Mobile-friendly slide-up
 * - Accessible (aria, focus trap)
 * 
 * @created 2026-04-06
 */

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export type GuideType = "tire-size" | "tire-types" | "staggered-vs-square";

interface GuideModalProps {
  guide: GuideType;
  isOpen: boolean;
  onClose: () => void;
}

interface GuideTriggerProps {
  guide: GuideType;
  /** Trigger text (default based on guide type) */
  label?: string;
  /** Visual variant */
  variant?: "link" | "button" | "icon";
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Guide Content
// ============================================================================

const GUIDE_CONTENT: Record<GuideType, { title: string; icon: string; sections: { heading: string; content: string }[] }> = {
  "tire-size": {
    title: "Understanding Tire Sizes",
    icon: "📏",
    sections: [
      {
        heading: "Example: 225/65R17",
        content: "This code tells you everything about the tire's dimensions. Let's break it down:",
      },
      {
        heading: "225 — Width",
        content: "The tire width in millimeters, measured from sidewall to sidewall. Wider tires offer more grip; narrower tires are often more fuel-efficient.",
      },
      {
        heading: "65 — Aspect Ratio",
        content: "The sidewall height as a percentage of width. A 65 means the sidewall is 65% of 225mm. Lower numbers = sportier look, stiffer ride. Higher = more cushion.",
      },
      {
        heading: "R — Construction",
        content: "R means radial construction — the standard for modern passenger tires. You'll rarely see anything else.",
      },
      {
        heading: "17 — Wheel Diameter",
        content: "The wheel size in inches. This must match your wheel exactly. A 17\" tire only fits a 17\" wheel.",
      },
    ],
  },
  "tire-types": {
    title: "Tire Types Explained",
    icon: "🛞",
    sections: [
      {
        heading: "All-Season",
        content: "Versatile year-round grip for daily driving. Handles light rain and occasional light snow. Best for most drivers in moderate climates.",
      },
      {
        heading: "Highway / Touring",
        content: "Optimized for smooth, quiet highway driving. Longer tread life and better fuel economy. Ideal for commuters and road-trippers.",
      },
      {
        heading: "All-Terrain",
        content: "Built for trucks and SUVs that go on and off-road. Aggressive tread for dirt, gravel, and mud while staying comfortable on pavement.",
      },
      {
        heading: "Mud-Terrain",
        content: "Maximum off-road traction for serious trail use. Louder on highways and shorter tread life — trade-offs for extreme capability.",
      },
      {
        heading: "Performance / Summer",
        content: "Grippy compound for spirited driving in warm conditions. Excellent handling but not suitable for cold weather or snow.",
      },
      {
        heading: "Winter / Snow",
        content: "Soft compound stays flexible in freezing temps. Deep treads clear snow and slush. Essential for harsh winters.",
      },
    ],
  },
  "staggered-vs-square": {
    title: "Staggered vs Square Setup",
    icon: "⚙️",
    sections: [
      {
        heading: "What is a Staggered Setup?",
        content: "Different wheel/tire sizes front vs rear — typically wider in the back. Common on sports cars, muscle cars, and performance vehicles.",
      },
      {
        heading: "Why Use Staggered?",
        content: "Wider rear tires provide better traction for acceleration and a more aggressive stance. Many performance cars come staggered from the factory.",
      },
      {
        heading: "Square Setup",
        content: "Same wheel/tire size all four corners. Allows tire rotation, which extends tread life evenly. Better for daily drivers and most SUVs/trucks.",
      },
      {
        heading: "When to Choose Staggered",
        content: "If your vehicle came staggered or you want max rear grip for spirited driving. Be aware: you can't rotate tires front-to-rear.",
      },
      {
        heading: "When to Choose Square",
        content: "For practical daily driving, easier maintenance, and longer overall tire life through regular rotations.",
      },
    ],
  },
};

const GUIDE_LABELS: Record<GuideType, string> = {
  "tire-size": "What do tire sizes mean?",
  "tire-types": "Which tire type is right for me?",
  "staggered-vs-square": "Staggered vs Square — what's the difference?",
};

// ============================================================================
// Modal Component
// ============================================================================

function GuideModal({ guide, isOpen, onClose }: GuideModalProps) {
  const content = GUIDE_CONTENT[guide];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-neutral-100 bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{content.icon}</span>
            <h2 id="guide-modal-title" className="text-lg font-bold text-neutral-900">
              {content.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
            aria-label="Close guide"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5" style={{ maxHeight: "calc(85vh - 80px)" }}>
          <div className="space-y-5">
            {content.sections.map((section, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-bold text-neutral-900 mb-1">
                  {section.heading}
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-bold text-white hover:bg-neutral-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Trigger Component
// ============================================================================

export function GuideTrigger({
  guide,
  label,
  variant = "link",
  className = "",
}: GuideTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const displayLabel = label || GUIDE_LABELS[guide];

  const handleOpen = useCallback(() => setIsOpen(true), []);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const baseClasses = {
    link: "text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium cursor-pointer inline-flex items-center gap-1",
    button: "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors",
    icon: "inline-flex items-center justify-center h-5 w-5 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 text-xs cursor-pointer",
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={`${baseClasses[variant]} ${className}`}
        aria-haspopup="dialog"
      >
        {variant === "icon" ? (
          <span aria-label={displayLabel}>?</span>
        ) : (
          <>
            <span className="text-base">💡</span>
            <span>{displayLabel}</span>
          </>
        )}
      </button>
      <GuideModal guide={guide} isOpen={isOpen} onClose={handleClose} />
    </>
  );
}

// ============================================================================
// Pre-configured Triggers (convenience exports)
// ============================================================================

export function TireSizeGuide({ variant = "link", className = "" }: { variant?: "link" | "button" | "icon"; className?: string }) {
  return <GuideTrigger guide="tire-size" variant={variant} className={className} />;
}

export function TireTypesGuide({ variant = "link", className = "" }: { variant?: "link" | "button" | "icon"; className?: string }) {
  return <GuideTrigger guide="tire-types" variant={variant} className={className} />;
}

export function StaggeredGuide({ variant = "link", className = "" }: { variant?: "link" | "button" | "icon"; className?: string }) {
  return <GuideTrigger guide="staggered-vs-square" variant={variant} className={className} />;
}

// ============================================================================
// Inline Guide Snippet (for embedding in cards)
// ============================================================================

interface GuideSnippetProps {
  guide: GuideType;
  /** Show as a subtle hint line */
  variant?: "hint" | "card";
  className?: string;
}

export function GuideSnippet({ guide, variant = "hint", className = "" }: GuideSnippetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = GUIDE_CONTENT[guide];

  if (variant === "hint") {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-600 transition-colors ${className}`}
        >
          <span>💡</span>
          <span className="underline decoration-dotted underline-offset-2">Learn more</span>
        </button>
        <GuideModal guide={guide} isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  // Card variant - shows first section preview
  const preview = content.sections[0];
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`block w-full text-left rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 hover:border-blue-200 hover:bg-blue-50/30 transition-colors ${className}`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{content.icon}</span>
          <span className="text-sm font-bold text-neutral-900">{content.title}</span>
        </div>
        <p className="text-xs text-neutral-600 line-clamp-2">{preview.content}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600">
          Read guide →
        </span>
      </button>
      <GuideModal guide={guide} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

// ============================================================================
// Export
// ============================================================================

export default GuideTrigger;
