/**
 * CANONICAL RESOLVER TESTS
 * 
 * Tests for Phase 2 integration of wheelSizeTrimMappings into canonicalResolver.ts
 * 
 * Test coverage:
 * 1. Exact modificationId still wins
 * 2. Approved trim mapping beats grouped fallback
 * 3. No mapping keeps old behavior
 * 4. Rejected/pending mappings are ignored
 * 5. showSizeChooser=false suppresses unnecessary chooser
 * 6. showSizeChooser=true returns only mapped configurations
 * 
 * Run: npm test -- --testPathPattern=canonicalResolver
 */

// Mock the database module before imports
jest.mock("@/lib/fitment-db/db", () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: jest.fn(),
  },
}));

jest.mock("@/lib/fitment-db/applyOverrides", () => ({
  applyOverrides: jest.fn((fitment) => Promise.resolve(fitment)),
}));

jest.mock("@/lib/fitment-db/modelAliases", () => ({
  getModelVariants: jest.fn((model: string) => [model.toLowerCase()]),
}));

jest.mock("@/lib/fitment-db/keys", () => ({
  normalizeMake: jest.fn((make: string) => make.toLowerCase()),
  normalizeModel: jest.fn((model: string) => model.toLowerCase().replace(/\s+/g, "-")),
  slugify: jest.fn((str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
}));

// Mock the trim mapping service
jest.mock("@/lib/fitment-db/wheelSizeTrimMapping", () => ({
  getTrimMapping: jest.fn(),
}));

import { resolveVehicleFitment, type CanonicalFitmentResult } from "../canonicalResolver";
import { db } from "@/lib/fitment-db/db";
import { getTrimMapping } from "@/lib/fitment-db/wheelSizeTrimMapping";

// Helper to create mock fitment records
function createMockFitment(overrides = {}) {
  return {
    id: "fitment-uuid-1",
    year: 2024,
    make: "ford",
    model: "f-150",
    modificationId: "xlt",
    displayTrim: "XLT",
    boltPattern: "6x135",
    centerBoreMm: "87.1",
    oemTireSizes: ["275/65R18"],
    certificationStatus: "certified",
    ...overrides,
  };
}

// Helper to create mock trim mapping result
function createMockMappingResult(overrides = {}) {
  return {
    found: false,
    mapping: null,
    configurations: [],
    autoSelectConfig: null,
    showSizeChooser: true,
    chooserReason: 'no_mapping' as const,
    ...overrides,
  };
}

// Helper to create mock configuration
function createMockConfig(overrides = {}) {
  return {
    id: "config-uuid-1",
    wheelDiameter: 18,
    tireSize: "275/65R18",
    isDefault: true,
    ...overrides,
  };
}

describe("Canonical Resolver - Wheel-Size Trim Mapping Integration", () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock: no mapping found
    (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult());
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Exact modificationId still wins
  // ─────────────────────────────────────────────────────────────────────────
  describe("1. Exact modificationId match (highest priority)", () => {
    
    test("Exact modificationId beats everything, including approved trim mapping", async () => {
      const mockFitment = createMockFitment({ modificationId: "xlt-4x4" });
      
      // Mock DB returns exact modification match
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockFitment]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      // Even if there's an approved mapping, modificationId wins
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "mapping-1",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "xlt",
        },
        showSizeChooser: false,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
        modificationId: "xlt-4x4",
      });
      
      expect(result.matchedBy).toBe("exact_modification_id");
      expect(result.confidence).toBe("high");
      expect(result.modificationId).toBe("xlt-4x4");
    });

    test("Grouped record with exact modificationId resolves to atomic trim", async () => {
      const mockFitment = createMockFitment({
        modificationId: "base-trims",
        displayTrim: "XL, XLT, Lariat", // Grouped
      });
      
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockFitment]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
        modificationId: "base-trims",
      });
      
      expect(result.matchedBy).toBe("exact_modification_id");
      expect(result.displayTrim).toBe("XLT"); // Returns atomic, not grouped
      expect(result.debug.wasGroupedRecord).toBe(true);
      expect(result.debug.matchedAtomicTrim).toBe("XLT");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Approved trim mapping beats grouped fallback
  // ─────────────────────────────────────────────────────────────────────────
  describe("2. Approved trim mapping beats grouped fallback", () => {
    
    test("Approved high-confidence mapping is used", async () => {
      // Mock DB returns no exact modificationId match
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]), // No match
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const mockConfig = createMockConfig();
      const mockMapping = {
        id: "mapping-uuid-1",
        status: "approved",
        matchConfidence: "high",
        matchMethod: "exact_normalized",
        ourModificationId: "xlt",
        vehicleFitmentId: "fitment-uuid-1",
      };
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: mockMapping,
        configurations: [mockConfig],
        autoSelectConfig: mockConfig,
        showSizeChooser: false,
        chooserReason: null,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      expect(result.matchedBy).toBe("wheel_size_trim_mapping");
      expect(result.confidence).toBe("high");
      expect(result.trimMapping.found).toBe(true);
      expect(result.trimMapping.mappingId).toBe("mapping-uuid-1");
      expect(result.trimMapping.showSizeChooser).toBe(false);
      expect(result.trimMapping.autoSelectedConfig).toEqual({
        configId: mockConfig.id,
        wheelDiameter: mockConfig.wheelDiameter,
        tireSize: mockConfig.tireSize,
        isDefault: mockConfig.isDefault,
      });
    });

    test("Approved medium-confidence mapping is used", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const mockConfig = createMockConfig();
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "mapping-2",
          status: "approved",
          matchConfidence: "medium",
          matchMethod: "fuzzy_high",
          ourModificationId: "sport",
        },
        configurations: [mockConfig],
        autoSelectConfig: mockConfig,
        showSizeChooser: false,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Sport",
      });
      
      expect(result.matchedBy).toBe("wheel_size_trim_mapping");
      expect(result.confidence).toBe("medium"); // Medium confidence from mapping
    });

    test("Debug metadata includes trim mapping info", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "mapping-debug-1",
          status: "approved",
          matchConfidence: "high",
          matchMethod: "exact_normalized",
          ourModificationId: "xlt",
        },
        configurations: [createMockConfig()],
        autoSelectConfig: createMockConfig(),
        showSizeChooser: false,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      expect(result.debug.trimMappingDebug.resolutionSource).toBe("wheel_size_trim_mapping");
      expect(result.debug.trimMappingDebug.mappingId).toBe("mapping-debug-1");
      expect(result.debug.trimMappingDebug.mappingStatus).toBe("approved");
      expect(result.debug.trimMappingDebug.matchConfidence).toBe("high");
      expect(result.debug.trimMappingDebug.matchMethod).toBe("exact_normalized");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: No mapping keeps old behavior
  // ─────────────────────────────────────────────────────────────────────────
  describe("3. No mapping keeps old behavior", () => {
    
    test("Falls through to exact canonical trim match when no mapping exists", async () => {
      const mockFitment = createMockFitment({ displayTrim: "Lariat" });
      
      // First call: no modificationId match
      // Second call: exact displayTrim match
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) return Promise.resolve([]); // No mod match
              return Promise.resolve([mockFitment]); // Exact trim match
            }),
          }),
        }),
      }));
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      // No mapping found
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult());
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Lariat",
      });
      
      expect(result.matchedBy).toBe("exact_canonical_trim");
      expect(result.trimMapping.found).toBe(false);
      expect(result.trimMapping.chooserReason).toBe("no_mapping");
    });

    test("trimMapping.found is false when no mapping exists", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: false,
        mapping: null,
        chooserReason: 'no_mapping',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Unknown",
      });
      
      expect(result.trimMapping.found).toBe(false);
      expect(result.debug.trimMappingDebug.resolutionSource).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Rejected/pending mappings are ignored
  // ─────────────────────────────────────────────────────────────────────────
  describe("4. Rejected/pending mappings are ignored", () => {
    
    test("Pending mapping is ignored - falls through to other resolution", async () => {
      const mockFitment = createMockFitment({ displayTrim: "XLT" });
      
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) return Promise.resolve([]);
              return Promise.resolve([mockFitment]);
            }),
          }),
        }),
      }));
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      // Pending mapping - should NOT be used
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "pending-mapping",
          status: "pending", // NOT approved
          matchConfidence: "high",
          ourModificationId: "xlt",
        },
        configurations: [createMockConfig()],
        showSizeChooser: true,
        chooserReason: 'needs_review',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      // Should NOT use the mapping - falls through to exact_canonical_trim
      expect(result.matchedBy).toBe("exact_canonical_trim");
      expect(result.trimMapping.found).toBe(true); // Mapping exists
      expect(result.trimMapping.chooserReason).toBe("needs_review"); // But needs review
    });

    test("Rejected mapping is ignored", async () => {
      const mockFitment = createMockFitment({ displayTrim: "XLT" });
      
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) return Promise.resolve([]);
              return Promise.resolve([mockFitment]);
            }),
          }),
        }),
      }));
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "rejected-mapping",
          status: "rejected",
          matchConfidence: "high",
          ourModificationId: "xlt",
        },
        configurations: [],
        showSizeChooser: true,
        chooserReason: 'needs_review',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      expect(result.matchedBy).toBe("exact_canonical_trim");
    });

    test("Low confidence mapping is ignored even if approved", async () => {
      const mockFitment = createMockFitment({ displayTrim: "XLT" });
      
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) return Promise.resolve([]);
              return Promise.resolve([mockFitment]);
            }),
          }),
        }),
      }));
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      // Low confidence even though approved
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "low-conf-mapping",
          status: "approved",
          matchConfidence: "low", // LOW confidence
          ourModificationId: "xlt",
        },
        configurations: [createMockConfig()],
        showSizeChooser: true,
        chooserReason: 'low_confidence',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      // Low confidence mapping is NOT used for resolution
      expect(result.matchedBy).toBe("exact_canonical_trim");
      expect(result.trimMapping.showSizeChooser).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: showSizeChooser=false suppresses unnecessary chooser
  // ─────────────────────────────────────────────────────────────────────────
  describe("5. showSizeChooser=false suppresses unnecessary chooser", () => {
    
    test("Single config trim has showSizeChooser=false", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const singleConfig = createMockConfig({ id: "single-config" });
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "single-config-mapping",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "xlt",
        },
        configurations: [singleConfig],
        autoSelectConfig: singleConfig,
        showSizeChooser: false, // SKIP the chooser
        chooserReason: null,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      expect(result.trimMapping.showSizeChooser).toBe(false);
      expect(result.trimMapping.autoSelectedConfig).toBeTruthy();
      expect(result.trimMapping.autoSelectedConfig?.wheelDiameter).toBe(18);
      expect(result.trimMapping.chooserReason).toBeNull();
    });

    test("autoSelectedConfig contains correct wheel/tire info", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const config = createMockConfig({
        id: "premium-config",
        wheelDiameter: 20,
        tireSize: "275/55R20",
        isDefault: true,
      });
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "premium-mapping",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "platinum",
        },
        configurations: [config],
        autoSelectConfig: config,
        showSizeChooser: false,
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Platinum",
      });
      
      expect(result.trimMapping.autoSelectedConfig).toEqual({
        configId: "premium-config",
        wheelDiameter: 20,
        tireSize: "275/55R20",
        isDefault: true,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: showSizeChooser=true returns only mapped configurations
  // ─────────────────────────────────────────────────────────────────────────
  describe("6. showSizeChooser=true returns only mapped configurations", () => {
    
    test("Multiple configs have showSizeChooser=true with all configs listed", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const config1 = createMockConfig({ id: "config-18", wheelDiameter: 18, tireSize: "275/65R18", isDefault: true });
      const config2 = createMockConfig({ id: "config-20", wheelDiameter: 20, tireSize: "275/55R20", isDefault: false });
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "multi-config-mapping",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "raptor",
        },
        configurations: [config1, config2],
        autoSelectConfig: config1, // Default
        showSizeChooser: true, // SHOW the chooser
        chooserReason: 'multiple_configs',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Raptor",
      });
      
      expect(result.trimMapping.showSizeChooser).toBe(true);
      expect(result.trimMapping.chooserReason).toBe("multiple_configs");
      expect(result.trimMapping.configurations).toHaveLength(2);
      expect(result.trimMapping.configurations).toEqual([
        { configId: "config-18", wheelDiameter: 18, tireSize: "275/65R18", isDefault: true },
        { configId: "config-20", wheelDiameter: 20, tireSize: "275/55R20", isDefault: false },
      ]);
    });

    test("Chooser shows only approved configurations, not all possible sizes", async () => {
      // This tests that we DON'T fall back to grouped/generic sizes
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      // Only 2 specific configs from the mapping, not all 5+ from grouped data
      const configs = [
        createMockConfig({ id: "sport-18", wheelDiameter: 18, tireSize: "265/70R18", isDefault: true }),
        createMockConfig({ id: "sport-20", wheelDiameter: 20, tireSize: "275/60R20", isDefault: false }),
      ];
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "sport-mapping",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "sport",
        },
        configurations: configs,
        autoSelectConfig: configs[0],
        showSizeChooser: true,
        chooserReason: 'multiple_configs',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Sport",
      });
      
      // Should return EXACTLY the mapped configs, not generic fallback sizes
      expect(result.trimMapping.configurations).toHaveLength(2);
      expect(result.trimMapping.configurations.map(c => c.wheelDiameter)).toEqual([18, 20]);
    });

    test("autoSelectConfig is the default configuration", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const configs = [
        createMockConfig({ id: "config-a", wheelDiameter: 18, isDefault: false }),
        createMockConfig({ id: "config-b", wheelDiameter: 20, isDefault: true }), // DEFAULT
        createMockConfig({ id: "config-c", wheelDiameter: 22, isDefault: false }),
      ];
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "multi-mapping",
          status: "approved",
          matchConfidence: "high",
          ourModificationId: "limited",
        },
        configurations: configs,
        autoSelectConfig: configs[1], // The default one
        showSizeChooser: true,
        chooserReason: 'multiple_configs',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "Limited",
      });
      
      expect(result.trimMapping.autoSelectedConfig?.configId).toBe("config-b");
      expect(result.trimMapping.autoSelectedConfig?.isDefault).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional edge cases
  // ─────────────────────────────────────────────────────────────────────────
  describe("Edge cases", () => {
    
    test("No trim specified does not invoke trim mapping lookup", async () => {
      const mockFitment = createMockFitment();
      
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockFitment]),
          }),
        }),
      });
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        // No trim specified
      });
      
      // getTrimMapping should not be called when no trim is specified
      expect(getTrimMapping).not.toHaveBeenCalled();
    });

    test("Mapping with needs_manual status is treated like pending", async () => {
      const mockFitment = createMockFitment({ displayTrim: "XLT" });
      
      let callCount = 0;
      const mockSelect = jest.fn().mockImplementation(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => {
              callCount++;
              if (callCount <= 1) return Promise.resolve([]);
              return Promise.resolve([mockFitment]);
            }),
          }),
        }),
      }));
      (db.select as jest.Mock).mockImplementation(mockSelect);
      
      (getTrimMapping as jest.Mock).mockResolvedValue(createMockMappingResult({
        found: true,
        mapping: {
          id: "needs-manual-mapping",
          status: "needs_manual",
          matchConfidence: "high",
          ourModificationId: "xlt",
        },
        configurations: [createMockConfig()],
        showSizeChooser: true,
        chooserReason: 'needs_review',
      }));
      
      const result = await resolveVehicleFitment({
        year: 2024,
        make: "Ford",
        model: "F-150",
        trim: "XLT",
      });
      
      // Should fall through to other resolution
      expect(result.matchedBy).toBe("exact_canonical_trim");
    });
  });
});
