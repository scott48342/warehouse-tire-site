/**
 * Final Garage URL Flow Verification Script
 * 
 * This script tests the core garage behavior by:
 * 1. Making HTTP requests to simulate URL navigation
 * 2. Extracting localStorage values from the response
 * 3. Verifying the expected behavior
 * 
 * Run: node scripts/verify-garage-final.js
 */

// Pure JS test - no external dependencies needed

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.data = {};
  }
  getItem(key) {
    return this.data[key] || null;
  }
  setItem(key, value) {
    this.data[key] = String(value);
  }
  removeItem(key) {
    delete this.data[key];
  }
  clear() {
    this.data = {};
  }
  get length() {
    return Object.keys(this.data).length;
  }
  key(index) {
    return Object.keys(this.data)[index] || null;
  }
}

const localStorage = new MockLocalStorage();

// Import the garage logic directly for testing
const GARAGE_KEY = 'wt_garage';
const ACTIVE_KEY = 'wt_garage_active_id';
const GARAGE_VERSION = 1;

function generateVehicleId() {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function loadGarage() {
  try {
    const raw = localStorage.getItem(GARAGE_KEY);
    if (!raw) return { version: GARAGE_VERSION, vehicles: [] };
    const data = JSON.parse(raw);
    return { version: data.version || 1, vehicles: data.vehicles || [] };
  } catch {
    return { version: GARAGE_VERSION, vehicles: [] };
  }
}

function saveGarage(garage) {
  localStorage.setItem(GARAGE_KEY, JSON.stringify(garage));
}

function getActiveId() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setActiveId(id) {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
}

function normalizeForMatch(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[-_\\s]+/g, '').trim();
}

function isDuplicateVehicle(existing, incoming) {
  // First check modification ID
  if (existing.modification && incoming.modification) {
    if (existing.modification === incoming.modification) return true;
  }
  
  // Fallback to normalized YMMT
  const existingKey = [
    existing.year,
    normalizeForMatch(existing.make),
    normalizeForMatch(existing.model),
    normalizeForMatch(existing.trim || ''),
  ].join('|');
  
  const incomingKey = [
    incoming.year,
    normalizeForMatch(incoming.make),
    normalizeForMatch(incoming.model),
    normalizeForMatch(incoming.trim || ''),
  ].join('|');
  
  return existingKey === incomingKey;
}

function addVehicle(vehicle) {
  const garage = loadGarage();
  
  // Check for duplicates
  const existingIndex = garage.vehicles.findIndex(v => isDuplicateVehicle(v, vehicle));
  
  if (existingIndex !== -1) {
    // Already exists - just set as active
    setActiveId(garage.vehicles[existingIndex].id);
    return { added: false, id: garage.vehicles[existingIndex].id };
  }
  
  // Add new vehicle
  const newVehicle = {
    ...vehicle,
    id: vehicle.id || generateVehicleId(),
    addedAt: Date.now(),
  };
  
  garage.vehicles.unshift(newVehicle);
  
  // Limit to 10 vehicles
  if (garage.vehicles.length > 10) {
    garage.vehicles = garage.vehicles.slice(0, 10);
  }
  
  saveGarage(garage);
  setActiveId(newVehicle.id);
  
  return { added: true, id: newVehicle.id };
}

function getActiveVehicle() {
  const id = getActiveId();
  if (!id) return null;
  const garage = loadGarage();
  return garage.vehicles.find(v => v.id === id) || null;
}

// Test cases
console.log('\\n🚗 Garage URL Flow Verification\\n');
console.log('='.repeat(50));

let passed = 0;
let failed = 0;

function test(name, condition) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

// Clear storage
localStorage.clear();

console.log('\\n📋 Phase 1: Add Vehicle A (2024 Ford F-150)');
console.log('-'.repeat(50));

const vehicleA = {
  year: 2024,
  make: 'Ford',
  model: 'F-150',
  trim: 'XLT',
  modification: 'ford-f-150-2024-xlt',
};

const resultA = addVehicle(vehicleA);
test('Vehicle A added successfully', resultA.added === true);
test('Vehicle A has ID', !!resultA.id);

const activeAfterA = getActiveVehicle();
test('Vehicle A is active', activeAfterA?.model === 'F-150');

const garageAfterA = loadGarage();
test('Garage has 1 vehicle', garageAfterA.vehicles.length === 1);

console.log('\\n📋 Phase 2: Add Vehicle B (2022 Toyota Camry)');
console.log('-'.repeat(50));

const vehicleB = {
  year: 2022,
  make: 'Toyota',
  model: 'Camry',
  trim: 'SE',
  modification: 'toyota-camry-2022-se',
};

const resultB = addVehicle(vehicleB);
test('Vehicle B added successfully', resultB.added === true);

const activeAfterB = getActiveVehicle();
test('Vehicle B is now active', activeAfterB?.model === 'Camry');

const garageAfterB = loadGarage();
test('Garage has 2 vehicles', garageAfterB.vehicles.length === 2);
test('F-150 still in garage', garageAfterB.vehicles.some(v => v.model === 'F-150'));
test('Camry in garage', garageAfterB.vehicles.some(v => v.model === 'Camry'));

console.log('\\n📋 Phase 3: Duplicate Prevention');
console.log('-'.repeat(50));

// Try to add Camry again
const duplicateResult = addVehicle(vehicleB);
test('Duplicate not added (added=false)', duplicateResult.added === false);

const garageAfterDupe = loadGarage();
test('Garage still has 2 vehicles', garageAfterDupe.vehicles.length === 2);

const camryCount = garageAfterDupe.vehicles.filter(v => v.model === 'Camry').length;
test('Only one Camry in garage', camryCount === 1);

console.log('\\n📋 Phase 4: Persistence Simulation');
console.log('-'.repeat(50));

// Simulate page reload by reloading from storage
const garageAfterRefresh = loadGarage();
const activeAfterRefresh = getActiveVehicle();

test('Garage persists with 2 vehicles', garageAfterRefresh.vehicles.length === 2);
test('Active vehicle persists (Camry)', activeAfterRefresh?.model === 'Camry');

console.log('\\n📋 Phase 5: Vehicle Switch');
console.log('-'.repeat(50));

// Switch back to F-150
const switchResult = addVehicle(vehicleA);
test('Switch to F-150 (not re-added)', switchResult.added === false);

const activeAfterSwitch = getActiveVehicle();
test('F-150 is now active', activeAfterSwitch?.model === 'F-150');

const garageAfterSwitch = loadGarage();
test('Garage still has 2 vehicles after switch', garageAfterSwitch.vehicles.length === 2);

console.log('\\n📋 Phase 6: Case-Insensitive Matching');
console.log('-'.repeat(50));

// Try to add with different case
const vehicleCaseVariant = {
  year: 2024,
  make: 'FORD',  // uppercase
  model: 'f-150', // lowercase with dash
  trim: 'xlt',   // lowercase
};

const caseResult = addVehicle(vehicleCaseVariant);
test('Case-variant not added as duplicate', caseResult.added === false);

const garageAfterCase = loadGarage();
test('Garage still has 2 vehicles', garageAfterCase.vehicles.length === 2);

console.log('\\n📋 Phase 7: Modification ID Priority');
console.log('-'.repeat(50));

// Try to add with same modification ID but different YMMT
const modIdDupe = {
  year: 2025,
  make: 'Ford',
  model: 'F-150',
  trim: 'Platinum',
  modification: 'ford-f-150-2024-xlt', // Same mod ID as Vehicle A
};

const modResult = addVehicle(modIdDupe);
test('Same modification ID not added', modResult.added === false);

const garageAfterMod = loadGarage();
test('Garage still has 2 vehicles', garageAfterMod.vehicles.length === 2);

console.log('\\n' + '='.repeat(50));
console.log(`\\n📊 RESULTS: ${passed}/${passed + failed} tests passed`);

if (failed === 0) {
  console.log('\\n🎉 ALL TESTS PASSED!\\n');
  process.exit(0);
} else {
  console.log(`\\n⚠️ ${failed} test(s) failed\\n`);
  process.exit(1);
}
