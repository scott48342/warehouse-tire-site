/**
 * Actual-handler tests for GET /api/wheels/check-fitment (2026-09-18, audit F13).
 *
 * Runs the real route handler with the techfeed + profile modules mocked and
 * global fetch stubbed (the handler fetches /api/vehicles/search internally).
 * No network, no DB.
 *
 * Contract under test:
 *   - bolt pattern equality is EXACT (5x120 !== 5x120.65)
 *   - a requested SKU is judged on its own record; a sibling SKU never certifies it
 *   - missing geometry (OEM basis or wheel width/offset) is UNVERIFIED (fits:null)
 *   - null / undefined / "" width or offset are ABSENT, not 0; real 0 / "0" are kept
 *   - style-only requests scan every bolt-compatible variant before rejecting
 *   - upstream failures fail CLOSED (fits:null, never true)
 */

jest.mock("@/lib/techfeed/wheels", () => ({
  getTechfeedWheelBySku: jest.fn(),
  getTechfeedWheelsByStyle: jest.fn(),
  searchWheelsByStyleFuzzy: jest.fn(),
}));
jest.mock("@/lib/fitment-db/profileService", () => ({
  getFitmentProfileWithHdSupport: jest.fn(),
  parseWheelSizes: jest.fn((x: unknown) => (Array.isArray(x) ? x : [])),
}));

import { GET, parseBoltPatternKeys, strictNumber } from "../route";
import {
  getTechfeedWheelBySku,
  getTechfeedWheelsByStyle,
  searchWheelsByStyleFuzzy,
} from "@/lib/techfeed/wheels";
import { getFitmentProfileWithHdSupport, parseWheelSizes } from "@/lib/fitment-db/profileService";

const mockBySku = getTechfeedWheelBySku as jest.Mock;
const mockByStyle = getTechfeedWheelsByStyle as jest.Mock;
const mockFuzzy = searchWheelsByStyleFuzzy as jest.Mock;
const mockProfile = getFitmentProfileWithHdSupport as jest.Mock;

type Body = Record<string, unknown> & { fits: boolean | null; reason?: string };

const realFetch = global.fetch;

/** Stub the internal /api/vehicles/search call. */
function stubVehicleSearch(payload: unknown, ok = true) {
  global.fetch = jest.fn(async () => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  })) as unknown as typeof fetch;
}
function stubVehicleSearchThrows() {
  global.fetch = jest.fn(async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
}

/** Fully-resolved vehicle: certified trims agree, one bolt pattern. */
function resolvedVehicle(boltPattern = "5x120.65") {
  return { fitment: { boltPattern }, trimRequired: false, certifiable: true };
}
/** Trim-ambiguous vehicle whose trims still share a bolt pattern. */
function trimAmbiguousVehicle(sharedBp = "5x120.65") {
  return {
    trimRequired: true,
    certifiable: false,
    conflictingFields: ["oemWheelSizes"],
    unknownFields: [],
    candidateTrims: [{ id: "a" }, { id: "b" }],
    sharedSpecs: { boltPattern: sharedBp },
  };
}

/** Complete OEM geometry basis: default 8" wide, +30mm (matches the default fixture wheel). */
function profileWithGeometry(offsetMm = 30, widthIn = 8) {
  mockProfile.mockResolvedValue({
    profile: {
      boltPattern: "5x120.65",
      offsetMinMm: offsetMm,
      offsetMaxMm: offsetMm,
      oemWheelSizes: [{ diameter: 19, width: widthIn, offset: offsetMm, axle: "both" }],
    },
  });
}
function profileWithoutGeometry() {
  mockProfile.mockResolvedValue({
    profile: { boltPattern: "5x120.65", offsetMinMm: null, offsetMaxMm: null, oemWheelSizes: [] },
  });
}

async function call(qs: string): Promise<Body> {
  const res = await GET(new Request(`http://localhost:3002/api/wheels/check-fitment?${qs}`));
  return (await res.json()) as Body;
}

const wheel = (over: Record<string, unknown> = {}) => ({
  sku: "W-5X12065",
  style: "REBEL",
  brand_desc: "Fuel",
  bolt_pattern_metric: "5x120.65",
  width: "8",
  offset: "30",
  ...over,
});

beforeEach(() => {
  jest.resetAllMocks();
  // resetAllMocks wipes factory implementations too - restore the pass-through
  (parseWheelSizes as jest.Mock).mockImplementation((x: unknown) => (Array.isArray(x) ? x : []));
  mockByStyle.mockResolvedValue([]);
  mockFuzzy.mockResolvedValue([]);
  profileWithGeometry();
});
afterAll(() => {
  global.fetch = realFetch;
});

describe("parseBoltPatternKeys", () => {
  it("normalises numerics and splits dual patterns", () => {
    expect(parseBoltPatternKeys("5x120")).toEqual(["5X120"]);
    expect(parseBoltPatternKeys("5x120.0")).toEqual(["5X120"]);
    expect(parseBoltPatternKeys("5 X 120.65")).toEqual(["5X120.65"]);
    expect(parseBoltPatternKeys("6X135/6x139.7")).toEqual(["6X135", "6X139.7"]);
    expect(parseBoltPatternKeys("5-114.3")).toEqual(["5X114.3"]);
  });
  it("yields [] for garbage so callers fail closed", () => {
    expect(parseBoltPatternKeys("")).toEqual([]);
    expect(parseBoltPatternKeys("5 lug")).toEqual([]);
    expect(parseBoltPatternKeys(null)).toEqual([]);
  });
});

describe("strictNumber", () => {
  it("treats null/undefined/blank as absent", () => {
    expect(strictNumber(null)).toBeNull();
    expect(strictNumber(undefined)).toBeNull();
    expect(strictNumber("")).toBeNull();
    expect(strictNumber("  ")).toBeNull();
    expect(strictNumber("abc")).toBeNull();
    expect(strictNumber(NaN)).toBeNull();
  });
  it("preserves real zero and numeric strings", () => {
    expect(strictNumber(0)).toBe(0);
    expect(strictNumber("0")).toBe(0);
    expect(strictNumber("-12")).toBe(-12);
    expect(strictNumber(8.5)).toBe(8.5);
  });
});

describe("GET /api/wheels/check-fitment - bolt pattern exactness", () => {
  it("5x120 wheel on a 5x120.65 vehicle is NOT a fit (substring regression)", async () => {
    stubVehicleSearch(resolvedVehicle("5x120.65"));
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "5x120" }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("sku_bolt_pattern_mismatch");
    expect(b.boltPatternCompatible).toBe(false);
  });
  it("5x120.65 wheel on a 5x120 vehicle is NOT a fit (reverse direction)", async () => {
    stubVehicleSearch(resolvedVehicle("5x120"));
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "5x120.65" }));
    const b = await call("sku=W-5X12065&year=2024&make=BMW&model=M4");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("sku_bolt_pattern_mismatch");
  });
  it("dual-pattern wheel matches when one side equals the vehicle pattern", async () => {
    stubVehicleSearch(resolvedVehicle("6x139.7"));
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "6X135/6X139.7" }));
    const b = await call("sku=W-5X12065&year=2024&make=Chevrolet&model=Silverado 1500");
    expect(b.fits).toBe(true);
    expect(b.reason).toBe("exact_sku_match");
  });
});

describe("GET /api/wheels/check-fitment - requested SKU is judged on its own record", () => {
  it("incompatible requested SKU is fits:false even when a sibling SKU fits; sibling only suggested", async () => {
    stubVehicleSearch(resolvedVehicle("5x120.65"));
    mockBySku.mockResolvedValue(wheel({ sku: "W-BAD", bolt_pattern_metric: "5x112" }));
    mockByStyle.mockResolvedValue([
      wheel({ sku: "W-BAD", bolt_pattern_metric: "5x112" }),
      wheel({ sku: "W-GOOD", bolt_pattern_metric: "5x120.65" }),
    ]);
    const b = await call("sku=W-BAD&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("sku_bolt_pattern_mismatch");
    expect(b.alternativeSku).toBe("W-GOOD");
    expect(b.matchingSku).toBeUndefined();
  });
  it("requested SKU with unknown bolt pattern is unverified, not certified via style", async () => {
    stubVehicleSearch(resolvedVehicle("5x120.65"));
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "", bolt_pattern_standard: "" }));
    mockByStyle.mockResolvedValue([wheel({ sku: "W-GOOD" })]);
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("sku_bolt_pattern_unknown");
  });
  it("unknown SKU is fits:false wheel_not_found", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockBySku.mockResolvedValue(null);
    const b = await call("sku=NOPE&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("wheel_not_found");
  });
});

describe("GET /api/wheels/check-fitment - geometry is required for certification", () => {
  it("positive control: matching bolt + complete geometry => fits:true", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockBySku.mockResolvedValue(wheel({ width: "8", offset: "30" }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(true);
    expect(b.reason).toBe("exact_sku_match");
    expect(b.boltPatternCompatible).toBe(true);
    expect(b.geometryProfile).toBe("daily_driver");
    expect(b.geometryVehicleClass).toBe("car");
  });
  it("same wheel, 1mm beyond the daily_driver car inboard limit => geometry_rejected (profile actually applied)", async () => {
    stubVehicleSearch(resolvedVehicle());
    // OEM 8" +30. Candidate 8" +43 -> delta_backspacing = +13mm > 12mm car/daily_driver limit
    mockBySku.mockResolvedValue(wheel({ width: "8", offset: "43" }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("geometry_rejected");
  });
  it("6x bolt pattern is classed as truck (wider limits): +20mm inboard passes for truck", async () => {
    stubVehicleSearch(resolvedVehicle("6x139.7"));
    mockProfile.mockResolvedValue({
      profile: { boltPattern: "6x139.7", offsetMinMm: 30, offsetMaxMm: 30, oemWheelSizes: [{ diameter: 18, width: 8, offset: 30, axle: "both" }] },
    });
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "6x139.7", width: "8", offset: "46" })); // +16mm inboard: car fails (12), truck passes (18)
    const b = await call("sku=W-5X12065&year=2024&make=Chevrolet&model=Silverado 1500");
    expect(b.fits).toBe(true);
    expect(b.geometryVehicleClass).toBe("truck");
  });
  it("explicit numeric offset 0 with complete geometry is a real value => fits:true", async () => {
    stubVehicleSearch(resolvedVehicle());
    profileWithGeometry(0, 8);
    mockBySku.mockResolvedValue(wheel({ width: 8, offset: 0 }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(true);
  });
  it("string offset \"0\" is a real value => fits:true", async () => {
    stubVehicleSearch(resolvedVehicle());
    profileWithGeometry(0, 8);
    mockBySku.mockResolvedValue(wheel({ width: "8", offset: "0" }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(true);
  });
  it.each([
    ["offset null", { width: "8", offset: null }],
    ["offset undefined", { width: "8", offset: undefined }],
    ["offset blank", { width: "8", offset: "" }],
    ["width null", { width: null, offset: "30" }],
    ["width blank", { width: "", offset: "30" }],
    ["width non-numeric", { width: "8J", offset: "30" }],
  ])("%s with known OEM geometry => fits:null geometry_unverified (never true)", async (_n, over) => {
    stubVehicleSearch(resolvedVehicle());
    mockBySku.mockResolvedValue(wheel(over as Record<string, unknown>));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("geometry_unverified");
    expect(b.boltPatternCompatible).toBe(true);
  });
  it("matching bolt but OEM geometry basis unavailable => fits:null geometry_unverified", async () => {
    stubVehicleSearch(resolvedVehicle());
    profileWithoutGeometry();
    mockBySku.mockResolvedValue(wheel());
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("geometry_unverified");
    expect(b.boltPatternCompatible).toBe(true);
  });
  it("profile lookup throwing => geometry unverified, not a fit", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockProfile.mockRejectedValue(new Error("db down"));
    mockBySku.mockResolvedValue(wheel());
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("geometry_unverified");
  });
  it("matching bolt but unsafe geometry => fits:false geometry_rejected", async () => {
    stubVehicleSearch(resolvedVehicle());
    // 14" wide at -76mm vs OEM 8" +30mm: far beyond the outboard safety ceiling
    mockBySku.mockResolvedValue(wheel({ width: "14", offset: "-76" }));
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("geometry_rejected");
    expect(b.boltPatternCompatible).toBe(true);
  });
});

describe("GET /api/wheels/check-fitment - trim ambiguity never certifies", () => {
  it("shared bolt matches, trim unresolved => fits:null trim_required_for_geometry", async () => {
    stubVehicleSearch(trimAmbiguousVehicle("5x120.65"));
    mockBySku.mockResolvedValue(wheel());
    const b = await call("sku=W-5X12065&year=2024&make=BMW&model=M4");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("trim_required_for_geometry");
    expect(b.boltPatternCompatible).toBe(true);
    expect(b.trimRequired).toBe(true);
  });
  it("shared bolt mismatches, trim unresolved => safe fits:false", async () => {
    stubVehicleSearch(trimAmbiguousVehicle("5x120.65"));
    mockBySku.mockResolvedValue(wheel({ bolt_pattern_metric: "5x120" }));
    const b = await call("sku=W-5X12065&year=2024&make=BMW&model=M4");
    expect(b.fits).toBe(false);
    expect(b.boltPatternCompatible).toBe(false);
    expect(b.trimRequired).toBe(true);
  });
  it("no bolt pattern shared across trims => fits:null trim_required", async () => {
    stubVehicleSearch({ ...trimAmbiguousVehicle(), sharedSpecs: {} });
    mockBySku.mockResolvedValue(wheel());
    const b = await call("sku=W-5X12065&year=2024&make=BMW&model=M4");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("trim_required");
  });
});

describe("GET /api/wheels/check-fitment - style-only requests scan all compatible variants", () => {
  it("first compatible variant fails geometry, later one passes => fits:true with the passing SKU", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockByStyle.mockResolvedValue([
      wheel({ sku: "V-OTHER", bolt_pattern_metric: "5x112" }),
      wheel({ sku: "V-WIDE", width: "14", offset: "-76" }),
      wheel({ sku: "V-OK", width: "8", offset: "30" }),
    ]);
    const b = await call("brand=Fuel&style=REBEL&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(true);
    expect(b.reason).toBe("style_variant_match");
    expect(b.matchingSku).toBe("V-OK");
    expect(b.checkedVariants).toBe(3);
    expect(b.compatibleVariants).toBe(2);
  });
  it("compatible variants all unverified/rejected => unverified wins over rejected, never true", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockByStyle.mockResolvedValue([
      wheel({ sku: "V-WIDE", width: "14", offset: "-76" }),
      wheel({ sku: "V-NOGEO", width: "8", offset: null }),
    ]);
    const b = await call("brand=Fuel&style=REBEL&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("geometry_unverified");
    expect(b.matchingSku).toBe("V-NOGEO");
  });
  it("no variant shares the bolt pattern => fits:false no_matching_bolt_pattern", async () => {
    stubVehicleSearch(resolvedVehicle("5x120.65"));
    mockByStyle.mockResolvedValue([wheel({ sku: "V1", bolt_pattern_metric: "5x120" })]);
    const b = await call("brand=Fuel&style=REBEL&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("no_matching_bolt_pattern");
  });
  it("style unknown to catalog => fits:null style_not_found (never permissive)", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockByStyle.mockResolvedValue([]);
    mockFuzzy.mockResolvedValue([]);
    const b = await call("brand=Fuel&style=NOPE&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("style_not_found");
  });
});

describe("GET /api/wheels/check-fitment - upstream failures fail closed", () => {
  it("vehicle lookup non-OK => fits:null fitment_lookup_failed", async () => {
    stubVehicleSearch({}, false);
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("fitment_lookup_failed");
  });
  it("vehicle lookup throws (ECONNREFUSED) => fits:null check_failed", async () => {
    stubVehicleSearchThrows();
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBeNull();
    expect(b.reason).toBe("check_failed");
  });
  it("vehicle has no bolt pattern => fits:false no_vehicle_bolt_pattern", async () => {
    stubVehicleSearch({ fitment: {}, trimRequired: false, certifiable: true });
    const b = await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    expect(b.fits).toBe(false);
    expect(b.reason).toBe("no_vehicle_bolt_pattern");
  });
  it("internal vehicle lookup uses the request origin, not a hard-coded port", async () => {
    stubVehicleSearch(resolvedVehicle());
    mockBySku.mockResolvedValue(wheel());
    await call("sku=W-5X12065&year=2024&make=Ford&model=Mustang");
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url.startsWith("http://localhost:3002/api/vehicles/search?")).toBe(true);
  });
  it("missing params => 400 fits:false", async () => {
    const res = await GET(new Request("http://localhost:3002/api/wheels/check-fitment?year=2024"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as Body).fits).toBe(false);
  });
});
