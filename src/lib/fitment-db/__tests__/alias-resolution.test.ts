/**
 * ALIAS RESOLUTION TESTS
 * 
 * Ensures known model aliases always resolve correctly.
 * Run: npm test -- --testPathPattern=alias-resolution
 */

import { getModelVariants, wasAliasUsed, MODEL_ALIASES } from "../modelAliases";
import { normalizeModel, normalizeMake } from "../keys";

describe("Model Alias Resolution", () => {
  
  // ══════════════════════════════════════════════════════════════════════════
  // Core Alias Tests
  // ══════════════════════════════════════════════════════════════════════════
  
  describe("getModelVariants", () => {
    
    test("Ford F-250 resolves to super-duty variant", () => {
      const variants = getModelVariants("f-250");
      expect(variants).toContain("f-250");
      expect(variants).toContain("f-250-super-duty");
    });

    test("Ford F-350 resolves to super-duty variant", () => {
      const variants = getModelVariants("f-350");
      expect(variants).toContain("f-350");
      expect(variants).toContain("f-350-super-duty");
    });

    test("Ford F-450 resolves to super-duty variant", () => {
      const variants = getModelVariants("f-450");
      expect(variants).toContain("f-450");
      expect(variants).toContain("f-450-super-duty");
    });

    test("Chrysler 300 resolves to 300c/300s/300m variants", () => {
      const variants = getModelVariants("300");
      expect(variants).toContain("300");
      expect(variants).toContain("300c");
      expect(variants).toContain("300s");
      expect(variants).toContain("300m");
    });

    test("Chrysler 300c also resolves to base 300", () => {
      const variants = getModelVariants("300c");
      expect(variants).toContain("300c");
      expect(variants).toContain("300");
    });

    test("Silverado-2500 resolves to HD variant", () => {
      const variants = getModelVariants("silverado-2500");
      expect(variants).toContain("silverado-2500");
      expect(variants).toContain("silverado-2500hd");
    });

    test("Sierra-3500 resolves to HD variant", () => {
      const variants = getModelVariants("sierra-3500");
      expect(variants).toContain("sierra-3500");
      expect(variants).toContain("sierra-3500hd");
    });

    test("RAM resolves to ram-1500", () => {
      const variants = getModelVariants("ram");
      expect(variants).toContain("ram");
      expect(variants).toContain("ram-1500");
    });

    test("Unknown model returns only input", () => {
      const variants = getModelVariants("unknown-model-xyz");
      expect(variants).toEqual(["unknown-model-xyz"]);
    });

    test("Input is always first in array (exact match priority)", () => {
      const variants = getModelVariants("f-350");
      expect(variants[0]).toBe("f-350");
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // Normalization Non-Collision Tests
  // ══════════════════════════════════════════════════════════════════════════
  
  describe("normalizeModel - no false collisions", () => {

    test("BMW M3 stays as m3, not 3-series", () => {
      expect(normalizeModel("m3")).toBe("m3");
      expect(normalizeModel("M3")).toBe("m3");
    });

    test("BMW M4 stays as m4, not 4-series", () => {
      expect(normalizeModel("m4")).toBe("m4");
      expect(normalizeModel("M4")).toBe("m4");
    });

    test("BMW M5 stays as m5, not 5-series", () => {
      expect(normalizeModel("m5")).toBe("m5");
      expect(normalizeModel("M5")).toBe("m5");
    });

    test("BMW M6 stays as m6, not 6-series", () => {
      expect(normalizeModel("m6")).toBe("m6");
    });

    test("BMW M8 stays as m8, not 8-series", () => {
      expect(normalizeModel("m8")).toBe("m8");
    });

    test("Audi S4 stays as s4, not a4", () => {
      expect(normalizeModel("s4")).toBe("s4");
      expect(normalizeModel("S4")).toBe("s4");
    });

    test("Audi RS4 stays as rs4", () => {
      expect(normalizeModel("rs4")).toBe("rs4");
      expect(normalizeModel("RS4")).toBe("rs4");
    });

    test("Audi S3 stays as s3", () => {
      expect(normalizeModel("s3")).toBe("s3");
    });

    test("Audi RS3 stays as rs3", () => {
      expect(normalizeModel("rs3")).toBe("rs3");
    });

    test("Audi SQ5 stays as sq5", () => {
      expect(normalizeModel("sq5")).toBe("sq5");
    });

    test("Audi RSQ8 stays as rsq8", () => {
      expect(normalizeModel("rsq8")).toBe("rsq8");
    });

    test("BMW 3-series normalizes correctly", () => {
      expect(normalizeModel("3-series")).toBe("3-series");
      expect(normalizeModel("3 series")).toBe("3-series");
    });

    test("BMW 330i normalizes to 3-series", () => {
      expect(normalizeModel("330i")).toBe("3-series");
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // Make Normalization Tests
  // ══════════════════════════════════════════════════════════════════════════
  
  describe("normalizeMake", () => {

    test("Mercedes-Benz normalizes to mercedes", () => {
      expect(normalizeMake("Mercedes-Benz")).toBe("mercedes");
      expect(normalizeMake("mercedes-benz")).toBe("mercedes");
      expect(normalizeMake("mercedes benz")).toBe("mercedes");
    });

    test("Chevy normalizes to chevrolet", () => {
      expect(normalizeMake("chevy")).toBe("chevrolet");
      expect(normalizeMake("Chevy")).toBe("chevrolet");
    });

    test("VW normalizes to volkswagen", () => {
      expect(normalizeMake("vw")).toBe("volkswagen");
      expect(normalizeMake("VW")).toBe("volkswagen");
    });

    test("Land Rover normalizes to land-rover", () => {
      expect(normalizeMake("Land Rover")).toBe("land-rover");
      expect(normalizeMake("landrover")).toBe("land-rover");
    });

    test("Alfa Romeo normalizes to alfa-romeo", () => {
      expect(normalizeMake("Alfa Romeo")).toBe("alfa-romeo");
      expect(normalizeMake("alfaromeo")).toBe("alfa-romeo");
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // wasAliasUsed Tests
  // ══════════════════════════════════════════════════════════════════════════
  
  describe("wasAliasUsed", () => {

    test("Detects when alias was used", () => {
      expect(wasAliasUsed("f-350", "f-350-super-duty")).toBe(true);
      expect(wasAliasUsed("300", "300c")).toBe(true);
    });

    test("Returns false for exact matches", () => {
      expect(wasAliasUsed("f-350", "f-350")).toBe(false);
      expect(wasAliasUsed("camry", "camry")).toBe(false);
    });

    test("Returns false for non-alias mismatches", () => {
      expect(wasAliasUsed("camry", "accord")).toBe(false);
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // Critical Vehicle Resolution Tests
  // ══════════════════════════════════════════════════════════════════════════
  
  describe("Critical vehicle aliases", () => {

    test("All Super Duty trucks have aliases", () => {
      expect(MODEL_ALIASES["f-250"]).toBeDefined();
      expect(MODEL_ALIASES["f-350"]).toBeDefined();
      expect(MODEL_ALIASES["f-450"]).toBeDefined();
    });

    test("All HD trucks have aliases", () => {
      expect(MODEL_ALIASES["silverado-2500"]).toBeDefined();
      expect(MODEL_ALIASES["silverado-3500"]).toBeDefined();
      expect(MODEL_ALIASES["sierra-2500"]).toBeDefined();
      expect(MODEL_ALIASES["sierra-3500"]).toBeDefined();
    });

    test("Chrysler 300 variants have aliases", () => {
      expect(MODEL_ALIASES["300"]).toBeDefined();
      expect(MODEL_ALIASES["300c"]).toBeDefined();
    });

  });

});
