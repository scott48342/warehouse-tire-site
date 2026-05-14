/**
 * Make Normalization Regression Tests
 * 
 * Tests for make variant matching (Mercedes-Benz/Mercedes, etc.)
 * Ensures spacing variants in trim names resolve correctly.
 */

import { describe, it, expect } from "vitest";
import { 
  canonicalMake, 
  displayMake, 
  getMakeAliases,
  getMakeVariantsForQuery,
  makeMatches 
} from "../makeAliases";

describe("Make Normalization", () => {
  describe("canonicalMake", () => {
    it("normalizes Mercedes-Benz variants", () => {
      expect(canonicalMake("Mercedes-Benz")).toBe("mercedes");
      expect(canonicalMake("mercedes-benz")).toBe("mercedes");
      expect(canonicalMake("Mercedes")).toBe("mercedes");
      expect(canonicalMake("mercedes")).toBe("mercedes");
      expect(canonicalMake("MB")).toBe("mercedes");
    });

    it("normalizes Chevrolet variants", () => {
      expect(canonicalMake("Chevrolet")).toBe("chevrolet");
      expect(canonicalMake("Chevy")).toBe("chevrolet");
      expect(canonicalMake("chevy")).toBe("chevrolet");
    });

    it("normalizes BMW (no change)", () => {
      expect(canonicalMake("BMW")).toBe("bmw");
      expect(canonicalMake("bmw")).toBe("bmw");
    });
  });

  describe("displayMake", () => {
    it("converts canonical to display name", () => {
      expect(displayMake("mercedes")).toBe("Mercedes-Benz");
      expect(displayMake("Mercedes-Benz")).toBe("Mercedes-Benz");
      expect(displayMake("bmw")).toBe("BMW");
    });
  });

  describe("getMakeVariantsForQuery", () => {
    it("returns all variants for Mercedes", () => {
      const variants = getMakeVariantsForQuery("Mercedes-Benz");
      expect(variants).toContain("mercedes");
      expect(variants).toContain("Mercedes-Benz");
      expect(variants).toContain("mercedes-benz");
      // Should have at least these variants
      expect(variants.length).toBeGreaterThanOrEqual(3);
    });

    it("returns all variants for BMW", () => {
      const variants = getMakeVariantsForQuery("BMW");
      expect(variants).toContain("bmw");
      expect(variants).toContain("BMW");
    });
  });

  describe("makeMatches", () => {
    it("matches Mercedes variants", () => {
      expect(makeMatches("Mercedes-Benz", "Mercedes")).toBe(true);
      expect(makeMatches("Mercedes-Benz", "mercedes")).toBe(true);
      expect(makeMatches("MB", "Mercedes-Benz")).toBe(true);
    });

    it("does not match different makes", () => {
      expect(makeMatches("Mercedes-Benz", "BMW")).toBe(false);
      expect(makeMatches("Ford", "Chevrolet")).toBe(false);
    });
  });
});

describe("Trim Spacing Variants (Regression)", () => {
  // These test the normalization logic for trim names with spacing differences
  
  describe("Mercedes E-Class trims", () => {
    // The key issue: "E350" vs "E 350" should normalize to same
    const normalizeTrim = (trim: string) => {
      return trim.toLowerCase().replace(/[^a-z0-9]+/g, "");
    };

    it("normalizes E350 variants", () => {
      expect(normalizeTrim("E350")).toBe("e350");
      expect(normalizeTrim("E 350")).toBe("e350");
      expect(normalizeTrim("E-350")).toBe("e350");
    });

    it("normalizes E350 4MATIC variants", () => {
      expect(normalizeTrim("E350 4MATIC")).toBe("e3504matic");
      expect(normalizeTrim("E 350 4MATIC")).toBe("e3504matic");
      expect(normalizeTrim("E-350 4MATIC")).toBe("e3504matic");
    });

    it("normalizes AMG E53 variants", () => {
      expect(normalizeTrim("AMG E53")).toBe("amge53");
      expect(normalizeTrim("AMG E 53")).toBe("amge53");
      expect(normalizeTrim("E53 AMG")).toBe("e53amg"); // Different order = different normalized
    });

    it("normalizes C43/C 43 variants", () => {
      expect(normalizeTrim("C43")).toBe("c43");
      expect(normalizeTrim("C 43")).toBe("c43");
      expect(normalizeTrim("AMG C43")).toBe("amgc43");
      expect(normalizeTrim("AMG C 43")).toBe("amgc43");
    });
  });

  describe("BMW M-series trims", () => {
    const normalizeTrim = (trim: string) => {
      return trim.toLowerCase().replace(/[^a-z0-9]+/g, "");
    };

    it("normalizes M340i variants", () => {
      expect(normalizeTrim("M340i")).toBe("m340i");
      expect(normalizeTrim("M 340i")).toBe("m340i");
      expect(normalizeTrim("M340 i")).toBe("m340i");
    });

    it("normalizes M440i variants", () => {
      expect(normalizeTrim("M440i")).toBe("m440i");
      expect(normalizeTrim("M 440i")).toBe("m440i");
    });
  });

  describe("Audi S/RS trims", () => {
    const normalizeTrim = (trim: string) => {
      return trim.toLowerCase().replace(/[^a-z0-9]+/g, "");
    };

    it("normalizes S4 variants", () => {
      expect(normalizeTrim("S4")).toBe("s4");
      expect(normalizeTrim("S 4")).toBe("s4");
    });

    it("normalizes RS5 variants", () => {
      expect(normalizeTrim("RS5")).toBe("rs5");
      expect(normalizeTrim("RS 5")).toBe("rs5");
    });
  });
});
