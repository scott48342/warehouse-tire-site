/**
 * Garage Flow Test Script
 * 
 * This script tests the URL → Garage flow by simulating the React context behavior.
 * Run with: node scripts/test-garage-flow.js
 */

// Simulated localStorage
const storage = new Map();

const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Constants from GarageContext
const GARAGE_KEY = "wt_garage";
const ACTIVE_KEY = "wt_garage_active_id";
const LEGACY_KEY = "wt_active_vehicle";
const GARAGE_VERSION = 1;
const MAX_VEHICLES = 10;

// GarageVehicle type simulation
function generateId() {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Deduplication logic from GarageContext
function isSameVehicle(a, b) {
  // Primary: match by canonical modification ID
  if (a.modification && b.modification && a.modification === b.modification) {
    return true;
  }
  // Fallback: match by year + make + model + trim (normalized)
  const normalize = (s) => String(s || "").toLowerCase().trim();
  return (
    normalize(a.year) === normalize(b.year) &&
    normalize(a.make) === normalize(b.make) &&
    normalize(a.model) === normalize(b.model) &&
    normalize(a.trim) === normalize(b.trim)
  );
}

// Read garage from storage
function readGarage() {
  try {
    const raw = localStorage.getItem(GARAGE_KEY);
    if (!raw) return { vehicles: [], version: GARAGE_VERSION };
    const data = JSON.parse(raw);
    if (!data.vehicles || !Array.isArray(data.vehicles)) {
      return { vehicles: [], version: GARAGE_VERSION };
    }
    return data;
  } catch {
    return { vehicles: [], version: GARAGE_VERSION };
  }
}

// Write garage to storage
function writeGarage(data) {
  localStorage.setItem(GARAGE_KEY, JSON.stringify(data));
}

// Read active ID
function readActiveId() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Write active ID
function writeActiveId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

// Add vehicle (with deduplication)
function addVehicle(vehicleData) {
  const garage = readGarage();
  
  // Check for existing duplicate
  const existing = garage.vehicles.find(v => isSameVehicle(v, vehicleData));
  if (existing) {
    // Update lastActiveAt on existing
    existing.lastActiveAt = Date.now();
    writeGarage(garage);
    return existing.id;
  }
  
  // Create new vehicle
  const newVehicle = {
    id: generateId(),
    year: vehicleData.year,
    make: vehicleData.make,
    model: vehicleData.model,
    trim: vehicleData.trim,
    modification: vehicleData.modification,
    wheelDia: vehicleData.wheelDia,
    addedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  
  // Add to garage (limit to MAX_VEHICLES)
  garage.vehicles.unshift(newVehicle);
  if (garage.vehicles.length > MAX_VEHICLES) {
    garage.vehicles = garage.vehicles.slice(0, MAX_VEHICLES);
  }
  
  writeGarage(garage);
  return newVehicle.id;
}

// Set active vehicle by data (the key method being tested)
function setActiveVehicleByData(vehicleData) {
  // Add to garage (returns existing ID if duplicate)
  const id = addVehicle(vehicleData);
  // Set as active
  writeActiveId(id);
  return id;
}

// Get active vehicle
function getActiveVehicle() {
  const activeId = readActiveId();
  if (!activeId) return null;
  const garage = readGarage();
  return garage.vehicles.find(v => v.id === activeId) || null;
}

// ============================================================================
// TESTS
// ============================================================================

console.log("=== Garage Flow Test Suite ===\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    localStorage.clear();
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Test 1: Add Vehicle A, set as active
test("Add Vehicle A and set active", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  const idA = setActiveVehicleByData(vehicleA);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 1, "Should have 1 vehicle");
  assert(garage.vehicles[0].id === idA, "Vehicle ID should match");
  
  const active = getActiveVehicle();
  assert(active !== null, "Active vehicle should exist");
  assert(active.year === "2024", "Active year should be 2024");
  assert(active.make === "Ford", "Active make should be Ford");
});

// Test 2: Navigate to Vehicle B URL, verify it's added and active
test("Navigate to Vehicle B URL → adds to garage and sets active", () => {
  // Setup: Vehicle A already in garage
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  
  // Simulate URL navigation to Vehicle B (this is what VehicleMemorySync does)
  const vehicleB = { year: "2022", make: "Toyota", model: "Camry", trim: "SE" };
  setActiveVehicleByData(vehicleB);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 2, `Should have 2 vehicles, got ${garage.vehicles.length}`);
  
  const active = getActiveVehicle();
  assert(active !== null, "Active vehicle should exist");
  assert(active.year === "2022", "Active should be Vehicle B (year)");
  assert(active.make === "Toyota", "Active should be Vehicle B (make)");
});

// Test 3: Navigate to same URL twice → no duplicate
test("Navigate to same URL twice → no duplicate created", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  setActiveVehicleByData(vehicleA); // Same vehicle again
  
  const garage = readGarage();
  assert(garage.vehicles.length === 1, `Should still have 1 vehicle, got ${garage.vehicles.length}`);
});

// Test 4: Navigate to Vehicle B, then refresh → Vehicle B remains active
test("Refresh persistence → Vehicle B remains active", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  
  const vehicleB = { year: "2022", make: "Toyota", model: "Camry", trim: "SE" };
  const idB = setActiveVehicleByData(vehicleB);
  
  // Simulate refresh: read from storage again
  const activeId = readActiveId();
  assert(activeId === idB, "Active ID should persist after refresh");
  
  const active = getActiveVehicle();
  assert(active.make === "Toyota", "Vehicle B should still be active after refresh");
});

// Test 5: Both vehicles remain in garage after operations
test("Both vehicles remain in garage", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  
  const vehicleB = { year: "2022", make: "Toyota", model: "Camry", trim: "SE" };
  setActiveVehicleByData(vehicleB);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 2, "Should have both vehicles");
  
  const makes = garage.vehicles.map(v => v.make).sort();
  assert(makes.includes("Ford"), "Should have Ford");
  assert(makes.includes("Toyota"), "Should have Toyota");
});

// Test 6: Switch back to Vehicle A via garage
test("Switch back to Vehicle A → sets active correctly", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  const idA = setActiveVehicleByData(vehicleA);
  
  const vehicleB = { year: "2022", make: "Toyota", model: "Camry", trim: "SE" };
  setActiveVehicleByData(vehicleB);
  
  // Switch back to A (simulating garage switcher)
  writeActiveId(idA);
  
  const active = getActiveVehicle();
  assert(active.make === "Ford", "Vehicle A should now be active");
});

// Test 7: Deduplication by modification ID
test("Deduplication by modification ID", () => {
  const vehicleA = { 
    year: "2024", make: "Ford", model: "F-150", trim: "XLT",
    modification: "mod_abc123"
  };
  setActiveVehicleByData(vehicleA);
  
  // Same modification but different trim label
  const vehicleA2 = { 
    year: "2024", make: "Ford", model: "F-150", trim: "XLT SuperCrew",
    modification: "mod_abc123"
  };
  setActiveVehicleByData(vehicleA2);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 1, `Should detect duplicate by modification, got ${garage.vehicles.length}`);
});

// Test 8: Deduplication by year/make/model/trim (no modification)
test("Deduplication by year/make/model/trim when no modification", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  
  // Same vehicle, no modification
  const vehicleA2 = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA2);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 1, `Should detect duplicate by YMMT, got ${garage.vehicles.length}`);
});

// Test 9: Case-insensitive deduplication
test("Case-insensitive deduplication", () => {
  const vehicleA = { year: "2024", make: "Ford", model: "F-150", trim: "XLT" };
  setActiveVehicleByData(vehicleA);
  
  const vehicleA2 = { year: "2024", make: "FORD", model: "f-150", trim: "xlt" };
  setActiveVehicleByData(vehicleA2);
  
  const garage = readGarage();
  assert(garage.vehicles.length === 1, `Should detect case-insensitive duplicate, got ${garage.vehicles.length}`);
});

// Test 10: Legacy migration (SavedVehicle object format)
test("Legacy migration from SavedVehicle object format", () => {
  // Setup: legacy format in wt_active_vehicle
  const legacyVehicle = {
    year: "2024", make: "Ford", model: "F-150", trim: "XLT",
    savedAt: Date.now(), version: 1
  };
  localStorage.setItem(LEGACY_KEY, JSON.stringify(legacyVehicle));
  
  // Add to garage manually (simulating what migration does)
  const id = addVehicle(legacyVehicle);
  writeActiveId(id);
  
  const active = getActiveVehicle();
  assert(active !== null, "Should migrate legacy vehicle");
  assert(active.make === "Ford", "Migrated vehicle should have correct make");
});

// Summary
console.log("\n=== Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
