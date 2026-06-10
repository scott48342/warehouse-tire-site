/**
 * P0 make normalization fix — unit tests (2026-06-10)
 *
 * Verifies slug candidate generation for the makeSlugMatch helper.
 * The SQL side mirrors slugifyMake: LOWER(REGEXP_REPLACE(make,'[^a-zA-Z0-9]+','-','g'))
 * so if slugifyMake(dbValue) is in getMakeSlugCandidates(input), the row matches.
 */

import { slugifyMake, getMakeSlugCandidates } from "../makeMatch";

/** Simulates the SQL-side comparison: does `input` match a DB make value? */
function wouldMatch(input: string, dbValue: string): boolean {
  return getMakeSlugCandidates(input).includes(slugifyMake(dbValue));
}

describe("slugifyMake", () => {
  it("slugifies spaces, hyphens, case, and punctuation identically", () => {
    expect(slugifyMake("Land Rover")).toBe("land-rover");
    expect(slugifyMake("land-rover")).toBe("land-rover");
    expect(slugifyMake("LAND  ROVER")).toBe("land-rover");
    expect(slugifyMake("Mercedes-Benz")).toBe("mercedes-benz");
    expect(slugifyMake("mercedes benz")).toBe("mercedes-benz");
    expect(slugifyMake("Alfa Romeo")).toBe("alfa-romeo");
    expect(slugifyMake("RAM")).toBe("ram");
    expect(slugifyMake("  Ford  ")).toBe("ford");
    expect(slugifyMake("")).toBe("");
  });
});

describe("getMakeSlugCandidates", () => {
  it("multi-word makes include the spaced-storage slug", () => {
    expect(getMakeSlugCandidates("Land Rover")).toContain("land-rover");
    expect(getMakeSlugCandidates("Alfa Romeo")).toContain("alfa-romeo");
    expect(getMakeSlugCandidates("Aston Martin")).toContain("aston-martin");
    expect(getMakeSlugCandidates("Rolls-Royce")).toContain("rolls-royce");
  });

  it("Mercedes input matches BOTH DB storages (Mercedes and Mercedes-Benz)", () => {
    const fromBenz = getMakeSlugCandidates("Mercedes-Benz");
    expect(fromBenz).toContain("mercedes-benz");
    expect(fromBenz).toContain("mercedes");

    const fromShort = getMakeSlugCandidates("Mercedes");
    expect(fromShort).toContain("mercedes");
    expect(fromShort).toContain("mercedes-benz");
  });

  it("nicknames resolve via canonical without leaking nickname slugs", () => {
    const chevy = getMakeSlugCandidates("Chevy");
    expect(chevy).toContain("chevrolet");

    const vw = getMakeSlugCandidates("VW");
    expect(vw).toContain("volkswagen");
  });

  it("single-word makes preserve existing behavior", () => {
    expect(getMakeSlugCandidates("Toyota")).toEqual(["toyota"]);
    expect(getMakeSlugCandidates("Ford")).toEqual(["ford"]);
    expect(getMakeSlugCandidates("Jeep")).toEqual(["jeep"]);
  });

  it("returns empty for empty input (matches nothing, not everything)", () => {
    expect(getMakeSlugCandidates("")).toEqual([]);
  });
});

describe("simulated DB matching (input vs stored make)", () => {
  // P0 brands — formerly 0% reachable
  it.each([
    ["Land Rover", "Land Rover"],
    ["land-rover", "Land Rover"],
    ["Land Rover", "land rover"], // 2024 lowercase strays
    ["Alfa Romeo", "Alfa Romeo"],
    ["alfa-romeo", "Alfa Romeo"],
    ["Aston Martin", "Aston Martin"],
    ["Mercedes-Benz", "Mercedes"],      // canonical → short storage
    ["Mercedes-Benz", "Mercedes-Benz"], // canonical → long storage
    ["Mercedes", "Mercedes-Benz"],
    ["MB", "Mercedes"],
  ])("input %s matches DB %s", (input, dbValue) => {
    expect(wouldMatch(input, dbValue)).toBe(true);
  });

  // Regression — single-word brands keep working
  it.each([
    ["Toyota", "Toyota"],
    ["toyota", "TOYOTA"],
    ["Ford", "Ford"],
    ["Chevrolet", "Chevrolet"],
    ["Chevy", "Chevrolet"],
    ["Jeep", "Jeep"],
    ["RAM", "Ram"],
    ["Ram", "RAM"],
    ["MINI", "Mini"],
  ])("input %s matches DB %s", (input, dbValue) => {
    expect(wouldMatch(input, dbValue)).toBe(true);
  });

  // Safety — no cross-brand false positives
  it.each([
    ["Ford", "Chevrolet"],
    ["Land Rover", "Rover"],          // column-side nickname NOT matched
    ["Mercedes-Benz", "Mercedes-Benz Vans"], // malformed 2018 make stays separate
    ["Mini", "Mitsubishi"],
  ])("input %s does NOT match DB %s", (input, dbValue) => {
    expect(wouldMatch(input, dbValue)).toBe(false);
  });
});
