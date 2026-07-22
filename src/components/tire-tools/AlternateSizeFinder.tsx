"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import tireSizesData from "@/data/tire-sizes.json";
import {
  parseMetricSize,
  calculateOverallDiameter,
  generatePlusSizeCandidates,
  type PlusSizeCandidate,
} from "@/lib/tirePlusSizing";

/**
 * AlternateSizeFinder
 *
 * Customer-facing "what other tire sizes fit?" tool.
 *
 * 1. Pick your current tire size (cascading dropdowns fed by the REAL
 *    tire-sizes.json database — only real, orderable sizes are selectable).
 * 2. See full specs: overall diameter, sidewall, circumference, revs/mile.
 * 3. Pick any wheel diameter and see every alternate size within ±3% of
 *    your original overall diameter (±2% = "Best Match").
 * 4. Every alternate size links straight into tire search (/tires?size=...).
 *
 * All math + candidate generation comes from @/lib/tirePlusSizing — the same
 * engine used by the tire SRP plus-sizing flow, so Learn-page suggestions and
 * shopping-flow suggestions can never disagree.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown option derivation (from real size DB, cascading)
// ─────────────────────────────────────────────────────────────────────────────

type ParsedEntry = { width: number; aspect: number; rim: number; size: string };

const ALL_PARSED: ParsedEntry[] = (tireSizesData.metric as string[])
  .map((size) => {
    const p = parseMetricSize(size);
    return p ? { width: p.width, aspect: p.aspect, rim: p.rim, size } : null;
  })
  .filter((p): p is ParsedEntry => p !== null);

const ALL_WIDTHS = [...new Set(ALL_PARSED.map((p) => p.width))].sort((a, b) => a - b);

function aspectsForWidth(width: number): number[] {
  return [...new Set(ALL_PARSED.filter((p) => p.width === width).map((p) => p.aspect))].sort(
    (a, b) => a - b
  );
}

function rimsForWidthAspect(width: number, aspect: number): number[] {
  return [
    ...new Set(
      ALL_PARSED.filter((p) => p.width === width && p.aspect === aspect).map((p) => p.rim)
    ),
  ].sort((a, b) => a - b);
}

const ALL_RIMS = [...new Set(ALL_PARSED.map((p) => p.rim))].sort((a, b) => a - b);

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

const INCHES_PER_MILE = 63360;

function revsPerMile(overallDiameterInches: number): number {
  return INCHES_PER_MILE / (Math.PI * overallDiameterInches);
}

function circumferenceInches(overallDiameterInches: number): number {
  return Math.PI * overallDiameterInches;
}

function diffColorClasses(absPct: number): string {
  if (absPct <= 1) return "text-green-700";
  if (absPct <= 2) return "text-emerald-600";
  return "text-yellow-600";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AlternateSizeFinder({
  initialSize,
}: {
  /** Optional starting size, e.g. "265/70R17" */
  initialSize?: string;
}) {
  const initialParsed = initialSize ? parseMetricSize(initialSize) : null;

  const [width, setWidth] = useState<number>(initialParsed?.width ?? 265);
  const [aspect, setAspect] = useState<number>(initialParsed?.aspect ?? 70);
  const [rim, setRim] = useState<number>(initialParsed?.rim ?? 17);
  const [selectedRim, setSelectedRim] = useState<number | null>(null);

  // Cascade: keep aspect/rim valid for the chosen width
  const aspects = useMemo(() => aspectsForWidth(width), [width]);
  const safeAspect = aspects.includes(aspect) ? aspect : aspects[Math.floor(aspects.length / 2)];
  const rims = useMemo(() => rimsForWidthAspect(width, safeAspect), [width, safeAspect]);
  const safeRim = rims.includes(rim) ? rim : rims[Math.floor(rims.length / 2)];

  const currentSize = `${width}/${safeAspect}R${safeRim}`;
  const currentOd = calculateOverallDiameter(width, safeAspect, safeRim);
  const sidewallMm = (width * safeAspect) / 100;

  // Candidate counts per wheel diameter (drives the chips)
  const rimResults = useMemo(() => {
    return ALL_RIMS.map((r) => {
      const result = generatePlusSizeCandidates(currentSize, r);
      return { rim: r, candidates: result.acceptableCandidates };
    }).filter((r) => r.candidates.length > 0);
  }, [currentSize]);

  const activeRim =
    selectedRim !== null && rimResults.some((r) => r.rim === selectedRim)
      ? selectedRim
      : safeRim;

  const activeCandidates: PlusSizeCandidate[] =
    rimResults.find((r) => r.rim === activeRim)?.candidates ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
      <h3 className="text-xl font-bold text-neutral-900">Alternate Tire Size Finder</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Enter your current tire size, then pick a wheel diameter to see every size that keeps
        your speedometer accurate (within 3% of original diameter).
      </p>

      {/* ── Current size input ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl bg-neutral-50 p-4">
        <h4 className="font-bold text-neutral-900">Your Current Tire Size</h4>
        <div className="mt-3 flex items-end gap-2 sm:gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500">Width</label>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm font-semibold"
            >
              {ALL_WIDTHS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-lg font-bold text-neutral-400">/</span>
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500">Aspect</label>
            <select
              value={safeAspect}
              onChange={(e) => setAspect(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm font-semibold"
            >
              {aspects.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-lg font-bold text-neutral-400">R</span>
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500">Wheel</label>
            <select
              value={safeRim}
              onChange={(e) => {
                setRim(Number(e.target.value));
                setSelectedRim(null);
              }}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm font-semibold"
            >
              {rims.map((r) => (
                <option key={r} value={r}>
                  {r}"
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current tire specs */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">{currentOd.toFixed(1)}"</p>
            <p className="text-xs text-neutral-500">Overall Diameter</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">
              {sidewallMm.toFixed(0)}mm
            </p>
            <p className="text-xs text-neutral-500">Sidewall Height</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">
              {circumferenceInches(currentOd).toFixed(1)}"
            </p>
            <p className="text-xs text-neutral-500">Circumference</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">
              {revsPerMile(currentOd).toFixed(0)}
            </p>
            <p className="text-xs text-neutral-500">Revs per Mile</p>
          </div>
        </div>
      </div>

      {/* ── Wheel diameter chips ───────────────────────────────────────── */}
      <div className="mt-6">
        <h4 className="font-bold text-neutral-900">Alternate Sizes by Wheel Diameter</h4>
        <p className="mt-1 text-sm text-neutral-600">
          Pick a wheel size — great for upsizing to bigger wheels without changing your overall
          tire height.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rimResults.map(({ rim: r, candidates }) => {
            const isActive = r === activeRim;
            const isOriginal = r === safeRim;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRim(r)}
                className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                {r}"{isOriginal ? " (stock)" : ""}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {candidates.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Candidate list ─────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:grid">
          <span>Tire Size</span>
          <span className="text-right">Diameter</span>
          <span className="text-right">Difference</span>
          <span className="text-right">Speedo @ 60</span>
          <span />
        </div>
        {activeCandidates.length === 0 ? (
          <div className="px-4 py-6 text-sm text-neutral-500">
            No sizes within 3% of your original diameter on {activeRim}" wheels.
          </div>
        ) : (
          activeCandidates.map((c) => {
            const isCurrent = c.size === currentSize;
            const absPct = Math.abs(c.odDiffPercent);
            // Bigger tire → speedometer under-reads. When it shows 60, you're
            // actually going 60 × (newOD / oldOD).
            const actualAt60 = 60 * (c.overallDiameter / currentOd);
            return (
              <div
                key={c.size}
                className={`grid grid-cols-2 items-center gap-2 border-b border-neutral-100 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-3 ${
                  isCurrent ? "bg-blue-50/60" : "bg-white"
                }`}
              >
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className="text-base font-bold text-neutral-900">{c.size}</span>
                  {isCurrent && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      YOUR SIZE
                    </span>
                  )}
                  {!isCurrent && c.isPrimary && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      BEST MATCH
                    </span>
                  )}
                </div>
                <span className="text-right text-sm text-neutral-600">
                  {c.overallDiameter.toFixed(1)}"
                </span>
                <span
                  className={`text-right text-sm font-semibold ${
                    isCurrent ? "text-blue-700" : diffColorClasses(absPct)
                  }`}
                >
                  {c.odDiffPercent >= 0 ? "+" : ""}
                  {c.odDiffPercent.toFixed(1)}%
                </span>
                <span className="text-right text-sm text-neutral-600">
                  {actualAt60.toFixed(1)} mph
                </span>
                <div className="col-span-2 text-right sm:col-span-1">
                  <Link
                    href={`/tires?size=${encodeURIComponent(c.size)}`}
                    className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-600"
                  >
                    Shop {c.size} →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Staying within ±3% of your original overall diameter keeps your speedometer, odometer,
        ABS, and traction control working accurately. Sizes within ±2% are marked Best Match.
        Always verify fender and suspension clearance before changing width or wheel diameter.
      </p>
    </div>
  );
}
