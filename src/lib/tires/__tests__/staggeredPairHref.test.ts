/**
 * 2026-09-20 (Codex live 16:59): on a tire-results pair card, "Select Staggered Set" carried
 * rearSku/rearSize but "View Details" linked to the bare front PDP, which then sold a square
 * set of 4 fronts. Both links must be the same pair href incl. trim/modification; the tires
 * package sidebar must print the exact 2F+2R line total, not blended unit x4.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { buildStaggeredPairHref, readStaggeredPairParams, PAIR_FORWARD_KEYS } from "../staggeredPairContext";

const ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PAIR = {
  frontPartNumber: "1035144",
  frontSize: "265/40R19",
  pairId: "1035144:1035212",
  rearPartNumber: "1035212",
  rearSize: "275/35R20",
  year: "2020",
  make: "Ford",
  model: "Mustang",
  trim: "GT Performance Pack",
  modification: "ford-mustang-gt-performance-pack-1db4ea26c6",
};

describe("buildStaggeredPairHref", () => {
  test("carries the full pair and the vehicle incl. trim/modification", () => {
    const href = buildStaggeredPairHref(PAIR);
    const u = new URL(href, "http://x");
    expect(u.pathname).toBe("/tires/1035144");
    expect(u.searchParams.get("size")).toBe("265/40R19");
    expect(u.searchParams.get("staggeredPair")).toBe("1035144:1035212");
    expect(u.searchParams.get("rearSku")).toBe("1035212");
    expect(u.searchParams.get("rearSize")).toBe("275/35R20");
    expect(u.searchParams.get("trim")).toBe("GT Performance Pack");
    expect(u.searchParams.get("modification")).toBe(PAIR.modification);
    for (const k of ["year", "make", "model"]) expect(u.searchParams.get(k)).toBe((PAIR as Record<string, string>)[k]);
  });

  test("what the card sends is exactly what the PDP reader accepts and the redirect forwards", () => {
    const u = new URL(buildStaggeredPairHref(PAIR), "http://x");
    const sp = Object.fromEntries(u.searchParams.entries());
    expect(readStaggeredPairParams(sp)).toEqual({ rearSku: "1035212", rearSize: "275/35R20", pairId: "1035144:1035212" });
    for (const k of PAIR_FORWARD_KEYS) expect(u.searchParams.has(k)).toBe(true);
  });

  test("omits empty vehicle fields instead of sending 'undefined'/''", () => {
    const href = buildStaggeredPairHref({ ...PAIR, trim: "", modification: null, year: undefined });
    expect(href).not.toMatch(/trim=|modification=|year=|undefined/);
  });
});

describe("tires results pair card (source pin)", () => {
  const src = read("src/app/tires/page.tsx");
  test("both pair-card links use buildStaggeredPairHref with trim + modification", () => {
    expect(src).toMatch(/import \{ buildStaggeredPairHref \} from "@\/lib\/tires\/staggeredPairContext"/);
    const block = src.slice(src.indexOf("const pairHref = buildStaggeredPairHref("), src.indexOf("View Details\n"));
    expect(block).toMatch(/trim,\s*\n\s*modification,/);
    expect(block.match(/href=\{pairHref\}/g)?.length).toBe(2);
    expect(block).toMatch(/data-testid="pair-select-link"/);
    expect(block).toMatch(/data-testid="pair-details-link"/);
  });
  test("no pair-card link builds a bare front PDP href without the rear", () => {
    expect(src).not.toMatch(/href=\{`\/tires\/\$\{pair\.front\.partNumber\}\?size=[^`]*`\}/);
  });
});

describe("PackageSummary (tires page sidebar) - source pin", () => {
  const src = read("src/components/PackageSummary.tsx");
  test("tire lines and tire subtotal use cartLineTotal; staggered lines render the shared axle display", () => {
    expect(src).toMatch(/import \{ useCart, cartLineTotal(, type CartWheelItem)? \} from "@\/lib\/cart\/CartContext"/);
    expect(src).toMatch(/import \{ StaggeredTireLineDetails, isStaggeredTireLine \} from "@\/components\/cart\/StaggeredTireLineDetails"/);
    expect(src).toMatch(/const tireSubtotal = tires\.reduce\(\(sum, t\) => sum \+ cartLineTotal\(t\), 0\);/);
    expect(src).toMatch(/<StaggeredTireLineDetails tire=\{t\} compact \/>/);
    expect(src).toMatch(/data-testid="package-summary-tire-line"/);
    // no tire line multiplies blended unit x quantity any more
    expect(src).not.toMatch(/\(t\.unitPrice \?\? 0\) \* \(t\.quantity \?\? 0\)/);
  });
});
