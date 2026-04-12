"use client";

import { useRebateMatch, type RebateMatchData } from "@/hooks/useRebateMatch";

// ════════════════════════════════════════════════════════════════════════════════
// SRP BADGE (Compact, for tire cards)
// ════════════════════════════════════════════════════════════════════════════════

export interface RebateSRPBadgeProps {
  match: RebateMatchData;
  compact?: boolean;
}

export function RebateSRPBadge({ match, compact = false }: RebateSRPBadgeProps) {
  // Format display text
  let displayText = "Rebate";
  if (match.amount) {
    const amt = match.amount.trim();
    if (amt.toLowerCase().startsWith("up to")) {
      displayText = amt;
    } else if (amt.startsWith("$")) {
      displayText = `${amt} Rebate`;
    } else {
      displayText = amt;
    }
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-bold shadow-sm
        bg-gradient-to-r from-emerald-500 to-green-600 text-white
        ${compact ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"}
      `}
      title={match.headline}
    >
      <span className={compact ? "text-[10px]" : "text-xs"}>💰</span>
      {displayText}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PDP BLOCK (Full rebate info)
// ════════════════════════════════════════════════════════════════════════════════

export interface RebatePDPBlockProps {
  sku: string;
  brand: string;
  model: string;
  size: string;
}

export function RebatePDPBlock({ sku, brand, model, size }: RebatePDPBlockProps) {
  const { match, loading } = useRebateMatch({ sku, brand, model, size });

  if (loading) {
    return null; // Don't show loading state, just hide
  }

  if (!match) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">💰</span>
        <div>
          <div className="text-sm font-extrabold text-emerald-900">Manufacturer Rebate Available</div>
          {match.endsText && (
            <div className="text-xs text-emerald-700">Valid: {match.endsText}</div>
          )}
        </div>
      </div>

      {/* Amount badge */}
      {match.amount && (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-1.5 text-lg font-extrabold text-white shadow">
            {match.amount.toLowerCase().startsWith("up to") 
              ? match.amount 
              : `${match.amount} Rebate`}
          </span>
        </div>
      )}

      {/* Headline */}
      <p className="mt-3 text-sm text-emerald-900">{match.headline}</p>

      {/* CTA */}
      {match.formUrl && (
        <a
          href={match.formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Claim Rebate
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* Fine print */}
      <p className="mt-3 text-[10px] text-emerald-700/70">
        Submit rebate after purchase via manufacturer's website. Terms and exclusions may apply.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// STATIC PDP BLOCK (For server-rendered pages with pre-fetched match)
// ════════════════════════════════════════════════════════════════════════════════

export interface RebatePDPBlockStaticProps {
  match: {
    amount: string | null;
    headline: string;
    formUrl: string | null;
    learnMoreUrl?: string | null;
    requirements?: string | null;
    endsText: string | null;
    brand: string | null;
  };
}

export function RebatePDPBlockStatic({ match }: RebatePDPBlockStaticProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">💰</span>
        <div>
          <div className="text-sm font-extrabold text-emerald-900">Manufacturer Rebate Available</div>
          {match.endsText && (
            <div className="text-xs text-emerald-700">Valid: {match.endsText}</div>
          )}
        </div>
      </div>

      {/* Amount badge */}
      {match.amount && (
        <div className="mt-3">
          <span className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-1.5 text-lg font-extrabold text-white shadow">
            {match.amount.toLowerCase().startsWith("up to") 
              ? match.amount 
              : `${match.amount} Rebate`}
          </span>
        </div>
      )}

      {/* Headline */}
      <p className="mt-3 text-sm text-emerald-900">{match.headline}</p>

      {/* Requirements */}
      {match.requirements && (
        <p className="mt-2 text-xs text-emerald-800">
          <strong>Requirement:</strong> {match.requirements}
        </p>
      )}

      {/* CTA */}
      {match.formUrl && (
        <a
          href={match.formUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
        >
          Claim Rebate
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* Fine print */}
      <p className="mt-3 text-[10px] text-emerald-700/70">
        Submit rebate after purchase via manufacturer's website. Terms and exclusions may apply.
      </p>
    </div>
  );
}
