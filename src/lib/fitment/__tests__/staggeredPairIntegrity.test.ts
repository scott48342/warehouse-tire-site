/**
 * Regression: 2026-09-20 Codex live check on /wheels?year=2020&make=Ford&model=Mustang
 * &trim=GT Performance Pack&diameter=20&package=1.
 *
 * The "Best Value" VORS TR4 card was the 20x9.5 REAR item (TR04209551435BK) whose
 * pair pointed at a 19x8.5 FRONT (TR04198551435BK). The front had been removed by
 * the diameter=20 filter, so the pair carried no front specs/price. The card
 * back-filled the front with its own 20x9.5 label and 4 x rear price ($1,430)
 * and linked the PDP to the front SKU, which resolved to 19x8.5 / $1,346.80.
 */
import {
  isCompleteStaggeredPair,
  staggeredSetPrice,
  pairFrontSize,
  recordPassesSizeFilter,
  pairSatisfiesSizeFilter,
} from "../staggeredPairIntegrity";

const FRONT = { sku: "TR04198551435BK", diameter: 19, width: 8.5, offset: 35, price: 316.0 };
const REAR = { sku: "TR04209551435BK", diameter: 20, width: 9.5, offset: 35, price: 357.4 };

describe("isCompleteStaggeredPair", () => {
  it("accepts a pair with sku + diameter + width + positive price on both axles", () => {
    expect(isCompleteStaggeredPair({ staggered: true, role: "rear", front: FRONT, rear: REAR })).toBe(true);
  });

  it("REGRESSION: rejects the live TR4 shape - rear item whose front axle lost its specs/price", () => {
    const livePair = {
      staggered: true,
      role: "rear",
      front: { sku: "TR04198551435BK", diameter: undefined, width: undefined, offset: undefined, price: null },
      rear: REAR,
      setPrice: null,
    };
    expect(isCompleteStaggeredPair(livePair)).toBe(false);
    expect(staggeredSetPrice(livePair)).toBeNull();
    // No front size -> caller must not fall back to the card's own 20x9.5 label
    expect(pairFrontSize(livePair)).toBeNull();
  });

  it("rejects when either axle lacks a positive price (never 4 x one axle)", () => {
    expect(isCompleteStaggeredPair({ staggered: true, front: { ...FRONT, price: null }, rear: REAR })).toBe(false);
    expect(isCompleteStaggeredPair({ staggered: true, front: FRONT, rear: { ...REAR, price: 0 } })).toBe(false);
  });

  it("rejects when either axle lacks a sku, or the pair is not staggered / missing an axle", () => {
    expect(isCompleteStaggeredPair({ staggered: true, front: { ...FRONT, sku: "" }, rear: REAR })).toBe(false);
    expect(isCompleteStaggeredPair({ staggered: false, front: FRONT, rear: REAR })).toBe(false);
    expect(isCompleteStaggeredPair({ staggered: true, front: FRONT, rear: null })).toBe(false);
    expect(isCompleteStaggeredPair(undefined)).toBe(false);
  });

  it("accepts string dimensions from the API", () => {
    expect(isCompleteStaggeredPair({ staggered: true, front: { ...FRONT, diameter: "19", width: "8.5" }, rear: { ...REAR, diameter: "20", width: "9.5" } })).toBe(true);
  });
});

describe("staggeredSetPrice / pairFrontSize", () => {
  it("prices 2 x front + 2 x rear from each axle's own record (the PDP figure, not 4 x rear)", () => {
    const pair = { staggered: true, front: FRONT, rear: REAR };
    expect(staggeredSetPrice(pair)).toBe(1346.8);
    expect(staggeredSetPrice(pair)).not.toBe(REAR.price * 4); // 1429.6 - the false card total
  });

  it("reports the FRONT axle's real size for the card label / PDP link", () => {
    expect(pairFrontSize({ staggered: true, front: FRONT, rear: REAR })).toEqual({ diameter: "19", width: "8.5" });
  });
});

describe("size-filter coherence for staggered pairs", () => {
  it("a record outside the requested diameter fails; unknown dimension is not excluded", () => {
    expect(recordPassesSizeFilter(FRONT, { diameter: "20" })).toBe(false);
    expect(recordPassesSizeFilter(REAR, { diameter: "20" })).toBe(true);
    expect(recordPassesSizeFilter({ diameter: undefined, width: 9.5 }, { diameter: "20" })).toBe(true);
    expect(recordPassesSizeFilter(undefined, { diameter: "20" })).toBe(false);
    expect(recordPassesSizeFilter(REAR, { width: "9.5" })).toBe(true);
    expect(recordPassesSizeFilter(REAR, { width: "10" })).toBe(false);
  });

  it("REGRESSION: a 19/20 set is NOT offered under diameter=20; a 20/20 set is", () => {
    expect(pairSatisfiesSizeFilter(FRONT, REAR, { diameter: "20" })).toBe(false);
    expect(pairSatisfiesSizeFilter({ ...FRONT, diameter: 20, width: 8.5 }, REAR, { diameter: "20" })).toBe(true);
  });

  it("no filter -> any resolvable pair passes; missing partner never passes", () => {
    expect(pairSatisfiesSizeFilter(FRONT, REAR, {})).toBe(true);
    expect(pairSatisfiesSizeFilter(undefined, REAR, {})).toBe(false);
  });
});
