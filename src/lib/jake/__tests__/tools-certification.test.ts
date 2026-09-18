/**
 * Jake tool contract tests (audit 2026-09-18, regressions J1-J4).
 *
 * J1 2024 Silverado 2500 HD told "6x139.7 confirmed" (HD is 8-lug) - platform
 *    table hard-coded a bolt pattern and matched any "silverado".
 * J2 Raptor: four sizes called "VERIFIED exact Raptor data", invented load range.
 * J3 Mach-E inherited S550 Mustang culture chips.
 * J4 2024 M4 Competition xDrive: "both data sources agree", "5x120 confirmed"
 *    while the API had certificationBlock=trim_required (trim was dropped).
 *
 * The tools are exercised through executeTool with fetch mocked, mirroring the
 * external review harness (review-jake-tools.cjs) so both stay green together.
 */
import { certificationFromApi, detectEnthusiastPlatform, executeTool } from "../tools";

const ymm = { year: 2024, make: "BMW", model: "M4" };

function mockFetch(data: unknown, ok = true) {
  const urls: string[] = [];
  const fetchMock = jest.fn(async (url: string | URL) => {
    urls.push(String(url));
    return { ok, status: ok ? 200 : 503, json: async () => data } as unknown as Response;
  });
  (global as any).fetch = fetchMock;
  return { urls };
}

const origFetch = (global as any).fetch;
afterEach(() => {
  (global as any).fetch = origFetch;
});

describe("detectEnthusiastPlatform - exclusive matching", () => {
  it("J3: Mustang Mach-E is not an S550", () => {
    expect(detectEnthusiastPlatform(2022, "Ford", "Mustang Mach-E")).toBeNull();
    expect(detectEnthusiastPlatform(2022, "Ford", "Mustang")).toBe("s550_mustang");
  });
  it("J1: Silverado/Sierra HD are not the half-ton platform", () => {
    expect(detectEnthusiastPlatform(2024, "Chevrolet", "Silverado 2500 HD")).toBeNull();
    expect(detectEnthusiastPlatform(2024, "Chevrolet", "Silverado 2500HD")).toBeNull();
    expect(detectEnthusiastPlatform(2024, "GMC", "Sierra 3500HD")).toBeNull();
    expect(detectEnthusiastPlatform(2024, "Chevrolet", "Silverado 1500")).toBe("gm_truck_modern");
    expect(detectEnthusiastPlatform(2024, "Chevrolet", "Silverado")).toBe("gm_truck_modern");
  });
  it("J2: Raptor and Lightning are not street-truck F-150s", () => {
    expect(detectEnthusiastPlatform(2020, "Ford", "F-150 Raptor")).toBeNull();
    expect(detectEnthusiastPlatform(2023, "Ford", "F-150 Lightning")).toBeNull();
    expect(detectEnthusiastPlatform(2020, "Ford", "F-150")).toBe("ford_f150_modern");
  });
  it("2024+ Charger is not LX", () => {
    expect(detectEnthusiastPlatform(2024, "Dodge", "Charger")).toBeNull();
    expect(detectEnthusiastPlatform(2023, "Dodge", "Charger")).toBe("mopar_lx");
  });
});

describe("get_platform_context carries no specs", () => {
  it("returns culture only, no boltPattern", async () => {
    const r = (await executeTool("get_platform_context", { year: 2024, make: "Chevrolet", model: "Silverado 1500" })) as any;
    expect(r.isEnthusiastPlatform).toBe(true);
    expect(r).not.toHaveProperty("boltPattern");
    expect(r.dataNote).toMatch(/lookup_wheel_fitment/);
  });
  it("J1: HD truck is a standard vehicle", async () => {
    const r = (await executeTool("get_platform_context", { year: 2024, make: "Chevrolet", model: "Silverado 2500 HD" })) as any;
    expect(r.isEnthusiastPlatform).toBe(false);
    expect(r.platformId).toBeUndefined();
  });
});

describe("certificationFromApi", () => {
  it("absent flags never certify", () => {
    const c = certificationFromApi({ tireSizes: ["285/30R20"], fitment: { boltPattern: "5x120" } });
    expect(c.certifiable).toBe(false);
    expect(c.trimRequired).toBe(false);
    expect(c.dataNote).toMatch(/not as verified/);
  });
  it("fitment-search shape: trim_required block wins over confidence=high", () => {
    const c = certificationFromApi({
      fitment: {
        confidence: "high",
        certificationBlock: "trim_required",
        trimRequired: true,
        certifiable: false,
        vehicle: { trim: "CS" },
        trimAmbiguity: { resolution: "trim_required", candidateTrims: [{ displayTrim: "CS" }, { displayTrim: "Competition" }, { displayTrim: "Competition xDrive" }] },
      },
    });
    expect(c.certifiable).toBe(false);
    expect(c.certificationBlock).toBe("trim_required");
    expect(c.matchedTrim).toBe("CS");
    expect(c.candidateTrims).toEqual(["CS", "Competition", "Competition xDrive"]);
    expect(c.dataNote).toMatch(/Do not call any spec "confirmed"/);
  });
  it("exact trim match with no block certifies", () => {
    const c = certificationFromApi({ certifiable: true, trimRequired: false, debug: { exactTrimMatch: true, matchedTrim: "Competition xDrive" } });
    expect(c.certifiable).toBe(true);
    expect(c.matchedTrim).toBe("Competition xDrive");
  });
});

describe("lookup_wheel_fitment", () => {
  it("J4: preserves non-certifiable state and never invents a bolt pattern on failure", async () => {
    mockFetch({ trimRequired: true, certifiable: false, fitment: { boltPattern: "5x120" } });
    const r = (await executeTool("lookup_wheel_fitment", ymm)) as any;
    expect(r.boltPattern).toBe("5x120");
    expect(r.boltPatternSource).toBe("fitment_db");
    expect(r.certifiable).toBe(false);
    expect(r.trimRequired).toBe(true);

    mockFetch({}, false);
    const f = (await executeTool("lookup_wheel_fitment", { year: 2024, make: "Chevrolet", model: "Silverado 1500" })) as any;
    expect(f.boltPattern).toBeNull();
    expect(f.certifiable).toBe(false);
    expect(f.error).toMatch(/503/);
  });
  it("forwards trim", async () => {
    const { urls } = mockFetch({ fitment: {} });
    await executeTool("lookup_wheel_fitment", { ...ymm, trim: "Competition xDrive" });
    expect(new URL(urls[0]).searchParams.get("trim")).toBe("Competition xDrive");
  });
});

describe("lookup_tire_sizes", () => {
  it("preserves trim-required uncertainty", async () => {
    mockFetch({ trimRequired: true, certifiable: false, tireSizes: ["285/30R20"], source: "db" });
    const r = (await executeTool("lookup_tire_sizes", ymm)) as any;
    expect(r.trimRequired).toBe(true);
    expect(r.certifiable).toBe(false);
    expect(r.tireSizes).toEqual(["285/30R20"]);
  });
});

describe("search_wheels", () => {
  it("J4: forwards the selected trim", async () => {
    const { urls } = mockFetch({ results: [] });
    await executeTool("search_wheels", { ...ymm, trim: "Competition xDrive" });
    expect(new URL(urls[0]).searchParams.get("trim")).toBe("Competition xDrive");
  });
  it("retains the certification block and resolved fitment", async () => {
    mockFetch({
      results: [],
      fitment: { certificationBlock: "trim_required", trimRequired: true, certifiable: false, vehicle: { trim: "CS" }, envelope: { boltPattern: "5x120", centerBore: 72.6 } },
    });
    const r = (await executeTool("search_wheels", ymm)) as any;
    expect(r.certificationBlock).toBe("trim_required");
    expect(r.certifiable).toBe(false);
    expect(r.fitment.boltPattern).toBe("5x120");
    expect(r.fitment.resolvedTrim).toBe("CS");
  });
});

describe("search_tires", () => {
  it("J2: retains fit / load gates per tire and the verified-ness of the requirement", async () => {
    const { urls } = mockFetch({
      requiredLoadIndex: null,
      requiredLoadIndexSource: "unverified",
      trimRequired: false,
      results: [{ sku: "TEST", brand: "Example", model: "Test", size: "285/30R20", price: 200, packageEligible: false, fitBadgeAllowed: false, loadIndexOk: false, requiredLoadIndex: 100, loadIndex: 95, fitBlockReason: "load_index_below_required" }],
    });
    const r = (await executeTool("search_tires", { ...ymm, trim: "Competition xDrive", size: "285/30R20" })) as any;
    expect(new URL(urls[0]).searchParams.get("trim")).toBe("Competition xDrive");
    const t = r.tires[0];
    expect(t.packageEligible).toBe(false);
    expect(t.fitBadgeAllowed).toBe(false);
    expect(t.loadIndexOk).toBe(false);
    expect(t.fitBlockReason).toBe("load_index_below_required");
    expect(r.requiredLoadIndexVerified).toBe(false);
  });
  it("a tire with no flags is not a confirmed fit", async () => {
    mockFetch({ results: [{ sku: "X", brand: "B", model: "M", size: "245/70R17", price: 150 }] });
    const r = (await executeTool("search_tires", { size: "245/70R17" })) as any;
    expect(r.tires[0].fitBadgeAllowed).toBe(false);
    expect(r.tires[0].loadIndexOk).toBeNull();
    expect(r.certifiable).toBe(false);
  });
});
