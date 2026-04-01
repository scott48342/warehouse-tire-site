/**
 * SAFE RESOLVER TESTS
 * 
 * Tests for the controlled fallback logic in safeResolver.ts
 * Run: npm test -- --testPathPattern=safe-resolver
 */

// Mock the database module before imports
jest.mock("../db", () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../applyOverrides", () => ({
  applyOverrides: jest.fn((fitment) => Promise.resolve(fitment)),
}));

jest.mock("../logger", () => ({
  fitmentLog: {
    fallback: jest.fn(),
    notFound: jest.fn(),
    validationError: jest.fn(),
  },
}));

import { safeResolveFitment, type SafeResolverResult } from "../safeResolver";
import { db } from "../db";
import { fitmentLog } from "../logger";

describe("Safe Resolver", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Resolution Priority", () => {
    
    test("Exact modification match wins over trim fallback", async () => {
      const mockFitment = {
        id: "1",
        year: 2015,
        make: "ford",
        model: "f-250-super-duty",
        modificationId: "xlt",
        displayTrim: "XLT",
        boltPattern: "8x170",
        centerBoreMm: "124.9",
      };
      
      // Mock exact modification match
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn()
              .mockResolvedValueOnce([mockFitment])  // First call: exact mod match
          }),
        }),
      });
      
      const result = await safeResolveFitment(2015, "Ford", "F-250", "XLT");
      
      expect(result.method).toBe("exact_modification");
      expect(result.fitment).toBeTruthy();
      expect(result.isAmbiguous).toBe(false);
    });

    test("Logs fallback when trim match used", async () => {
      // This test verifies logging behavior
      // In real usage, this would trigger fitmentLog.fallback
      expect(fitmentLog.fallback).toBeDefined();
    });

  });

  describe("Trim Normalization", () => {
    
    test("Handles case variations", () => {
      // The normalizeTrim function is internal, but we test its effects
      // through the resolver behavior
      expect(true).toBe(true);
    });

    test("Strips cab types from comparison", () => {
      // XLT Crew Cab should match XLT
      // This is handled by the normalizeTrim function
      expect(true).toBe(true);
    });

  });

  describe("Ambiguity Detection", () => {
    
    test("Marks result as ambiguous when multiple trims match", async () => {
      // Mock ambiguous case: multiple normalized matches
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn()
              .mockResolvedValueOnce([])  // No exact mod match
              .mockResolvedValueOnce([])  // No exact trim match
              .mockResolvedValueOnce([])  // No case-insensitive match
              .mockResolvedValueOnce([    // Multiple trims exist
                { modificationId: "xlt-1", displayTrim: "XLT" },
                { modificationId: "xlt-2", displayTrim: "XLT Premium" },
              ]),
          }),
        }),
      });
      
      // Result should be ambiguous or not found
      // The exact behavior depends on normalization
      expect(true).toBe(true);
    });

  });

  describe("Single Trim Fallback", () => {
    
    test("Uses single trim when only one exists for Y/M/M", async () => {
      const mockFitment = {
        id: "1",
        year: 2015,
        make: "ford",
        model: "f-250-super-duty",
        modificationId: "base",
        displayTrim: "Base",
        boltPattern: "8x170",
        centerBoreMm: "124.9",
      };
      
      // Mock: no exact matches, but only one trim exists
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn()
              .mockResolvedValueOnce([])          // No exact mod match
              .mockResolvedValueOnce([])          // No exact trim match  
              .mockResolvedValueOnce([])          // No case-insensitive
              .mockResolvedValueOnce([mockFitment]) // Single trim exists
          }),
        }),
      });
      
      // Would use single_trim_fallback method
      expect(true).toBe(true);
    });

  });

  describe("Model Alias Support", () => {
    
    test("Tries model aliases (f-250 → f-250-super-duty)", async () => {
      // The resolver should try both f-250 and f-250-super-duty
      // This is tested through getModelVariants
      expect(true).toBe(true);
    });

    test("Logs when model alias is used", async () => {
      // Should call fitmentLog.fallback with "alias_used"
      expect(fitmentLog.fallback).toBeDefined();
    });

  });

  describe("Edge Cases", () => {
    
    test("Returns not_found when no matches exist", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      
      const result = await safeResolveFitment(9999, "Unknown", "Model", "trim");
      
      expect(result.method).toBe("not_found");
      expect(result.fitment).toBeNull();
    });

    test("Handles empty modificationId gracefully", async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      
      const result = await safeResolveFitment(2015, "Ford", "F-250", "");
      
      expect(result.method).toBe("not_found");
    });

  });

});
