"use client";

/**
 * SEO Content Block
 * 
 * Lightweight, collapsible content section for vehicle-specific pages.
 * Provides Google with context for indexing while keeping UX clean.
 * 
 * Design principles:
 * - Below product results (never above-the-fold)
 * - Collapsed by default on mobile
 * - Lightweight text (no walls of content)
 * - Dynamic content based on year/make/model
 * - No impact on conversion flow
 * 
 * @created 2026-04-06
 */

import { useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type SeoContentType = "tires" | "wheels" | "packages";

interface SeoContentBlockProps {
  year?: string | number;
  make?: string;
  model?: string;
  type: SeoContentType;
  /** Number of products shown (hide block if too few) */
  productCount?: number;
  /** Override default collapsed state */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Content Generation
// ============================================================================

interface SeoContent {
  heading: string;
  intro: string;
  benefits: { label: string; description: string }[];
  considerations: string[];
}

function generateTireContent(year: string, make: string, model: string): SeoContent {
  return {
    heading: `Choosing the Right Tires for Your ${year} ${make} ${model}`,
    intro: `The ${year} ${make} ${model} supports multiple tire sizes depending on trim and configuration. Whether you prioritize daily driving comfort, highway efficiency, or off-road capability, selecting the right tire ensures optimal performance and safety for your vehicle.`,
    benefits: [
      { label: "All-Season", description: "Versatile year-round grip for daily driving" },
      { label: "Highway/Touring", description: "Smooth, quiet ride for long-distance comfort" },
      { label: "All-Terrain", description: "Enhanced traction for mixed on/off-road use" },
      { label: "Performance", description: "Improved handling and responsiveness" },
    ],
    considerations: [
      "Weather conditions in your area",
      "Your typical driving style and distance",
      "Desired balance of comfort vs performance",
      "Tread life expectations and warranty coverage",
    ],
  };
}

function generateWheelContent(year: string, make: string, model: string): SeoContent {
  return {
    heading: `Upgrading Wheels for Your ${year} ${make} ${model}`,
    intro: `Custom wheels can transform the look and feel of your ${year} ${make} ${model}. From classic designs to modern styles, the right wheel choice balances aesthetics with fitment requirements like bolt pattern, offset, and center bore for a perfect fit.`,
    benefits: [
      { label: "Street Style", description: "Clean, refined look for daily driving" },
      { label: "Sport Design", description: "Aggressive styling with performance appeal" },
      { label: "Off-Road Ready", description: "Rugged construction for demanding terrain" },
      { label: "Lightweight Options", description: "Reduced weight for improved handling" },
    ],
    considerations: [
      "Correct bolt pattern and hub bore for your vehicle",
      "Wheel diameter and width compatibility",
      "Offset requirements for proper clearance",
      "Finish durability based on your climate",
    ],
  };
}

function generatePackageContent(year: string, make: string, model: string): SeoContent {
  return {
    heading: `Wheel & Tire Packages for Your ${year} ${make} ${model}`,
    intro: `A complete wheel and tire package for your ${year} ${make} ${model} ensures perfect fitment and a cohesive look. Buying together simplifies the process and often provides better value than purchasing separately.`,
    benefits: [
      { label: "Perfect Fitment", description: "Pre-matched wheels and tires sized for your vehicle" },
      { label: "Simplified Purchase", description: "One order, one delivery, ready to install" },
      { label: "Cost Savings", description: "Package pricing often beats buying separately" },
      { label: "Professional Match", description: "Wheel width and tire size properly paired" },
    ],
    considerations: [
      "Desired wheel size upgrade (if applicable)",
      "Tire type based on your driving needs",
      "Style preference for wheel design",
      "Installation timeline and local shop availability",
    ],
  };
}

function getContent(type: SeoContentType, year: string, make: string, model: string): SeoContent {
  switch (type) {
    case "tires":
      return generateTireContent(year, make, model);
    case "wheels":
      return generateWheelContent(year, make, model);
    case "packages":
      return generatePackageContent(year, make, model);
  }
}

// ============================================================================
// Component
// ============================================================================

export function SeoContentBlock({
  year,
  make,
  model,
  type,
  productCount,
  defaultExpanded = false,
  className = "",
}: SeoContentBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Validate required props
  const yearStr = year ? String(year).trim() : "";
  const makeStr = make ? String(make).trim() : "";
  const modelStr = model ? String(model).trim() : "";

  // Don't render if missing required data
  if (!yearStr || !makeStr || !modelStr) {
    return null;
  }

  // Don't render for low product count pages (optional)
  if (typeof productCount === "number" && productCount < 3) {
    return null;
  }

  const content = getContent(type, yearStr, makeStr, modelStr);

  return (
    <section
      className={`seo-content-block mt-12 border-t border-neutral-200 pt-8 ${className}`}
      aria-label={`About ${type} for ${yearStr} ${makeStr} ${modelStr}`}
    >
      {/* Header with collapse toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left group"
        aria-expanded={isExpanded}
        aria-controls="seo-content-body"
      >
        <h2 className="text-lg font-bold text-neutral-800 group-hover:text-neutral-900">
          {content.heading}
        </h2>
        <span
          className={`ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Collapsible content */}
      <div
        id="seo-content-body"
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[1000px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        {/* Intro paragraph */}
        <p className="text-sm text-neutral-600 leading-relaxed max-w-3xl">
          {content.intro}
        </p>

        {/* Benefits grid */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">
            {type === "tires" && "Common tire types for this vehicle:"}
            {type === "wheels" && "Popular wheel styles:"}
            {type === "packages" && "Package benefits:"}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {content.benefits.map((benefit) => (
              <li
                key={benefit.label}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-green-600 mt-0.5">•</span>
                <div>
                  <span className="font-medium text-neutral-800">{benefit.label}</span>
                  <span className="text-neutral-500"> — {benefit.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Considerations */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3">
            Things to consider:
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {content.considerations.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-neutral-600"
              >
                <span className="text-neutral-400">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Schema.org structured data (hidden, for SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: `What ${type} fit a ${yearStr} ${makeStr} ${modelStr}?`,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: content.intro,
                  },
                },
              ],
            }),
          }}
        />
      </div>

      {/* Peek text when collapsed (for SEO visibility) */}
      {!isExpanded && (
        <p className="mt-3 text-sm text-neutral-500 line-clamp-2">
          {content.intro.slice(0, 150)}...
          <button
            onClick={() => setIsExpanded(true)}
            className="ml-1 text-blue-600 hover:underline font-medium"
          >
            Read more
          </button>
        </p>
      )}
    </section>
  );
}

// ============================================================================
// Export
// ============================================================================

export default SeoContentBlock;
