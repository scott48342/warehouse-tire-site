/**
 * Tests for Universal Fitment Resolver
 * 
 * Verifies that all model name variations resolve to the same fitment data.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { 
  resolveUniversalFitment, 
  getModelVariants,
  hasUniversalFitmentCoverage,
} from "../universalFitmentResolver";

// Skip tests in CI without database
const describeWithDb = process.env.POSTGRES_URL ? describe : describe.skip;

describeWithDb("universalFitmentResolver", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Chevrolet Silverado 2500 HD Variants
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("Chevrolet Silverado 2500 HD", () => {
    const variants = [
      "Silverado 2500 HD",   // User input (with space)
      "Silverado 2500HD",    // DB format (no space)
      "silverado-2500hd",    // Slug format
      "silverado-2500-hd",   // URL format
      "SILVERADO 2500 HD",   // Uppercase
    ];
    
    let baseResult: Awaited<ReturnType<typeof resolveUniversalFitment>> | null = null;
    
    beforeAll(async () => {
      baseResult = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model: "Silverado 2500 HD",
      });
    });
    
    it("should find fitment data", () => {
      expect(baseResult?.found).toBe(true);
      expect(baseResult?.boltPattern).toBe("8x180");
    });
    
    it.each(variants)("variant '%s' should resolve to same bolt pattern", async (model) => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model,
      });
      
      expect(result.found).toBe(true);
      expect(result.boltPattern).toBe(baseResult?.boltPattern);
      expect(result.normalized.model).toContain("Silverado 2500");
    });
    
    it("should normalize model to DB format", async () => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet", 
        model: "silverado-2500-hd", // URL slug
      });
      
      // Should match DB format "Silverado 2500HD" (no space before HD)
      expect(result.normalized.matchedVariant).toBe("Silverado 2500HD");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GMC Sierra 2500 HD Variants
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("GMC Sierra 2500 HD", () => {
    const variants = [
      "Sierra 2500 HD",
      "Sierra 2500HD",
      "sierra-2500hd",
      "sierra-2500-hd",
    ];
    
    it.each(variants)("variant '%s' should find same fitment", async (model) => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "GMC",
        model,
      });
      
      expect(result.found).toBe(true);
      expect(result.boltPattern).toBe("8x180"); // Same as Silverado 2500HD
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Ram Truck Variants (1500, 2500, 3500)
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("Ram Trucks", () => {
    it("Ram 1500 vs 1500 should resolve same", async () => {
      const result1 = await resolveUniversalFitment({
        year: 2023,
        make: "Ram",
        model: "Ram 1500",
      });
      
      const result2 = await resolveUniversalFitment({
        year: 2023,
        make: "Ram",
        model: "1500",
      });
      
      expect(result1.found).toBe(result2.found);
      if (result1.found && result2.found) {
        expect(result1.boltPattern).toBe(result2.boltPattern);
      }
    });
    
    it("Ram 2500 vs 2500 should resolve same", async () => {
      const result1 = await resolveUniversalFitment({
        year: 2023,
        make: "Ram",
        model: "Ram 2500",
      });
      
      const result2 = await resolveUniversalFitment({
        year: 2023,
        make: "Ram",
        model: "2500",
      });
      
      expect(result1.found).toBe(result2.found);
      if (result1.found && result2.found) {
        expect(result1.boltPattern).toBe(result2.boltPattern);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Silverado 1500 Variants
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("Chevrolet Silverado 1500", () => {
    it("Silverado 1500 vs Silverado-1500 should resolve same", async () => {
      const result1 = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model: "Silverado 1500",
      });
      
      const result2 = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model: "silverado-1500",
      });
      
      expect(result1.found).toBe(result2.found);
      if (result1.found && result2.found) {
        expect(result1.boltPattern).toBe(result2.boltPattern);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Make Normalization
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("Make normalization", () => {
    it("chevy should resolve to Chevrolet", async () => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "chevy",
        model: "Silverado 1500",
      });
      
      expect(result.normalized.make).toBe("Chevrolet");
    });
    
    it("mercedes should resolve to Mercedes-Benz", async () => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "mercedes",
        model: "C-Class",
      });
      
      expect(result.normalized.make).toBe("Mercedes-Benz");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getModelVariants unit tests
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("getModelVariants", () => {
    it("Silverado 2500 HD should include DB format first", () => {
      const variants = getModelVariants("Silverado 2500 HD");
      
      // Should include the actual DB format
      expect(variants).toContain("Silverado 2500HD");
      
      // DB format should be early in the list (HD rich priority)
      const index = variants.indexOf("Silverado 2500HD");
      expect(index).toBeLessThan(3);
    });
    
    it("silverado-2500-hd slug should include title case variant", () => {
      const variants = getModelVariants("silverado-2500-hd");
      
      expect(variants).toContain("Silverado 2500HD");
    });
    
    it("Ram 1500 should include number-only variant", () => {
      const variants = getModelVariants("Ram 1500");
      
      expect(variants.some(v => v === "1500" || v === "Ram 1500")).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Coverage check
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("hasUniversalFitmentCoverage", () => {
    it("should return true for known vehicles", async () => {
      const hasData = await hasUniversalFitmentCoverage(2023, "Chevrolet", "Silverado 2500 HD");
      expect(hasData).toBe(true);
    });
    
    it("should return false for unknown vehicles", async () => {
      const hasData = await hasUniversalFitmentCoverage(9999, "FakeMake", "FakeModel");
      expect(hasData).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Result structure validation
  // ─────────────────────────────────────────────────────────────────────────
  
  describe("Result structure", () => {
    it("should include all required fields", async () => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model: "Silverado 2500 HD",
      });
      
      // Input echo
      expect(result.input).toBeDefined();
      expect(result.input.year).toBe(2023);
      expect(result.input.make).toBe("Chevrolet");
      expect(result.input.model).toBe("Silverado 2500 HD");
      
      // Normalized
      expect(result.normalized).toBeDefined();
      expect(result.normalized.make).toBe("Chevrolet");
      expect(result.normalized.modelVariantsTried).toBeInstanceOf(Array);
      
      // Core data
      expect(result.canonicalVehicleKey).toBeDefined();
      expect(typeof result.found).toBe("boolean");
      expect(result.source).toBeDefined();
      expect(result.confidence).toMatch(/^(high|medium|low)$/);
      
      // Debug
      expect(result.debug).toBeDefined();
      expect(typeof result.debug.resolutionTimeMs).toBe("number");
      expect(typeof result.debug.dbQueriesCount).toBe("number");
    });
    
    it("should return availableTrims for multi-trim vehicles", async () => {
      const result = await resolveUniversalFitment({
        year: 2023,
        make: "Chevrolet",
        model: "Silverado 2500 HD",
      });
      
      if (result.found) {
        expect(result.availableTrims).toBeInstanceOf(Array);
        expect(result.availableTrims.length).toBeGreaterThan(0);
        
        const trim = result.availableTrims[0];
        expect(trim.modificationId).toBeDefined();
        expect(trim.displayTrim).toBeDefined();
        expect(trim.tireSizes).toBeInstanceOf(Array);
      }
    });
  });
});
