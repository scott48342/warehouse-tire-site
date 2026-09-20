/**
 * Contract test (2026-09-20, Codex live check hotfix): staggered pairs must stay
 * coherent with the shopper's size filter and with the catalog.
 *
 * Live failure: diameter=20 on a 2020 Mustang GT PP left the 20x9.5 REAR of a
 * VORS TR4 pair in the results while its 19x8.5 FRONT was filtered out; the
 * pair spec map was built from the FILTERED pool, so the front had no
 * specs/price and the card back-filled them from the rear (wrong size, 4 x rear
 * price, PDP link to a 19" SKU). Same source-level pattern as
 * certification-gate-contract.test.ts (the route needs a live DB).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

describe("fitment-search staggered pair / size-filter wiring", () => {
  let src: string;
  beforeAll(() => {
    src = readFileSync(resolve(__dirname, "../route.ts"), "utf-8");
  });

  test("imports the shared pair-integrity helper", () => {
    expect(src).toMatch(/import \{ pairSatisfiesSizeFilter \} from "@\/lib\/fitment\/staggeredPairIntegrity";/);
  });

  test("under a diameter/width filter, a pair whose partner fails the filter is dropped from the item", () => {
    const block = src.slice(src.indexOf("const preSizeFilterCandidates = rankedCandidates;"), src.indexOf("const totalCount = rankedCandidates.length;"));
    expect(block).toMatch(/if \(diameter \|\| width\) \{/);
    expect(block).toMatch(/pairSatisfiesSizeFilter\(candidateBySku\.get\(sp\.frontSku\),\s*candidateBySku\.get\(sp\.rearSku\),\s*\{ diameter, width \}\)/);
    expect(block).toMatch(/delete \(c as any\)\.staggeredPair;/);
    // staggeredOnly mode re-applies its filter after pairs were dropped
    expect(block).toMatch(/if \(staggeredOnlyRequested && opts\.staggeredInfo\?\.isStaggered\) \{\s*\n\s*rankedCandidates = rankedCandidates\.filter\(\(c\) => \(c as any\)\.staggeredPair\?\.staggered === true\);/);
  });

  test("pair spec/price map is built from the PRE-size-filter pool, not the filtered results", () => {
    const start = src.indexOf("const wheelSpecsBySku = new Map<");
    const block = src.slice(start, src.indexOf("// FIT CERTIFICATION GATE", start));
    expect(block).toMatch(/for \(const item of preSizeFilterCandidates\) \{\s*\n\s*const c = item\.candidate;\s*\n\s*wheelSpecsBySku\.set\(c\.sku,/);
    expect(block).not.toMatch(/for \(const item of rankedCandidates\) \{\s*\n\s*const c = item\.candidate;\s*\n\s*wheelSpecsBySku\.set/);
  });

  test("a pair with an undescribed axle emits NO pair (never half a set for the card to back-fill)", () => {
    const start = src.indexOf("pair: staggeredPair ? (() => {");
    const block = src.slice(start, src.indexOf("setPrice:", start));
    expect(block).toMatch(/if \(!frontSpecs \|\| !rearSpecs \|\| !frontSpecs\.diameter \|\| !rearSpecs\.diameter \|\| !frontSpecs\.width \|\| !rearSpecs\.width\) \{\s*\n\s*return undefined;/);
  });
});
