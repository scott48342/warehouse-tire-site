/**
 * 2026-09-20 (Codex independent review 17:47 on b1886aeb): the tires-page package sidebar
 * (PackageSummary) still printed a staggered WHEEL set as 4 x blended each - RIDLER
 * 2 x 336.12 + 2 x 345.41 = 1363.06 showed as 4 x 340.77 = 1363.08 and the wheel subtotal
 * 2709.88 instead of 2709.86 - while the grand total (cartLineTotal) was already right.
 * Contract: every money figure in PackageSummary (wheel rows, tire rows, both subtotals) comes
 * from cartLineTotal, so a mixed staggered wheel + staggered tire package sums exactly.
 * SmartTireUpsell states only what the recommendation API proves (rim diameter) - the API
 * returns no vehicle certification, so no fit / no-modification claims.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { cartLineTotal, type CartWheelItem, type CartTireItem } from "@/lib/cart/CartContext";

const read = (p: string) => readFileSync(resolve(__dirname, "../../../", p), "utf-8");

const ridler: CartWheelItem = {
  type: "wheel", sku: "RID-F", rearSku: "RID-R", brand: "Ridler", model: "607", finish: "Grey",
  diameter: "19", width: "8.5", rearDiameter: "20", rearWidth: "10", quantity: 4,
  unitPrice: 340.77, frontUnitPrice: 336.12, rearUnitPrice: 345.41, staggered: true,
};
const squareWheel: CartWheelItem = {
  type: "wheel", sku: "SQ-1", brand: "Touren", model: "TR04", finish: "Black", diameter: "19", width: "8.5",
  quantity: 4, unitPrice: 336.7, staggered: false,
};
const lexani: CartTireItem = {
  type: "tire", sku: "LX-F", rearSku: "LX-R", brand: "Lexani", model: "LX-Twenty", size: "265/40R19", rearSize: "275/35R20",
  quantity: 4, unitPrice: 131.0, frontUnitPrice: 129.99, rearUnitPrice: 132.0, staggered: true, source: "tireweb:atd",
};

describe("PackageSummary money contract: exact 2F+2R per line, wheels and tires alike", () => {
  test("staggered wheel line is 2 x front + 2 x rear (1363.06), not 4 x blended (1363.08)", () => {
    expect(cartLineTotal(ridler)).toBe(1363.06);
    expect(Math.round(ridler.unitPrice * 4 * 100) / 100).toBe(1363.08);
  });
  test("mixed package (staggered wheels + square wheels + staggered tires) sums exactly", () => {
    const wheels = [ridler, squareWheel];
    const tires = [lexani];
    const wheelSubtotal = wheels.reduce((s, w) => s + cartLineTotal(w), 0);
    const tireSubtotal = tires.reduce((s, t) => s + cartLineTotal(t), 0);
    expect(wheelSubtotal).toBeCloseTo(1363.06 + 1346.8, 2); // 2709.86 (Codex saw 2709.88)
    expect(tireSubtotal).toBeCloseTo(523.98, 2); // Codex saw 524.00 before b1886aeb
    const blendedWheels = wheels.reduce((s, w) => s + w.unitPrice * w.quantity, 0);
    expect(Math.round(blendedWheels * 100) / 100).toBe(2709.88);
    expect(Math.round((wheelSubtotal + tireSubtotal) * 100) / 100).toBe(3233.84);
  });
  test("square wheel line unchanged: unitPrice x quantity", () => {
    expect(cartLineTotal(squareWheel)).toBe(1346.8);
  });
  test("a staggered wheel missing an axle price falls back to unit x qty (never NaN, never 2+2 of a guess)", () => {
    expect(cartLineTotal({ ...ridler, rearUnitPrice: undefined })).toBe(1363.08);
  });
});

describe("PackageSummary source pins (money comes only from cartLineTotal)", () => {
  const src = read("src/components/PackageSummary.tsx");
  test("no unitPrice x quantity arithmetic on wheel or tire lines", () => {
    // accessories still multiply (no axle pricing on accessories); wheels/tires must not
    const wheelOrTireMath = src.match(/\(\s*[wt]\.unitPrice \?\? 0\s*\)\s*\*\s*\(\s*[wt]\.quantity \?\? 0\s*\)/g) ?? [];
    expect(wheelOrTireMath).toEqual([]);
    expect(src).toMatch(/wheelSubtotal = wheels\.reduce\(\(sum, w\) => sum \+ cartLineTotal\(w\), 0\)/);
    expect(src).toMatch(/tireSubtotal = tires\.reduce\(\(sum, t\) => sum \+ cartLineTotal\(t\), 0\)/);
  });
  test("staggered wheel rows print the axle split and both SKUs from the shared wheel-line helper", () => {
    expect(src).toMatch(/import \{ isStaggeredWheelLine, rearAxleSpec, axleSizeLabel \} from "@\/lib\/cart\/staggeredWheelLine"/);
    expect(src).toMatch(/2 &times; \$\{axle\.front\.toFixed\(2\)\} front \+ 2 &times; \$\{axle\.rear\.toFixed\(2\)\} rear/);
    expect(src).toMatch(/data-testid="package-summary-wheel-axles"/);
    expect(src).toMatch(/Rear &times;2: \{rearLabel\} &middot; \{rear\.sku\}/);
    expect(src).toMatch(/\$\{cartLineTotal\(w\)\.toFixed\(2\)\}/);
    expect(src).toMatch(/\$\{cartLineTotal\(w\)\.toFixed\(0\)\}/);
  });
});

describe("SmartTireUpsell makes no fit claims the recommendation API cannot support", () => {
  const src = read("src/components/SmartTireUpsell.tsx");
  const api = read("src/app/api/recommendations/tire-for-wheels/route.ts");
  test("API response carries no certification field, so the card must not claim fit", () => {
    expect(api).not.toMatch(/fitCertified|certified:/);
    expect(src).not.toMatch(/Fits your selected wheels/);
    expect(src).not.toMatch(/No modifications needed/);
  });
  test("card states the rim-diameter fact and the neutral copy", () => {
    expect(src).toMatch(/Rim diameter matches your \{wheelDiameter\}&quot; wheels/);
    expect(src).toMatch(/Fit not yet confirmed/);
    expect(src).toMatch(/data-testid="smart-tire-upsell-facts"/);
  });
});
