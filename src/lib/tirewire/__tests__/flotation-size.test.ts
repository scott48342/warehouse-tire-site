/**
 * Audit 2026-09-18 H1: TireWeb returns Width=0 / AspectRatio=0 for flotation (LT) sizes,
 * so every 35x12.50R17 result rendered as "0/0R17" with simpleSize "0017".
 * The size must be recovered from Name/Description; metric sizes are untouched.
 */
import { parseFlotationFromText, tireWebTireToUnified, type TireWebTire } from "../client";

function tire(over: Partial<TireWebTire>): TireWebTire {
  return {
    id: 1, productCode: "PC", clientProductCode: "CPC", name: "", make: "RBP", makeId: 1,
    pattern: "REPULSOR R/T", patternId: 0, description: "", imageUrl: null,
    width: 0, aspectRatio: 0, rim: 0, weight: null, speedRating: null, loadRating: "121",
    plyRating: null, utqg: null, loadRange: "F", sidewall: null, treadDepth: null, warranty: null,
    features: null, benefits: null, buyPrice: 200, sellPrice: null, tax: 0, quantity: 4,
    quantitySecondary: 0, connectionId: 1, supplierSystemId: 0, reviewRating: null, reviewCount: null,
    ...over,
  } as TireWebTire;
}

describe("parseFlotationFromText", () => {
  it.each([
    ["35X12.50R17LT F REPULSOR R/T", "35X12.50R17", "35125017", 17],
    ["35X12.5017LT E NEW MUTANT X-RT", "35X12.50R17", "35125017", 17],   // missing R
    ["37x13.50R22 Toyo Open Country", "37X13.50R22", "37135022", 22],
    ["33X1250R20 Nitto", null, null, null],                              // no decimal + no R: width 1250 rejected
    ["LT285/70R17 BFG KO2", null, null, null],                            // metric LT is NOT flotation
    ["245/70R17", null, null, null],
    ["", null, null, null],
  ])("%s", (text, size, simple, rim) => {
    const r = parseFlotationFromText(text);
    if (size === null) expect(r).toBeNull();
    else expect(r).toEqual({ size, simpleSize: simple, rim });
  });
});

describe("tireWebTireToUnified flotation recovery", () => {
  it("recovers 35X12.50R17 from Name when width/aspect are 0", () => {
    const u = tireWebTireToUnified(tire({ name: "35X12.50R17LT F REPULSOR R/T", rim: 17 }), "tireweb_km");
    expect(u.size).toBe("35X12.50R17");
    expect(u.simpleSize).toBe("35125017");
    expect(u.rimDiameter).toBe(17);
    expect(u.badges.loadIndex).toBe("121");
  });
  it("falls back to Description, and to the parsed rim when Rim is 0", () => {
    const u = tireWebTireToUnified(tire({ description: "37X13.50R22 OPEN COUNTRY M/T" }), "tireweb_atd");
    expect(u.size).toBe("37X13.50R22");
    expect(u.rimDiameter).toBe(22);
  });
  it("leaves metric sizes untouched even if the name mentions a flotation size", () => {
    const u = tireWebTireToUnified(tire({ name: "35X12.50R17 lookalike", width: 245, aspectRatio: 70, rim: 17 }), "tireweb_atd");
    expect(u.size).toBe("245/70R17");
    expect(u.simpleSize).toBe("2457017");
  });
  it("still yields 0/0 when nothing is recoverable (no fabrication)", () => {
    const u = tireWebTireToUnified(tire({ name: "MYSTERY TIRE", rim: 17 }), "tireweb_atd");
    expect(u.size).toBe("0/0R17");
  });
});
