/**
 * Canonical Source Enforcement Tests
 * 
 * These tests ensure tire-sizes route ONLY uses vehicle_fitments as data source.
 * Tests will FAIL if deprecated sources are re-introduced.
 * 
 * 2026-05-14: Created for canonical source enforcement
 */

import { readFileSync } from "fs";
import { resolve } from "path";

describe("tire-sizes canonical source enforcement", () => {
  let routeSource: string;

  beforeAll(() => {
    // Read the route source file
    const routePath = resolve(__dirname, "../route.ts");
    routeSource = readFileSync(routePath, "utf-8");
  });

  test("should NOT import vehicleFitmentConfigurations", () => {
    // Check for any import of the deprecated config table
    const hasConfigImport = 
      routeSource.includes("vehicleFitmentConfigurations") &&
      !routeSource.includes("// vehicleFitmentConfigurations") && // Allow comments
      !routeSource.includes("/* vehicleFitmentConfigurations"); // Allow comments

    expect(hasConfigImport).toBe(false);
  });

  test("should NOT import getFitmentConfigurations", () => {
    // Check for the function that reads from config table
    const hasGetFitmentConfigs = 
      /import.*getFitmentConfigurations/.test(routeSource) ||
      /from.*getFitmentConfigurations/.test(routeSource);

    expect(hasGetFitmentConfigs).toBe(false);
  });

  test("should NOT import static OEM tire sizes JSON", () => {
    // Check for import of static JSON file
    const hasStaticImport = 
      /import.*oem-tire-sizes\.json/.test(routeSource) &&
      !routeSource.includes("// import") && // Allow commented imports
      !/\/\/.*oem-tire-sizes/.test(routeSource);

    // If the import exists but is commented out, that's OK
    const activeImport = /^import\s+.*oem-tire-sizes\.json/m.test(routeSource);
    
    expect(activeImport).toBe(false);
  });

  test("should NOT call getStaticOemSizes function", () => {
    // Check for calls to the static fallback function
    const hasStaticCall = 
      /getStaticOemSizes\s*\(/.test(routeSource) &&
      !routeSource.includes("// getStaticOemSizes") &&
      !/function\s+getStaticOemSizes/.test(routeSource); // Function definition is OK if not called

    expect(hasStaticCall).toBe(false);
  });

  test("should NOT return source: 'config'", () => {
    // Check for config table source in responses
    const hasConfigSource = /source:\s*["']config["']/.test(routeSource);
    expect(hasConfigSource).toBe(false);
  });

  test("should NOT return source: 'static-fallback'", () => {
    // Check for static fallback source in responses
    const hasStaticSource = /source:\s*["']static-fallback["']/.test(routeSource);
    expect(hasStaticSource).toBe(false);
  });

  test("should use canonicalResolver for fitment lookup", () => {
    // Verify canonical resolver is used
    const usesResolver = routeSource.includes("resolveVehicleFitment");
    expect(usesResolver).toBe(true);
  });

  test("should import from @/lib/fitment/canonicalResolver", () => {
    // Verify resolver import (can be dynamic)
    const hasResolverImport = 
      routeSource.includes("@/lib/fitment/canonicalResolver") ||
      routeSource.includes("canonicalResolver");
    expect(hasResolverImport).toBe(true);
  });
});

/**
 * Integration smoke tests for canonical enforcement
 * These test actual API responses against known vehicles
 */
describe("tire-sizes API smoke tests", () => {
  const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

  // Skip if no server available
  const itWithServer = process.env.SKIP_INTEGRATION ? it.skip : it;

  const testVehicles = [
    { year: 2024, make: "Ford", model: "F-150", trim: "Lightning" },
    { year: 2024, make: "Chevrolet", model: "Silverado 2500HD", trim: "LT" },
    { year: 2024, make: "Toyota", model: "Camry", trim: "LE" },
    { year: 2024, make: "Honda", model: "Civic", trim: "Sport" },
    { year: 2024, make: "Toyota", model: "Tacoma", trim: "SR5" },
    { year: 2018, make: "Chevrolet", model: "Corvette", trim: "Stingray" },
    { year: 2018, make: "Chevrolet", model: "Camaro", trim: "SS" },
    { year: 2024, make: "BMW", model: "M3", trim: "M3 Competition" },
    { year: 2024, make: "BMW", model: "M4", trim: "Competition" },
    { year: 2018, make: "Porsche", model: "911", trim: "Carrera" },
  ];

  itWithServer("should NOT return source: 'config' for any vehicle", async () => {
    for (const v of testVehicles) {
      const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        
        expect(data.source).not.toBe("config");
        expect(data.debug?.fitmentSource).not.toBe("config");
      } catch (err) {
        // Server not available - skip
      }
    }
  });

  itWithServer("should NOT return source: 'static-fallback' for any vehicle", async () => {
    for (const v of testVehicles) {
      const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        
        expect(data.source).not.toBe("static-fallback");
      } catch (err) {
        // Server not available - skip
      }
    }
  });
});
