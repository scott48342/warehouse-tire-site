"use client";

import { useState, useMemo } from "react";

/**
 * Calculate tire diameter in inches
 */
function calculateDiameter(width: number, aspect: number, rim: number): number {
  const sidewallHeight = (width * aspect) / 100 / 25.4;
  return rim + 2 * sidewallHeight;
}

/**
 * Calculate sidewall height in mm
 */
function calculateSidewall(width: number, aspect: number): number {
  return (width * aspect) / 100;
}

/**
 * Generate plus size options for a given original tire
 */
function generatePlusSizes(
  origWidth: number,
  origAspect: number,
  origRim: number
): Array<{
  width: number;
  aspect: number;
  rim: number;
  diameter: number;
  diameterDiff: number;
  sidewall: number;
  error: number;
  label: string;
}> {
  const origDiameter = calculateDiameter(origWidth, origAspect, origRim);
  const results = [];

  // Plus Zero (same rim, wider tire)
  const plusZeroWidths = [origWidth + 10, origWidth + 20];
  for (const width of plusZeroWidths) {
    // Find aspect ratio that maintains diameter
    for (let aspect = origAspect - 20; aspect <= origAspect; aspect += 5) {
      const diameter = calculateDiameter(width, aspect, origRim);
      const error = ((diameter - origDiameter) / origDiameter) * 100;
      if (Math.abs(error) <= 3) {
        results.push({
          width,
          aspect,
          rim: origRim,
          diameter,
          diameterDiff: diameter - origDiameter,
          sidewall: calculateSidewall(width, aspect),
          error,
          label: "Plus Zero",
        });
        break;
      }
    }
  }

  // Plus One (+1" rim)
  const plusOneRim = origRim + 1;
  const plusOneWidths = [origWidth + 10, origWidth + 20, origWidth + 30];
  for (const width of plusOneWidths) {
    for (let aspect = origAspect - 25; aspect <= origAspect - 5; aspect += 5) {
      const diameter = calculateDiameter(width, aspect, plusOneRim);
      const error = ((diameter - origDiameter) / origDiameter) * 100;
      if (Math.abs(error) <= 3) {
        results.push({
          width,
          aspect,
          rim: plusOneRim,
          diameter,
          diameterDiff: diameter - origDiameter,
          sidewall: calculateSidewall(width, aspect),
          error,
          label: "Plus One",
        });
        break;
      }
    }
  }

  // Plus Two (+2" rim)
  const plusTwoRim = origRim + 2;
  const plusTwoWidths = [origWidth + 20, origWidth + 30, origWidth + 40];
  for (const width of plusTwoWidths) {
    for (let aspect = origAspect - 30; aspect <= origAspect - 10; aspect += 5) {
      const diameter = calculateDiameter(width, aspect, plusTwoRim);
      const error = ((diameter - origDiameter) / origDiameter) * 100;
      if (Math.abs(error) <= 3) {
        results.push({
          width,
          aspect,
          rim: plusTwoRim,
          diameter,
          diameterDiff: diameter - origDiameter,
          sidewall: calculateSidewall(width, aspect),
          error,
          label: "Plus Two",
        });
        break;
      }
    }
  }

  // Plus Three (+3" rim) if original is 17" or larger
  if (origRim >= 17) {
    const plusThreeRim = origRim + 3;
    const plusThreeWidths = [origWidth + 30, origWidth + 40, origWidth + 50];
    for (const width of plusThreeWidths) {
      for (let aspect = origAspect - 35; aspect <= origAspect - 15; aspect += 5) {
        const diameter = calculateDiameter(width, aspect, plusThreeRim);
        const error = ((diameter - origDiameter) / origDiameter) * 100;
        if (Math.abs(error) <= 3) {
          results.push({
            width,
            aspect,
            rim: plusThreeRim,
            diameter,
            diameterDiff: diameter - origDiameter,
            sidewall: calculateSidewall(width, aspect),
            error,
            label: "Plus Three",
          });
          break;
        }
      }
    }
  }

  return results;
}

const COMMON_WIDTHS = [185, 195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305, 315];
const COMMON_ASPECTS = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
const COMMON_RIMS = [15, 16, 17, 18, 19, 20, 22];

export function PlusSizingCalculator() {
  const [width, setWidth] = useState(225);
  const [aspect, setAspect] = useState(60);
  const [rim, setRim] = useState(17);

  const results = useMemo(() => {
    const origDiameter = calculateDiameter(width, aspect, rim);
    const origSidewall = calculateSidewall(width, aspect);
    const plusSizes = generatePlusSizes(width, aspect, rim);

    return {
      original: {
        diameter: origDiameter,
        sidewall: origSidewall,
        circumference: origDiameter * Math.PI,
      },
      plusSizes,
    };
  }, [width, aspect, rim]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h3 className="text-xl font-bold text-neutral-900">Plus Sizing Calculator</h3>
      <p className="mt-1 text-sm text-neutral-600">
        Find equivalent tire sizes when upgrading to larger wheels
      </p>

      {/* Original Size Input */}
      <div className="mt-6 rounded-xl bg-neutral-50 p-4">
        <h4 className="font-bold text-neutral-900">Your Current Tire Size</h4>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500">Width (mm)</label>
            <select
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {COMMON_WIDTHS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500">Aspect %</label>
            <select
              value={aspect}
              onChange={(e) => setAspect(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {COMMON_ASPECTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500">Rim (in)</label>
            <select
              value={rim}
              onChange={(e) => setRim(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            >
              {COMMON_RIMS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-white px-4 py-3">
          <div>
            <p className="text-2xl font-bold text-neutral-900">
              {width}/{aspect}R{rim}
            </p>
            <p className="text-sm text-neutral-500">Original Size</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-neutral-700">
              {results.original.diameter.toFixed(1)}" ⌀
            </p>
            <p className="text-sm text-neutral-500">
              {results.original.sidewall.toFixed(0)}mm sidewall
            </p>
          </div>
        </div>
      </div>

      {/* Plus Size Explanation */}
      <div className="mt-6 rounded-xl bg-blue-50 p-4">
        <h4 className="font-bold text-blue-900">What is Plus Sizing?</h4>
        <p className="mt-2 text-sm text-blue-800">
          Plus sizing means increasing wheel diameter while decreasing tire sidewall height 
          to maintain the same overall diameter. This improves handling and appearance 
          without affecting speedometer accuracy.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-blue-800">
          <li><strong>Plus Zero:</strong> Same rim, wider tire</li>
          <li><strong>Plus One:</strong> +1" rim diameter</li>
          <li><strong>Plus Two:</strong> +2" rim diameter</li>
          <li><strong>Plus Three:</strong> +3" rim diameter</li>
        </ul>
      </div>

      {/* Results */}
      <div className="mt-6">
        <h4 className="font-bold text-neutral-900">Recommended Plus Sizes</h4>
        <p className="mt-1 text-sm text-neutral-600">
          These sizes maintain similar overall diameter (±3%)
        </p>

        {results.plusSizes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {results.plusSizes.map((size, idx) => (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${
                  size.label === "Plus One"
                    ? "border-green-200 bg-green-50"
                    : size.label === "Plus Two"
                      ? "border-blue-200 bg-blue-50"
                      : size.label === "Plus Three"
                        ? "border-purple-200 bg-purple-50"
                        : "border-neutral-200 bg-neutral-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                      size.label === "Plus One"
                        ? "bg-green-200 text-green-800"
                        : size.label === "Plus Two"
                          ? "bg-blue-200 text-blue-800"
                          : size.label === "Plus Three"
                            ? "bg-purple-200 text-purple-800"
                            : "bg-neutral-200 text-neutral-800"
                    }`}>
                      {size.label}
                    </span>
                    <p className="mt-2 text-xl font-bold text-neutral-900">
                      {size.width}/{size.aspect}R{size.rim}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-neutral-500">
                      {size.diameter.toFixed(1)}" diameter
                    </p>
                    <p className="text-sm text-neutral-500">
                      {size.sidewall.toFixed(0)}mm sidewall
                    </p>
                    <p className={`text-sm font-medium ${
                      Math.abs(size.error) < 1 ? "text-green-600" : "text-yellow-600"
                    }`}>
                      {size.error > 0 ? "+" : ""}{size.error.toFixed(1)}% difference
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            No standard plus sizes found for this combination. Try a more common starting size.
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <h4 className="font-bold text-neutral-900">Plus Sizing Tips</h4>
        <ul className="mt-2 space-y-2 text-sm text-neutral-600">
          <li className="flex gap-2">
            <span className="text-green-500">✓</span>
            Keep overall diameter within 3% of original for accurate speedometer
          </li>
          <li className="flex gap-2">
            <span className="text-green-500">✓</span>
            Lower profile tires improve handling but ride firmer
          </li>
          <li className="flex gap-2">
            <span className="text-green-500">✓</span>
            Check fender clearance before going wider
          </li>
          <li className="flex gap-2">
            <span className="text-yellow-500">⚠</span>
            More than Plus Two may require suspension modifications
          </li>
        </ul>
      </div>
    </div>
  );
}
