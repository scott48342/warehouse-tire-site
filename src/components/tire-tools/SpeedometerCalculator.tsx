"use client";

import { useState, useMemo } from "react";

/**
 * Calculate tire diameter in inches from metric size
 * Formula: (2 * (width * aspect / 2540)) + rim
 */
function calculateDiameter(width: number, aspect: number, rim: number): number {
  const sidewallHeight = (width * aspect) / 100 / 25.4; // Convert mm to inches
  return rim + 2 * sidewallHeight;
}

/**
 * Calculate actual speed based on tire size difference
 */
function calculateActualSpeed(
  displayedSpeed: number,
  originalDiameter: number,
  newDiameter: number
): number {
  return (displayedSpeed * newDiameter) / originalDiameter;
}

/**
 * Calculate speedometer error percentage
 */
function calculateError(originalDiameter: number, newDiameter: number): number {
  return ((newDiameter - originalDiameter) / originalDiameter) * 100;
}

// Metric sizes
const COMMON_WIDTHS = [195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315, 325, 335];
const COMMON_ASPECTS = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
const COMMON_RIMS = [15, 16, 17, 18, 19, 20, 22, 24];

// Flotation sizes - format: { diameter, width, display }
const FLOTATION_SIZES = [
  { diameter: 29, width: 9.50, display: "29x9.50" },
  { diameter: 30, width: 9.50, display: "30x9.50" },
  { diameter: 31, width: 10.50, display: "31x10.50" },
  { diameter: 32, width: 11.50, display: "32x11.50" },
  { diameter: 33, width: 10.50, display: "33x10.50" },
  { diameter: 33, width: 12.50, display: "33x12.50" },
  { diameter: 33, width: 13.50, display: "33x13.50" },
  { diameter: 34, width: 10.50, display: "34x10.50" },
  { diameter: 35, width: 10.50, display: "35x10.50" },
  { diameter: 35, width: 11.50, display: "35x11.50" },
  { diameter: 35, width: 12.50, display: "35x12.50" },
  { diameter: 35, width: 13.50, display: "35x13.50" },
  { diameter: 36, width: 13.50, display: "36x13.50" },
  { diameter: 37, width: 12.50, display: "37x12.50" },
  { diameter: 37, width: 13.50, display: "37x13.50" },
  { diameter: 38, width: 13.50, display: "38x13.50" },
  { diameter: 38, width: 15.50, display: "38x15.50" },
  { diameter: 39, width: 13.50, display: "39x13.50" },
  { diameter: 40, width: 13.50, display: "40x13.50" },
  { diameter: 40, width: 15.50, display: "40x15.50" },
  { diameter: 42, width: 14.50, display: "42x14.50" },
  { diameter: 42, width: 15.50, display: "42x15.50" },
  { diameter: 44, width: 19.50, display: "44x19.50" },
  { diameter: 46, width: 19.50, display: "46x19.50" },
];

const FLOTATION_RIMS = [15, 16, 17, 18, 20, 22, 24];

type SizeMode = "metric" | "flotation";

export function SpeedometerCalculator() {
  // Mode toggle
  const [origMode, setOrigMode] = useState<SizeMode>("metric");
  const [newMode, setNewMode] = useState<SizeMode>("metric");

  // Original tire - metric
  const [origWidth, setOrigWidth] = useState(265);
  const [origAspect, setOrigAspect] = useState(65);
  const [origRim, setOrigRim] = useState(18);

  // Original tire - flotation
  const [origFlotation, setOrigFlotation] = useState(0); // index into FLOTATION_SIZES
  const [origFlotationRim, setOrigFlotationRim] = useState(15);

  // New tire - metric
  const [newWidth, setNewWidth] = useState(285);
  const [newAspect, setNewAspect] = useState(70);
  const [newRim, setNewRim] = useState(18);

  // New tire - flotation
  const [newFlotation, setNewFlotation] = useState(4); // 33x12.50
  const [newFlotationRim, setNewFlotationRim] = useState(17);

  const results = useMemo(() => {
    // Calculate original diameter based on mode
    const origDiameter = origMode === "metric"
      ? calculateDiameter(origWidth, origAspect, origRim)
      : FLOTATION_SIZES[origFlotation].diameter;

    // Calculate new diameter based on mode
    const newDiameter = newMode === "metric"
      ? calculateDiameter(newWidth, newAspect, newRim)
      : FLOTATION_SIZES[newFlotation].diameter;

    const error = calculateError(origDiameter, newDiameter);

    // Calculate actual speeds at common displayed speeds
    const speeds = [30, 45, 60, 70, 80];
    const speedComparisons = speeds.map((displayed) => ({
      displayed,
      actual: calculateActualSpeed(displayed, origDiameter, newDiameter),
    }));

    // Build display strings
    const origDisplay = origMode === "metric"
      ? `${origWidth}/${origAspect}R${origRim}`
      : `${FLOTATION_SIZES[origFlotation].display}R${origFlotationRim}`;
    
    const newDisplay = newMode === "metric"
      ? `${newWidth}/${newAspect}R${newRim}`
      : `${FLOTATION_SIZES[newFlotation].display}R${newFlotationRim}`;

    return {
      origDiameter,
      newDiameter,
      origDisplay,
      newDisplay,
      diameterDiff: newDiameter - origDiameter,
      error,
      speedComparisons,
      circumference: {
        orig: origDiameter * Math.PI,
        new: newDiameter * Math.PI,
      },
      revsPerMile: {
        orig: 63360 / (origDiameter * Math.PI),
        new: 63360 / (newDiameter * Math.PI),
      },
    };
  }, [origMode, origWidth, origAspect, origRim, origFlotation, origFlotationRim,
      newMode, newWidth, newAspect, newRim, newFlotation, newFlotationRim]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h3 className="text-xl font-bold text-neutral-900">Speedometer Calculator</h3>
      <p className="mt-1 text-sm text-neutral-600">
        See how changing tire size affects your speedometer reading
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Original Tire */}
        <div className="rounded-xl bg-neutral-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-neutral-900">Original Tire Size</h4>
            <div className="flex rounded-lg bg-neutral-200 p-0.5 text-xs">
              <button
                onClick={() => setOrigMode("metric")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  origMode === "metric" ? "bg-white shadow-sm font-medium" : "text-neutral-600"
                }`}
              >
                Metric
              </button>
              <button
                onClick={() => setOrigMode("flotation")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  origMode === "flotation" ? "bg-white shadow-sm font-medium" : "text-neutral-600"
                }`}
              >
                Flotation
              </button>
            </div>
          </div>

          {origMode === "metric" ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Width</label>
                <select
                  value={origWidth}
                  onChange={(e) => setOrigWidth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_WIDTHS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Aspect</label>
                <select
                  value={origAspect}
                  onChange={(e) => setOrigAspect(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_ASPECTS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Rim</label>
                <select
                  value={origRim}
                  onChange={(e) => setOrigRim(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_RIMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Size</label>
                <select
                  value={origFlotation}
                  onChange={(e) => setOrigFlotation(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {FLOTATION_SIZES.map((s, i) => (
                    <option key={i} value={i}>{s.display}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Rim</label>
                <select
                  value={origFlotationRim}
                  onChange={(e) => setOrigFlotationRim(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {FLOTATION_RIMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-lg font-bold text-neutral-700">
            {results.origDisplay}
          </p>
          <p className="text-center text-sm text-neutral-500">
            {results.origDiameter.toFixed(2)}" diameter
          </p>
        </div>

        {/* New Tire */}
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-neutral-900">New Tire Size</h4>
            <div className="flex rounded-lg bg-blue-100 p-0.5 text-xs">
              <button
                onClick={() => setNewMode("metric")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  newMode === "metric" ? "bg-white shadow-sm font-medium" : "text-neutral-600"
                }`}
              >
                Metric
              </button>
              <button
                onClick={() => setNewMode("flotation")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  newMode === "flotation" ? "bg-white shadow-sm font-medium" : "text-neutral-600"
                }`}
              >
                Flotation
              </button>
            </div>
          </div>

          {newMode === "metric" ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Width</label>
                <select
                  value={newWidth}
                  onChange={(e) => setNewWidth(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_WIDTHS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Aspect</label>
                <select
                  value={newAspect}
                  onChange={(e) => setNewAspect(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_ASPECTS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Rim</label>
                <select
                  value={newRim}
                  onChange={(e) => setNewRim(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {COMMON_RIMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Size</label>
                <select
                  value={newFlotation}
                  onChange={(e) => setNewFlotation(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {FLOTATION_SIZES.map((s, i) => (
                    <option key={i} value={i}>{s.display}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 whitespace-nowrap">Rim</label>
                <select
                  value={newFlotationRim}
                  onChange={(e) => setNewFlotationRim(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-2 text-sm"
                >
                  {FLOTATION_RIMS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-lg font-bold text-blue-700">
            {results.newDisplay}
          </p>
          <p className="text-center text-sm text-blue-600">
            {results.newDiameter.toFixed(2)}" diameter
          </p>
        </div>
      </div>

      {/* Results */}
      <div className="mt-6">
        <div className={`rounded-xl p-4 ${
          Math.abs(results.error) <= 3 
            ? "bg-green-50 border border-green-200" 
            : Math.abs(results.error) <= 5 
              ? "bg-yellow-50 border border-yellow-200"
              : "bg-red-50 border border-red-200"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-600">Diameter Difference</p>
              <p className="text-2xl font-bold">
                {results.diameterDiff > 0 ? "+" : ""}{results.diameterDiff.toFixed(2)}"
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-600">Speedometer Error</p>
              <p className={`text-2xl font-bold ${
                Math.abs(results.error) <= 3 
                  ? "text-green-600" 
                  : Math.abs(results.error) <= 5 
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}>
                {results.error > 0 ? "+" : ""}{results.error.toFixed(1)}%
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm text-neutral-600">
            {results.error > 0 
              ? `Your speedometer will read SLOWER than actual speed. At a displayed 60 mph, you're actually going ${results.speedComparisons[2].actual.toFixed(1)} mph.`
              : results.error < 0
                ? `Your speedometer will read FASTER than actual speed. At a displayed 60 mph, you're actually going ${results.speedComparisons[2].actual.toFixed(1)} mph.`
                : "No speedometer error - these tires are the same diameter."
            }
          </p>
        </div>

        {/* Speed comparison table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-neutral-600">Speedometer Shows</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-600">Actual Speed</th>
                <th className="px-4 py-2 text-left font-medium text-neutral-600">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.speedComparisons.map((row) => (
                <tr key={row.displayed}>
                  <td className="px-4 py-2">{row.displayed} mph</td>
                  <td className="px-4 py-2 font-medium">{row.actual.toFixed(1)} mph</td>
                  <td className={`px-4 py-2 ${
                    row.actual > row.displayed ? "text-red-600" : row.actual < row.displayed ? "text-blue-600" : ""
                  }`}>
                    {row.actual > row.displayed ? "+" : ""}{(row.actual - row.displayed).toFixed(1)} mph
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Additional stats */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-neutral-50 p-3">
            <p className="text-neutral-500">Revolutions per Mile</p>
            <p className="font-medium">Original: {results.revsPerMile.orig.toFixed(0)}</p>
            <p className="font-medium">New: {results.revsPerMile.new.toFixed(0)}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 p-3">
            <p className="text-neutral-500">Circumference</p>
            <p className="font-medium">Original: {results.circumference.orig.toFixed(1)}"</p>
            <p className="font-medium">New: {results.circumference.new.toFixed(1)}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
