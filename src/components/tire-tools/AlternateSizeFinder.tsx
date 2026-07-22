"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import tireSizesData from "@/data/tire-sizes.json";
import {
  parseMetricSize,
  calculateOverallDiameter,
  generateAllCandidatesForOd,
  getFlotationEntries,
  formatFlotationSize,
  type PlusSizeCandidate,
} from "@/lib/tirePlusSizing";

/**
 * AlternateSizeFinder
 *
 * Customer-facing "what other tire sizes fit?" tool.
 *
 * 1. Pick your current tire size — metric (265/70R17) or flotation
 *    (33x12.50R17) — via dropdowns fed by the REAL tire-sizes.json database,
 *    so only real, orderable sizes are selectable.
 * 2. See full specs: overall diameter, sidewall, circumference, revs/mile.
 * 3. Pick any wheel diameter and see every alternate size — metric AND
 *    flotation mixed together — within ±3% of your original overall diameter
 *    (±2% = "Best Match"). A 33x12.50R26 shows up right next to its metric
 *    twin 295/30R26.
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

// Flotation sizes, sorted by diameter → rim → width
const ALL_FLOTATION = getFlotationEntries().sort(
  (a, b) => a.dia - b.dia || a.rim - b.rim || a.width - b.width
);

// Every wheel diameter available in either DB (drives the chips)
const ALL_RIMS = [
  ...new Set([...ALL_PARSED.map((p) => p.rim), ...ALL_FLOTATION.map((f) => f.rim)]),
].sort((a, b) => a - b);

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

type SizeMode = "metric" | "flotation";

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

  const [mode, setMode] = useState<SizeMode>("metric");

  // Metric input state
  const [width, setWidth] = useState<number>(initialParsed?.width ?? 265);
  const [aspect, setAspect] = useState<number>(initialParsed?.aspect ?? 70);
  const [rim, setRim] = useState<number>(initialParsed?.rim ?? 17);

  // Flotation input state (index into ALL_FLOTATION)
  const [flotIndex, setFlotIndex] = useState<number>(() => {
    const i = ALL_FLOTATION.findIndex((f) => f.dia === 33 && f.width === 12.5 && f.rim === 17);
    return i >= 0 ? i : 0;
  });

  const [selectedRim, setSelectedRim] = useState<number | null>(null);

  // Tire height upsize: 0 = stock height, 1/2/3 = inches ADDED to overall diameter
  const [heightDelta, setHeightDelta] = useState<number>(0);

  // Cascade: keep aspect/rim valid for the chosen width
  const aspects = useMemo(() => aspectsForWidth(width), [width]);
  const safeAspect = aspects.includes(aspect) ? aspect : aspects[Math.floor(aspects.length / 2)];
  const rims = useMemo(() => rimsForWidthAspect(width, safeAspect), [width, safeAspect]);
  const safeRim = rims.includes(rim) ? rim : rims[Math.floor(rims.length / 2)];

  const flotation = ALL_FLOTATION[Math.min(flotIndex, ALL_FLOTATION.length - 1)];

  // Current tire facts (shared by both modes)
  const currentSize =
    mode === "metric" ? `${width}/${safeAspect}R${safeRim}` : formatFlotationSize(flotation);
  const currentRim = mode === "metric" ? safeRim : flotation.rim;
  const currentOd =
    mode === "metric"
      ? calculateOverallDiameter(width, safeAspect, safeRim)
      : flotation.dia;
  const sidewallLabel =
    mode === "metric"
      ? `${((width * safeAspect) / 100).toFixed(0)}mm`
      : `${((flotation.dia - flotation.rim) / 2).toFixed(1)}"`;

  // Target diameter = current OD + optional upsize (+1" / +2" / +3")
  const targetOd = currentOd + heightDelta;

  // Candidates per wheel diameter (metric + flotation, drives the chips)
  const rimResults = useMemo(() => {
    return ALL_RIMS.map((r) => ({
      rim: r,
      candidates: generateAllCandidatesForOd(targetOd, r),
    })).filter((r) => r.candidates.length > 0);
  }, [targetOd]);

  const activeRim =
    selectedRim !== null && rimResults.some((r) => r.rim === selectedRim)
      ? selectedRim
      : currentRim;

  const activeCandidates: PlusSizeCandidate[] =
    rimResults.find((r) => r.rim === activeRim)?.candidates ?? [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
      <h3 className="text-xl font-bold text-neutral-900">Alternate Tire Size Finder</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Enter your current tire size, then pick a wheel diameter to see every size that keeps
        your speedometer accurate (within 3% of original diameter) — including flotation sizes
        like 33x12.50R17.
      </p>

      {/* ── Current size input ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl bg-neutral-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-neutral-900">Your Current Tire Size</h4>
          <div className="flex rounded-full border border-neutral-200 bg-white p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode("metric");
                setSelectedRim(null);
              }}
              className={`rounded-full px-3 py-1 transition-colors ${
                mode === "metric" ? "bg-neutral-900 text-white" : "text-neutral-500"
              }`}
            >
              Metric
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("flotation");
                setSelectedRim(null);
              }}
              className={`rounded-full px-3 py-1 transition-colors ${
                mode === "flotation" ? "bg-neutral-900 text-white" : "text-neutral-500"
              }`}
            >
              Flotation
            </button>
          </div>
        </div>

        {mode === "metric" ? (
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
        ) : (
          <div className="mt-3">
            <label className="block text-xs font-medium text-neutral-500">
              Flotation Size (Height x Width - Wheel)
            </label>
            <select
              value={flotIndex}
              onChange={(e) => {
                setFlotIndex(Number(e.target.value));
                setSelectedRim(null);
              }}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm font-semibold sm:max-w-xs"
            >
              {ALL_FLOTATION.map((f, i) => (
                <option key={formatFlotationSize(f)} value={i}>
                  {formatFlotationSize(f)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current tire specs */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">{currentOd.toFixed(1)}"</p>
            <p className="text-xs text-neutral-500">Overall Diameter</p>
          </div>
          <div className="rounded-lg bg-white px-3 py-2.5">
            <p className="text-lg font-bold text-neutral-900">{sidewallLabel}</p>
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
        <h4 className="font-bold text-neutral-900">Tire Height</h4>
        <p className="mt-1 text-sm text-neutral-600">
          Stay stock height, or go taller for a more aggressive stance and extra ground
          clearance.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((d) => {
            const isActive = heightDelta === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setHeightDelta(d)}
                className={`rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
                  isActive
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-400"
                }`}
              >
                {d === 0 ? "Stock Height" : `+${d}"`}
                {d > 0 && (
                  <span
                    className={`ml-1.5 text-[10px] font-semibold ${
                      isActive ? "text-white/70" : "text-neutral-400"
                    }`}
                  >
                    ~{(currentOd + d).toFixed(0)}"
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {heightDelta > 0 && (
          <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <span className="text-lg leading-none">⚠️</span>
            <div className="text-sm text-amber-900">
              <p className="font-bold">
                Taller than stock (+{heightDelta}") — fitment is not guaranteed.
              </p>
              <p className="mt-1">
                Oversized tires can rub the fenders, frame, or suspension components at full
                steering lock or full compression. Depending on your vehicle, you may need a
                leveling kit or lift, fender trimming, wheel spacers, or different wheel
                offset. Your speedometer will also read slower than your true speed unless
                recalibrated — the “Speedo @ 60” column shows the actual speed for each size.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h4 className="font-bold text-neutral-900">
          {heightDelta === 0
            ? "Alternate Sizes by Wheel Diameter"
            : `Sizes ~${targetOd.toFixed(0)}" Tall by Wheel Diameter`}
        </h4>
        <p className="mt-1 text-sm text-neutral-600">
          {heightDelta === 0
            ? "Pick a wheel size — great for upsizing to bigger wheels without changing your overall tire height."
            : `Showing sizes close to ${targetOd.toFixed(1)}" overall diameter (your stock ${currentOd.toFixed(1)}" + ${heightDelta}").`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rimResults.map(({ rim: r, candidates }) => {
            const isActive = r === activeRim;
            const isOriginal = r === currentRim;
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
            No sizes within 3% of {heightDelta === 0 ? "your original" : "the target"} diameter
            on {activeRim}" wheels.
          </div>
        ) : (
          activeCandidates.map((c) => {
            const isCurrent = c.size === currentSize && heightDelta === 0;
            // Difference shown vs YOUR CURRENT tire (not the upsize target) so
            // the customer always sees the real change from what's on the truck.
            const diffVsCurrentPct = ((c.overallDiameter - currentOd) / currentOd) * 100;
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
                  {c.isFlotation && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">
                      FLOTATION
                    </span>
                  )}
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
                    isCurrent
                      ? "text-blue-700"
                      : heightDelta > 0
                        ? "text-amber-600"
                        : diffColorClasses(absPct)
                  }`}
                >
                  {diffVsCurrentPct >= 0 ? "+" : ""}
                  {diffVsCurrentPct.toFixed(1)}%
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
        ABS, and traction control working accurately. Sizes within ±2% of the selected height
        are marked Best Match. Flotation sizes (like 33x12.50R17) use their nominal diameter.
        The % difference column always compares against your current tire. Always verify fender
        and suspension clearance before changing width, height, or wheel diameter — taller
        setups may require trimming, a leveling kit, or a lift.
      </p>
    </div>
  );
}
