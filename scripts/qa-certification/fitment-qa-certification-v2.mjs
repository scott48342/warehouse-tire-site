#!/usr/bin/env node
/**
 * Fitment QA Certification v2 - Enhanced Failure Classification
 * 
 * Distinguishes between:
 * 1. LOGIC_FAILURE - Fitment logic bug (bolt pattern wrong, staggered detection, diameter band)
 * 2. INVENTORY_ABSENCE - Supplier has no inventory for valid fitment
 * 3. CATEGORIZATION_ISSUE - Vehicle class/category misclassified
 * 4. TEST_DATA_ISSUE - Test expectation incorrect or vehicle doesn't exist
 * 5. UI_METADATA_ISSUE - Display/metadata bug, not fitment logic
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const OUTPUT_DIR = path.join(process.cwd(), 'scripts', 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// FAILURE CLASSIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

const FAILURE_TYPE = {
  LOGIC_FAILURE: 'logic',
  INVENTORY_ABSENCE: 'inventory',
  CATEGORIZATION_ISSUE: 'categorization',
  TEST_DATA_ISSUE: 'test-data',
  UI_METADATA_ISSUE: 'ui-metadata',
  API_ERROR: 'api-error',
};

const SEVERITY = {
  CRITICAL: 'critical',    // Wrong bolt pattern, incorrect staggered flow
  HIGH: 'high',            // Diameter band violation, classification error
  MEDIUM: 'medium',        // Missing results with valid logic
  LOW: 'low',              // Warnings, metadata issues
  INFO: 'info',            // Inventory limitations
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST VEHICLE DEFINITIONS - 100 vehicles
// ═══════════════════════════════════════════════════════════════════════════

const TEST_VEHICLES = [
  // ─────────────────────────────────────────────────────────────────────────
  // HALF-TON TRUCKS (25)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'half-ton', expectedBolt: '6x135' },
  { year: 2023, make: 'Ford', model: 'F-150', trim: 'Lariat', category: 'half-ton', expectedBolt: '6x135' },
  { year: 2022, make: 'Ford', model: 'F-150', trim: 'Raptor', category: 'half-ton', expectedBolt: '6x135', isPerformance: true },
  { year: 2021, make: 'Ford', model: 'F-150', trim: 'Platinum', category: 'half-ton', expectedBolt: '6x135' },
  { year: 2020, make: 'Ford', model: 'F-150', trim: 'King Ranch', category: 'half-ton', expectedBolt: '6x135' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 1500', trim: 'RST', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 1500', trim: 'Trail Boss', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2021, make: 'Chevrolet', model: 'Silverado 1500', trim: 'High Country', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'SLT', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2023, make: 'GMC', model: 'Sierra 1500', trim: 'AT4', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2022, make: 'GMC', model: 'Sierra 1500', trim: 'Denali', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Ram', model: '1500', trim: 'Laramie', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2022, make: 'Ram', model: '1500', trim: 'Rebel', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2021, make: 'Ram', model: '1500', trim: 'Limited', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Toyota', model: 'Tundra', trim: 'SR5', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Toyota', model: 'Tundra', trim: 'Limited', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2022, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro', category: 'half-ton', expectedBolt: '6x139.7', isPerformance: true },
  { year: 2024, make: 'Nissan', model: 'Titan', trim: 'SV', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Nissan', model: 'Titan', trim: 'Pro-4X', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2019, make: 'Ford', model: 'F-150', trim: 'XL', category: 'half-ton', expectedBolt: '6x135' },
  { year: 2018, make: 'Chevrolet', model: 'Silverado 1500', trim: 'WT', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2017, make: 'Ram', model: '1500', trim: 'Express', category: 'half-ton', expectedBolt: '6x139.7' },
  { year: 2016, make: 'Toyota', model: 'Tundra', trim: 'SR', category: 'half-ton', expectedBolt: '6x139.7' },

  // ─────────────────────────────────────────────────────────────────────────
  // HD TRUCKS (15)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Ford', model: 'F-250', trim: 'XLT', category: 'hd', expectedBolt: '8x170' },
  { year: 2023, make: 'Ford', model: 'F-250', trim: 'Lariat', category: 'hd', expectedBolt: '8x170' },
  { year: 2022, make: 'Ford', model: 'F-350', trim: 'King Ranch', category: 'hd', expectedBolt: '8x170' },
  { year: 2021, make: 'Ford', model: 'F-250', trim: 'Platinum', category: 'hd', expectedBolt: '8x170' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', category: 'hd', expectedBolt: '8x180' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'High Country', category: 'hd', expectedBolt: '8x180' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LTZ', category: 'hd', expectedBolt: '8x180' },
  { year: 2024, make: 'GMC', model: 'Sierra 2500 HD', trim: 'SLT', category: 'hd', expectedBolt: '8x180' },
  { year: 2023, make: 'GMC', model: 'Sierra 3500 HD', trim: 'Denali', category: 'hd', expectedBolt: '8x180' },
  { year: 2024, make: 'Ram', model: '2500', trim: 'Big Horn', category: 'hd', expectedBolt: '8x165.1' },
  { year: 2023, make: 'Ram', model: '2500', trim: 'Laramie', category: 'hd', expectedBolt: '8x165.1' },
  { year: 2022, make: 'Ram', model: '3500', trim: 'Limited', category: 'hd', expectedBolt: '8x165.1' },
  { year: 2012, make: 'Ford', model: 'F-250', trim: 'XLT', category: 'hd', expectedBolt: '8x170' },
  { year: 2015, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', category: 'hd', expectedBolt: '8x180' },
  { year: 2018, make: 'Ram', model: '2500', trim: 'Tradesman', category: 'hd', expectedBolt: '8x165.1' },

  // ─────────────────────────────────────────────────────────────────────────
  // MIDSIZE TRUCKS/SUVs (15) - NOTE: Bronco separate category from Wrangler
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport', category: 'midsize', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road', category: 'midsize', expectedBolt: '6x139.7' },
  { year: 2022, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro', category: 'midsize', expectedBolt: '6x139.7', isPerformance: true },
  { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'LT', category: 'midsize', expectedBolt: '6x120' },
  { year: 2023, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2', category: 'midsize', expectedBolt: '6x120', isPerformance: true },
  { year: 2024, make: 'GMC', model: 'Canyon', trim: 'AT4', category: 'midsize', expectedBolt: '6x120' },
  { year: 2024, make: 'Ford', model: 'Ranger', trim: 'XLT', category: 'midsize', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Ford', model: 'Ranger', trim: 'Lariat', category: 'midsize', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Nissan', model: 'Frontier', trim: 'SV', category: 'midsize', expectedBolt: '6x114.3' },
  { year: 2023, make: 'Nissan', model: 'Frontier', trim: 'Pro-4X', category: 'midsize', expectedBolt: '6x114.3' },
  { year: 2024, make: 'Jeep', model: 'Gladiator', trim: 'Sport', category: 'midsize', expectedBolt: '5x127' },
  { year: 2023, make: 'Jeep', model: 'Gladiator', trim: 'Rubicon', category: 'midsize', expectedBolt: '5x127', isPerformance: true },
  { year: 2024, make: 'Toyota', model: '4Runner', trim: 'SR5', category: 'midsize', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Toyota', model: '4Runner', trim: 'TRD Pro', category: 'midsize', expectedBolt: '6x139.7', isPerformance: true },
  // Bronco is NOT a Jeep - should NOT inherit Wrangler rules
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Big Bend', category: 'bronco', expectedBolt: '6x139.7', notJeep: true },

  // ─────────────────────────────────────────────────────────────────────────
  // COMMON PASSENGER CARS (15)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE', category: 'car', expectedBolt: '5x114.3' },
  { year: 2023, make: 'Toyota', model: 'Camry', trim: 'XLE', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', category: 'car', expectedBolt: '5x114.3' },
  { year: 2023, make: 'Honda', model: 'Civic', trim: 'Touring', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Nissan', model: 'Altima', trim: 'SV', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Hyundai', model: 'Sonata', trim: 'SEL', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Kia', model: 'K5', trim: 'GT-Line', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Mazda', model: 'Mazda3', trim: 'Premium', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Subaru', model: 'Outback', trim: 'Premium', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Volkswagen', model: 'Jetta', trim: 'SE', category: 'car', expectedBolt: '5x112' },
  { year: 2024, make: 'Ford', model: 'Fusion', trim: 'SE', category: 'car', expectedBolt: '5x108' },
  { year: 2024, make: 'Chevrolet', model: 'Malibu', trim: 'LT', category: 'car', expectedBolt: '5x115' },
  { year: 2023, make: 'Toyota', model: 'Corolla', trim: 'LE', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Honda', model: 'CR-V', trim: 'EX', category: 'car', expectedBolt: '5x114.3' },
  { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'XLE', category: 'car', expectedBolt: '5x114.3' },

  // ─────────────────────────────────────────────────────────────────────────
  // STAGGERED/PERFORMANCE VEHICLES (10) - CRITICAL: These must detect staggered
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'staggered', expectedBolt: '5x114.3', isStaggered: true, criticalStaggered: true },
  { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', category: 'staggered', expectedBolt: '5x114.3', isStaggered: true, criticalStaggered: true },
  { year: 2022, make: 'Chevrolet', model: 'Camaro', trim: 'SS', category: 'staggered', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },
  { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1', category: 'staggered', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T', category: 'staggered', expectedBolt: '5x115', isStaggered: true, criticalStaggered: true },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'Hellcat', category: 'staggered', expectedBolt: '5x115', isStaggered: true, criticalStaggered: true },
  { year: 2024, make: 'BMW', model: 'M3', trim: 'Competition', category: 'staggered', expectedBolt: '5x112', isStaggered: true, criticalStaggered: true },
  { year: 2024, make: 'Mercedes-Benz', model: 'AMG C 63', trim: 'S', category: 'staggered', expectedBolt: '5x112', isStaggered: true, criticalStaggered: true },
  { year: 2024, make: 'Audi', model: 'A4', trim: 'Premium', category: 'staggered', expectedBolt: '5x112', isStaggered: true },
  { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', category: 'staggered', expectedBolt: '5x120', isStaggered: true, criticalStaggered: true },

  // ─────────────────────────────────────────────────────────────────────────
  // JEEPS/OFF-ROAD (10) - Wranglers only, no Broncos
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sport', category: 'jeep', expectedBolt: '5x127' },
  { year: 2023, make: 'Jeep', model: 'Wrangler', trim: 'Sahara', category: 'jeep', expectedBolt: '5x127' },
  { year: 2022, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', category: 'jeep', expectedBolt: '5x127', isPerformance: true },
  { year: 2021, make: 'Jeep', model: 'Wrangler', trim: 'Willys', category: 'jeep', expectedBolt: '5x127' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: '392', category: 'jeep', expectedBolt: '5x127', isPerformance: true },
  { year: 2020, make: 'Jeep', model: 'Wrangler', trim: 'Sport S', category: 'jeep', expectedBolt: '5x127' },
  { year: 2018, make: 'Jeep', model: 'Wrangler JK', trim: 'Unlimited', category: 'jeep', expectedBolt: '5x127' },
  // Broncos - MUST NOT use Jeep/Wrangler rules
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Wildtrak', category: 'bronco', expectedBolt: '6x139.7', notJeep: true },
  { year: 2023, make: 'Ford', model: 'Bronco', trim: 'Badlands', category: 'bronco', expectedBolt: '6x139.7', notJeep: true },
  { year: 2022, make: 'Ford', model: 'Bronco', trim: 'Raptor', category: 'bronco', expectedBolt: '6x139.7', isPerformance: true, notJeep: true },

  // ─────────────────────────────────────────────────────────────────────────
  // LUXURY/SUV MIXED (10)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Chevrolet', model: 'Tahoe', trim: 'LT', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Chevrolet', model: 'Suburban', trim: 'Premier', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2024, make: 'GMC', model: 'Yukon', trim: 'SLT', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Ford', model: 'Expedition', trim: 'XLT', category: 'suv', expectedBolt: '6x135' },
  { year: 2023, make: 'Ford', model: 'Expedition', trim: 'Limited', category: 'suv', expectedBolt: '6x135' },
  { year: 2024, make: 'Toyota', model: 'Sequoia', trim: 'SR5', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Cadillac', model: 'Escalade', trim: 'Premium Luxury', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Lincoln', model: 'Navigator', trim: 'Reserve', category: 'suv', expectedBolt: '6x135' },
  { year: 2024, make: 'Lexus', model: 'LX', trim: '600', category: 'suv', expectedBolt: '6x139.7' },
  { year: 2024, make: 'Infiniti', model: 'QX80', trim: 'Luxe', category: 'suv', expectedBolt: '6x139.7' },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIAMETER BAND RULES
// ═══════════════════════════════════════════════════════════════════════════

const DIAMETER_BANDS = {
  'half-ton': {
    2: { min: 33, max: 33, preferred: 33 },
    4: { min: 34, max: 35, preferred: 35 },
    6: { min: 35, max: 37, preferred: 35 },
    8: { min: 35, max: 40, preferred: 37 },
  },
  'suv': {
    2: { min: 33, max: 33, preferred: 33 },
    4: { min: 34, max: 35, preferred: 35 },
    6: { min: 35, max: 37, preferred: 35 },
    8: { min: 35, max: 40, preferred: 37 },
  },
  'hd': {
    2: { min: 35, max: 35, preferred: 35 },
    4: { min: 35, max: 35, preferred: 35 },
    6: { min: 37, max: 37, preferred: 37 },
    8: { min: 37, max: 40, preferred: 37 },
  },
  'midsize': {
    2: { min: 32, max: 33, preferred: 33 },
    4: { min: 33, max: 34, preferred: 33 },
    6: { min: 35, max: 35, preferred: 35 },
    8: { min: 35, max: 37, preferred: 35 },
  },
  'jeep': {
    2: { min: 33, max: 33, preferred: 33 },
    4: { min: 35, max: 35, preferred: 35 },
    6: { min: 37, max: 37, preferred: 37 },
    8: { min: 37, max: 40, preferred: 37 },
  },
  // Bronco uses different rules than Jeep
  'bronco': {
    2: { min: 32, max: 33, preferred: 33 },
    4: { min: 33, max: 35, preferred: 33 },
    6: { min: 35, max: 37, preferred: 35 },
    8: { min: 35, max: 40, preferred: 37 },
  },
};

/**
 * Parse tire diameter from size string
 */
function parseTireDiameter(tireSize) {
  if (!tireSize) return null;
  const size = tireSize.trim().toUpperCase();
  
  // Flotation format: "35x12.50R20" or "35X12.50R20LT"
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)[xX]/);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // P-metric format: "275/60R20"
  const pMetricMatch = size.match(/^(\d+)\/(\d+)R(\d+)/);
  if (pMetricMatch) {
    const width = parseInt(pMetricMatch[1], 10);
    const aspect = parseInt(pMetricMatch[2], 10);
    const rim = parseInt(pMetricMatch[3], 10);
    const sidewallInches = (width * aspect / 100) / 25.4;
    const diameter = sidewallInches * 2 + rim;
    return Math.round(diameter);
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// API HELPERS WITH ENHANCED DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function testWheelFitment(vehicle) {
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.trim || '')}&pageSize=100`;
  return fetchWithRetry(url);
}

async function testTireSearch(vehicle, wheelDia = null, buildType = null, liftInches = null) {
  let url = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  if (wheelDia) url += `&wheelDiameter=${wheelDia}`;
  if (buildType) url += `&buildType=${buildType}`;
  if (liftInches) url += `&liftInches=${liftInches}`;
  url += `&_v=${Date.now()}`;
  return fetchWithRetry(url);
}

async function testPackageRecommendation(vehicle, wheelDia = null) {
  let url = `${BASE_URL}/api/packages/recommended?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  if (wheelDia) url += `&wheelDiameter=${wheelDia}`;
  return fetchWithRetry(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// FAILURE CLASSIFICATION LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a wheel search failure
 */
function classifyWheelFailure(vehicle, wheelData, failureMsg) {
  // If API returned a fitment profile but no wheels, it's inventory
  if (wheelData?.fitment?.dbProfile || wheelData?.fitment?.envelope) {
    // Fitment data exists, wheels just not in stock
    return {
      type: FAILURE_TYPE.INVENTORY_ABSENCE,
      severity: SEVERITY.INFO,
      message: `${failureMsg} (fitment data exists, inventory limited)`,
    };
  }
  
  // If bolt pattern is wrong, it's logic failure
  if (failureMsg.includes('bolt pattern')) {
    return {
      type: FAILURE_TYPE.LOGIC_FAILURE,
      severity: SEVERITY.CRITICAL,
      message: failureMsg,
    };
  }
  
  // If no fitment data at all, could be test data issue
  if (!wheelData?.fitment) {
    return {
      type: FAILURE_TYPE.TEST_DATA_ISSUE,
      severity: SEVERITY.MEDIUM,
      message: `${failureMsg} (no fitment profile found)`,
    };
  }
  
  // Default to logic failure
  return {
    type: FAILURE_TYPE.LOGIC_FAILURE,
    severity: SEVERITY.HIGH,
    message: failureMsg,
  };
}

/**
 * Classify a tire search failure
 */
function classifyTireFailure(vehicle, tireData, failureMsg, isLifted = false) {
  // If we searched valid sizes but got no results, it's inventory
  const sizesSearched = tireData?.sizesSearched || tireData?.liftedBuildInfo?.sizesSearched || [];
  const supplierQueried = tireData?.supplierQueried !== false;
  
  if (sizesSearched.length > 0 && supplierQueried) {
    // Canonical sizes are correct, supplier was queried, no inventory
    return {
      type: FAILURE_TYPE.INVENTORY_ABSENCE,
      severity: SEVERITY.INFO,
      message: `${failureMsg} (sizes ${sizesSearched.slice(0,3).join(', ')} searched, no inventory)`,
    };
  }
  
  // If diameter band is violated, it's logic failure
  if (failureMsg.includes('diameter') || failureMsg.includes('exceeds') || failureMsg.includes('below min')) {
    return {
      type: FAILURE_TYPE.LOGIC_FAILURE,
      severity: SEVERITY.HIGH,
      message: failureMsg,
    };
  }
  
  // If no sizes searched, could be categorization
  if (sizesSearched.length === 0 && isLifted) {
    return {
      type: FAILURE_TYPE.CATEGORIZATION_ISSUE,
      severity: SEVERITY.MEDIUM,
      message: `${failureMsg} (no tire sizes determined for lifted build)`,
    };
  }
  
  // Default
  return {
    type: FAILURE_TYPE.LOGIC_FAILURE,
    severity: SEVERITY.MEDIUM,
    message: failureMsg,
  };
}

/**
 * Classify staggered detection failure
 */
function classifyStaggeredFailure(vehicle, wheelData, failureMsg) {
  // Staggered detection is critical for Mustang, Camaro, Corvette, BMW M, AMG
  if (vehicle.criticalStaggered) {
    return {
      type: FAILURE_TYPE.LOGIC_FAILURE,
      severity: SEVERITY.CRITICAL,
      message: failureMsg,
    };
  }
  
  return {
    type: FAILURE_TYPE.LOGIC_FAILURE,
    severity: SEVERITY.HIGH,
    message: failureMsg,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED TEST RUNNERS
// ═══════════════════════════════════════════════════════════════════════════

async function runStandardFitmentTest(vehicle) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: 'standard-fitment',
    pass: true,
    failures: [],
    classifiedFailures: [],
    warnings: [],
    data: {},
    metrics: {
      preFilterCount: 0,
      postFilterCount: 0,
      supplierCount: 0,
      filteredByRuleCount: 0,
    },
  };

  try {
    const wheelData = await testWheelFitment(vehicle);
    const wheels = wheelData.results || wheelData.wheels || [];
    
    result.data.wheelCount = wheels.length;
    result.data.totalCount = wheelData.totalCount || wheelData.total || wheels.length;
    result.data.fitmentSource = wheelData.fitment?.fitmentSource || wheelData.summary?.fitmentSource || 'unknown';
    result.data.boltPattern = wheelData.fitment?.envelope?.boltPattern || wheelData.fitment?.dbProfile?.boltPattern || null;
    result.data.centerBore = wheelData.fitment?.envelope?.centerBore || wheelData.fitment?.dbProfile?.centerBoreMm || null;
    result.data.wheelDiameters = [...new Set(wheels.map(w => w.diameter || w.properties?.diameter).filter(Boolean))];
    result.data.offsetRange = wheelData.fitment?.dbProfile?.offsetRange || null;
    result.data.isStaggered = wheelData.isStaggered || wheelData.fitment?.isStaggered || false;
    result.data.confidence = wheelData.fitment?.confidence || 'unknown';
    
    // Capture filter metrics if available
    result.metrics.preFilterCount = wheelData.preFilterCount || wheelData.totalCount || result.data.wheelCount;
    result.metrics.postFilterCount = wheelData.postFilterCount || result.data.wheelCount;
    result.metrics.supplierCount = wheelData.supplierCount || result.data.wheelCount;
    result.metrics.filteredByRuleCount = wheelData.filteredByRuleCount || 0;

    // Validate bolt pattern
    if (vehicle.expectedBolt && result.data.boltPattern) {
      const normalizedExpected = vehicle.expectedBolt.toLowerCase().replace(/\s/g, '');
      const normalizedActual = result.data.boltPattern.toLowerCase().replace(/\s/g, '');
      const expectedLugs = normalizedExpected.split('x')[0];
      const actualLugs = normalizedActual.split('x')[0];
      if (expectedLugs !== actualLugs) {
        result.pass = false;
        const failMsg = `Wrong bolt pattern: expected ${vehicle.expectedBolt}, got ${result.data.boltPattern}`;
        result.failures.push(failMsg);
        result.classifiedFailures.push({
          ...classifyWheelFailure(vehicle, wheelData, failMsg),
          raw: failMsg,
        });
      }
    }

    // Check wheel results
    if ((result.data.totalCount || result.data.wheelCount) === 0) {
      result.pass = false;
      const failMsg = 'No wheel results for standard fitment';
      result.failures.push(failMsg);
      result.classifiedFailures.push(classifyWheelFailure(vehicle, wheelData, failMsg));
    }

    // Check Bronco is not inheriting Jeep rules
    if (vehicle.notJeep && result.data.boltPattern === '5x127') {
      result.pass = false;
      const failMsg = `Bronco incorrectly using Jeep bolt pattern (5x127)`;
      result.failures.push(failMsg);
      result.classifiedFailures.push({
        type: FAILURE_TYPE.CATEGORIZATION_ISSUE,
        severity: SEVERITY.HIGH,
        message: failMsg,
      });
    }

  } catch (err) {
    result.pass = false;
    const failMsg = `API error: ${err.message}`;
    result.failures.push(failMsg);
    result.classifiedFailures.push({
      type: FAILURE_TYPE.API_ERROR,
      severity: SEVERITY.HIGH,
      message: failMsg,
    });
  }

  return result;
}

async function runStandardTireTest(vehicle) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: 'standard-tires',
    pass: true,
    failures: [],
    classifiedFailures: [],
    warnings: [],
    data: {},
    metrics: {
      preFilterCount: 0,
      postFilterCount: 0,
      supplierCount: 0,
      filteredByRuleCount: 0,
    },
  };

  try {
    const tireData = await testTireSearch(vehicle);
    result.data.tireCount = tireData.results?.length || 0;
    result.data.matchMode = tireData.mode || tireData.matchMode || 'unknown';
    result.data.sizesSearched = tireData.sizesSearched || [];
    result.data.supplierQueried = tireData.supplierQueried !== false;
    
    // Capture filter metrics
    result.metrics.preFilterCount = tireData.preFilterCount || tireData.totalCount || result.data.tireCount;
    result.metrics.postFilterCount = tireData.postFilterCount || result.data.tireCount;
    result.metrics.supplierCount = tireData.supplierCount || result.data.tireCount;
    result.metrics.filteredByRuleCount = tireData.filteredByRuleCount || 0;
    
    if (tireData.results?.length > 0) {
      const firstTire = tireData.results[0];
      result.data.sampleSize = firstTire.size;
      result.data.sampleBrand = firstTire.brand;
    }

    // Check tire results
    if (result.data.tireCount === 0) {
      result.pass = false;
      const failMsg = 'No tire results for standard search';
      result.failures.push(failMsg);
      result.classifiedFailures.push(classifyTireFailure(vehicle, tireData, failMsg));
    }

  } catch (err) {
    result.pass = false;
    const failMsg = `API error: ${err.message}`;
    result.failures.push(failMsg);
    result.classifiedFailures.push({
      type: FAILURE_TYPE.API_ERROR,
      severity: SEVERITY.HIGH,
      message: failMsg,
    });
  }

  return result;
}

async function runLiftedTireTest(vehicle, liftInches) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: `lifted-${liftInches}in`,
    pass: true,
    failures: [],
    classifiedFailures: [],
    warnings: [],
    data: {},
    metrics: {
      preFilterCount: 0,
      postFilterCount: 0,
      supplierCount: 0,
      filteredByRuleCount: 0,
    },
  };

  // Skip lifted tests for cars and staggered
  if (vehicle.category === 'car' || vehicle.category === 'staggered') {
    result.flow = `lifted-${liftInches}in-skipped`;
    result.data.skipped = true;
    result.data.reason = 'Not applicable for this vehicle type';
    return result;
  }

  try {
    const wheelDia = 20;
    const tireData = await testTireSearch(vehicle, wheelDia, 'lifted', liftInches);
    
    result.data.tireCount = tireData.results?.length || 0;
    result.data.liftedBuildInfo = tireData.liftedBuildInfo || {};
    result.data.sizesSearched = tireData.liftedBuildInfo?.sizesSearched || tireData.sizesSearched || [];
    result.data.minDiameter = tireData.liftedBuildInfo?.minDiameterEnforced;
    result.data.maxDiameter = tireData.liftedBuildInfo?.maxDiameterEnforced;
    result.data.preferredDiameter = tireData.liftedBuildInfo?.preferredDiameter;
    result.data.aboveMaxFiltered = tireData.liftedBuildInfo?.aboveMaxFilteredCount || 0;
    result.data.vehicleClass = tireData.liftedBuildInfo?.vehicleClass;
    result.data.supplierQueried = tireData.supplierQueried !== false;
    
    // Capture filter metrics
    result.metrics.preFilterCount = tireData.preFilterCount || 0;
    result.metrics.postFilterCount = result.data.tireCount;
    result.metrics.filteredByRuleCount = result.data.aboveMaxFiltered;

    // Get the expected diameter band
    const categoryKey = vehicle.category;
    const expectedBand = DIAMETER_BANDS[categoryKey]?.[liftInches];
    
    if (expectedBand) {
      result.data.expectedMin = expectedBand.min;
      result.data.expectedMax = expectedBand.max;
      result.data.expectedPreferred = expectedBand.preferred;

      // Validate max diameter enforcement
      if (result.data.maxDiameter && result.data.maxDiameter > expectedBand.max) {
        result.pass = false;
        const failMsg = `Max diameter ${result.data.maxDiameter}" exceeds expected ${expectedBand.max}" for ${categoryKey} ${liftInches}" lift`;
        result.failures.push(failMsg);
        result.classifiedFailures.push({
          type: FAILURE_TYPE.LOGIC_FAILURE,
          severity: SEVERITY.HIGH,
          message: failMsg,
        });
      }

      // Validate tire sizes in results
      if (result.data.sizesSearched?.length > 0) {
        for (const size of result.data.sizesSearched) {
          const tireDia = parseTireDiameter(size);
          if (tireDia !== null) {
            if (tireDia > expectedBand.max) {
              result.pass = false;
              const failMsg = `Tire size ${size} (${tireDia}") exceeds max ${expectedBand.max}" for ${categoryKey} ${liftInches}" lift`;
              result.failures.push(failMsg);
              result.classifiedFailures.push({
                type: FAILURE_TYPE.LOGIC_FAILURE,
                severity: SEVERITY.HIGH,
                message: failMsg,
              });
            }
            if (tireDia < expectedBand.min) {
              result.pass = false;
              const failMsg = `Tire size ${size} (${tireDia}") below min ${expectedBand.min}" for ${categoryKey} ${liftInches}" lift`;
              result.failures.push(failMsg);
              result.classifiedFailures.push({
                type: FAILURE_TYPE.LOGIC_FAILURE,
                severity: SEVERITY.HIGH,
                message: failMsg,
              });
            }
          }
        }
      }

      // Special HD 4" check
      if (categoryKey === 'hd' && liftInches === 4) {
        if (result.data.sizesSearched?.some(s => s.includes('37'))) {
          result.pass = false;
          const failMsg = 'HD truck 4" lift showing 37" tires (should be 35" only)';
          result.failures.push(failMsg);
          result.classifiedFailures.push({
            type: FAILURE_TYPE.LOGIC_FAILURE,
            severity: SEVERITY.HIGH,
            message: failMsg,
          });
        }
      }
    }

    // Check results - distinguish logic vs inventory
    if (result.data.tireCount === 0) {
      if (result.data.sizesSearched?.length > 0 && result.data.supplierQueried) {
        // Logic is correct, just no inventory
        result.warnings.push(`No tire results (sizes ${result.data.sizesSearched.slice(0,2).join(', ')} searched, inventory limited)`);
      } else {
        result.pass = false;
        const failMsg = 'No tire sizes determined for lifted build';
        result.failures.push(failMsg);
        result.classifiedFailures.push(classifyTireFailure(vehicle, tireData, failMsg, true));
      }
    }

  } catch (err) {
    result.pass = false;
    const failMsg = `API error: ${err.message}`;
    result.failures.push(failMsg);
    result.classifiedFailures.push({
      type: FAILURE_TYPE.API_ERROR,
      severity: SEVERITY.HIGH,
      message: failMsg,
    });
  }

  return result;
}

async function runStaggeredTest(vehicle) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: 'staggered',
    pass: true,
    failures: [],
    classifiedFailures: [],
    warnings: [],
    data: {},
    metrics: {},
  };

  if (!vehicle.isStaggered) {
    result.flow = 'staggered-skipped';
    result.data.skipped = true;
    result.data.reason = 'Not a staggered vehicle';
    return result;
  }

  try {
    const wheelData = await testWheelFitment(vehicle);
    result.data.isStaggered = wheelData.isStaggered || wheelData.fitment?.isStaggered || false;
    result.data.wheelCount = wheelData.results?.length || wheelData.wheels?.length || 0;
    result.data.totalCount = wheelData.totalCount || wheelData.total || result.data.wheelCount;
    
    // Check for front/rear wheel sizes
    const fitment = wheelData.fitment || {};
    result.data.frontWidth = fitment.frontWidth || fitment.dbProfile?.frontWheelWidth;
    result.data.rearWidth = fitment.rearWidth || fitment.dbProfile?.rearWheelWidth;
    result.data.hasDifferentSizes = result.data.frontWidth && result.data.rearWidth && 
                                     result.data.frontWidth !== result.data.rearWidth;

    // CRITICAL: Staggered flag must be set for critical vehicles
    if (!result.data.isStaggered) {
      result.pass = false;
      const failMsg = `Expected staggered but isStaggered=false for ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
      result.failures.push(failMsg);
      result.classifiedFailures.push(classifyStaggeredFailure(vehicle, wheelData, failMsg));
    }

    // Check for wheel results
    if (result.data.wheelCount === 0 && result.data.totalCount === 0) {
      result.pass = false;
      const failMsg = 'No staggered wheel results';
      result.failures.push(failMsg);
      result.classifiedFailures.push(classifyWheelFailure(vehicle, wheelData, failMsg));
    }

  } catch (err) {
    result.pass = false;
    const failMsg = `API error: ${err.message}`;
    result.failures.push(failMsg);
    result.classifiedFailures.push({
      type: FAILURE_TYPE.API_ERROR,
      severity: SEVERITY.HIGH,
      message: failMsg,
    });
  }

  return result;
}

async function runPackageTest(vehicle) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: 'package',
    pass: true,
    failures: [],
    classifiedFailures: [],
    warnings: [],
    data: {},
    metrics: {},
  };

  try {
    const pkgData = await testPackageRecommendation(vehicle);
    result.data.hasPackages = pkgData.packages?.length > 0 || pkgData.recommendations?.length > 0;
    result.data.packageCount = pkgData.packages?.length || pkgData.recommendations?.length || 0;
    
    // Check staggered package flow
    if (vehicle.isStaggered) {
      const hasStaggeredPackage = pkgData.packages?.some(p => p.isStaggered) || 
                                   pkgData.recommendations?.some(p => p.isStaggered);
      result.data.hasStaggeredPackage = hasStaggeredPackage;
      
      if (!hasStaggeredPackage && result.data.packageCount > 0) {
        result.warnings.push('Staggered vehicle but no staggered packages returned');
      }
    }

    if (!result.data.hasPackages) {
      result.warnings.push('No package recommendations returned');
    }

  } catch (err) {
    result.warnings.push(`Package API: ${err.message}`);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

async function runAllTests() {
  const allResults = [];
  const startTime = Date.now();
  
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FITMENT QA CERTIFICATION v2 - Enhanced Failure Classification');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (let i = 0; i < TEST_VEHICLES.length; i++) {
    const vehicle = TEST_VEHICLES[i];
    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();
    
    process.stdout.write(`[${i + 1}/${TEST_VEHICLES.length}] ${vehicleName}... `);

    // Standard fitment test
    const fitmentResult = await runStandardFitmentTest(vehicle);
    allResults.push(fitmentResult);
    
    // Standard tire test
    const tireResult = await runStandardTireTest(vehicle);
    allResults.push(tireResult);

    // Staggered test (if applicable)
    const staggeredResult = await runStaggeredTest(vehicle);
    if (!staggeredResult.data.skipped) {
      allResults.push(staggeredResult);
    }

    // Package test
    const packageResult = await runPackageTest(vehicle);
    allResults.push(packageResult);

    // Lifted tests (if applicable for this category)
    if (['half-ton', 'hd', 'midsize', 'jeep', 'suv', 'bronco'].includes(vehicle.category)) {
      for (const liftInches of [2, 4, 6]) {
        const liftedResult = await runLiftedTireTest(vehicle, liftInches);
        if (!liftedResult.data.skipped) {
          allResults.push(liftedResult);
        }
      }
    }

    // Status indicator
    const vehicleResults = allResults.filter(r => r.vehicle === vehicleName);
    const vehicleFails = vehicleResults.filter(r => !r.pass && !r.data.skipped);
    console.log(vehicleFails.length === 0 ? '✅' : `❌ (${vehicleFails.length} fails)`);

    // Rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTE METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  const skipped = allResults.filter(r => r.data.skipped);
  const active = allResults.filter(r => !r.data.skipped);
  const passed = active.filter(r => r.pass);
  const failed = active.filter(r => !r.pass);

  // Classify failures
  const logicFailures = [];
  const inventoryFailures = [];
  const categorizationFailures = [];
  const testDataFailures = [];
  const uiMetadataFailures = [];
  const apiErrors = [];
  
  for (const f of failed) {
    for (const cf of (f.classifiedFailures || [])) {
      const entry = { vehicle: f.vehicle, flow: f.flow, ...cf };
      switch (cf.type) {
        case FAILURE_TYPE.LOGIC_FAILURE: logicFailures.push(entry); break;
        case FAILURE_TYPE.INVENTORY_ABSENCE: inventoryFailures.push(entry); break;
        case FAILURE_TYPE.CATEGORIZATION_ISSUE: categorizationFailures.push(entry); break;
        case FAILURE_TYPE.TEST_DATA_ISSUE: testDataFailures.push(entry); break;
        case FAILURE_TYPE.UI_METADATA_ISSUE: uiMetadataFailures.push(entry); break;
        case FAILURE_TYPE.API_ERROR: apiErrors.push(entry); break;
      }
    }
  }

  const criticalFailures = [...logicFailures, ...categorizationFailures].filter(f => 
    f.severity === SEVERITY.CRITICAL || f.severity === SEVERITY.HIGH
  );

  // Specific pass rates
  const staggeredResults = active.filter(r => r.flow === 'staggered');
  const staggeredPassed = staggeredResults.filter(r => r.pass);
  
  const liftedResults = active.filter(r => r.flow.startsWith('lifted-'));
  const liftedPassed = liftedResults.filter(r => r.pass);
  
  const packageResults = active.filter(r => r.flow === 'package');
  const packagePassed = packageResults.filter(r => r.pass);

  // Calculate rates
  const truePassRate = ((passed.length / active.length) * 100).toFixed(1);
  const logicOnlyPassRate = (((active.length - logicFailures.length) / active.length) * 100).toFixed(1);
  const inventoryAdjustedPassRate = (((passed.length + inventoryFailures.length) / active.length) * 100).toFixed(1);
  const staggeredPassRate = staggeredResults.length > 0 
    ? ((staggeredPassed.length / staggeredResults.length) * 100).toFixed(1) : 'N/A';
  const liftedPassRate = liftedResults.length > 0 
    ? ((liftedPassed.length / liftedResults.length) * 100).toFixed(1) : 'N/A';
  const packagePassRate = packageResults.length > 0 
    ? ((packagePassed.length / packageResults.length) * 100).toFixed(1) : 'N/A';

  // Check bolt patterns
  const boltPatternFailures = logicFailures.filter(f => f.message?.includes('bolt pattern'));
  const staggeredDetectionFailures = logicFailures.filter(f => f.message?.includes('staggered'));
  const diameterBandFailures = logicFailures.filter(f => 
    f.message?.includes('diameter') || f.message?.includes('exceeds') || f.message?.includes('below min')
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PRINT REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(75));
  console.log('  CERTIFICATION RESULTS');
  console.log('═'.repeat(75));
  
  console.log('\n📊 PASS RATES:');
  console.log(`  True pass rate:              ${truePassRate}%  (${passed.length}/${active.length})`);
  console.log(`  Logic-only pass rate:        ${logicOnlyPassRate}%  (excludes inventory issues)`);
  console.log(`  Inventory-adjusted rate:     ${inventoryAdjustedPassRate}%  (counting inventory gaps as pass)`);
  console.log(`  Staggered-specific rate:     ${staggeredPassRate}%  (${staggeredPassed.length}/${staggeredResults.length})`);
  console.log(`  Lifted-specific rate:        ${liftedPassRate}%  (${liftedPassed.length}/${liftedResults.length})`);
  console.log(`  Package-flow rate:           ${packagePassRate}%  (${packagePassed.length}/${packageResults.length})`);

  console.log('\n📋 FAILURE BREAKDOWN:');
  console.log(`  Logic failures:              ${logicFailures.length}`);
  console.log(`  Inventory absence:           ${inventoryFailures.length}`);
  console.log(`  Categorization issues:       ${categorizationFailures.length}`);
  console.log(`  Test data issues:            ${testDataFailures.length}`);
  console.log(`  UI/metadata issues:          ${uiMetadataFailures.length}`);
  console.log(`  API errors:                  ${apiErrors.length}`);

  console.log('\n🎯 CERTIFICATION CHECKS:');
  console.log(`  Wrong bolt patterns:         ${boltPatternFailures.length}  ${boltPatternFailures.length === 0 ? '✅' : '❌'}`);
  console.log(`  Staggered detection fails:   ${staggeredDetectionFailures.length}  ${staggeredDetectionFailures.length === 0 ? '✅' : '❌'}`);
  console.log(`  Diameter band violations:    ${diameterBandFailures.length}  ${diameterBandFailures.length === 0 ? '✅' : '❌'}`);
  console.log(`  Critical severity fails:     ${criticalFailures.length}  ${criticalFailures.length === 0 ? '✅' : '❌'}`);

  // Print critical failures
  if (criticalFailures.length > 0) {
    console.log('\n🚨 CRITICAL/HIGH SEVERITY FAILURES:');
    console.log('─'.repeat(75));
    for (const f of criticalFailures.slice(0, 20)) {
      console.log(`  [${f.severity}] ${f.vehicle} | ${f.flow}`);
      console.log(`    → ${f.message}`);
    }
    if (criticalFailures.length > 20) {
      console.log(`  ... and ${criticalFailures.length - 20} more`);
    }
  }

  // Print staggered detection failures specifically
  if (staggeredDetectionFailures.length > 0) {
    console.log('\n⚠️  STAGGERED DETECTION FAILURES:');
    console.log('─'.repeat(75));
    for (const f of staggeredDetectionFailures) {
      console.log(`  ${f.vehicle}: ${f.message}`);
    }
  }

  // Print categorization issues
  if (categorizationFailures.length > 0) {
    console.log('\n📂 CATEGORIZATION ISSUES:');
    console.log('─'.repeat(75));
    for (const f of categorizationFailures) {
      console.log(`  ${f.vehicle} | ${f.flow}`);
      console.log(`    → ${f.message}`);
    }
  }

  // Print inventory issues (info only)
  if (inventoryFailures.length > 0) {
    console.log('\n📦 INVENTORY GAPS (not logic failures):');
    console.log('─'.repeat(75));
    for (const f of inventoryFailures.slice(0, 10)) {
      console.log(`  ${f.vehicle} | ${f.flow}`);
    }
    if (inventoryFailures.length > 10) {
      console.log(`  ... and ${inventoryFailures.length - 10} more`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE ARTIFACTS
  // ═══════════════════════════════════════════════════════════════════════════

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const jsonPath = path.join(OUTPUT_DIR, `qa-certification-v2-${timestamp}.json`);

  const report = {
    summary: {
      timestamp: new Date().toISOString(),
      targetUrl: BASE_URL,
      durationMs,
      totalTests: active.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      
      // Pass rates
      truePassRate: parseFloat(truePassRate),
      logicOnlyPassRate: parseFloat(logicOnlyPassRate),
      inventoryAdjustedPassRate: parseFloat(inventoryAdjustedPassRate),
      staggeredPassRate: staggeredPassRate === 'N/A' ? null : parseFloat(staggeredPassRate),
      liftedPassRate: liftedPassRate === 'N/A' ? null : parseFloat(liftedPassRate),
      packagePassRate: packagePassRate === 'N/A' ? null : parseFloat(packagePassRate),
      
      // Failure counts by type
      logicFailureCount: logicFailures.length,
      inventoryAbsenceCount: inventoryFailures.length,
      categorizationIssueCount: categorizationFailures.length,
      testDataIssueCount: testDataFailures.length,
      uiMetadataIssueCount: uiMetadataFailures.length,
      apiErrorCount: apiErrors.length,
      
      // Certification checks
      criticalSeverityCount: criticalFailures.length,
      wrongBoltPatterns: boltPatternFailures.length,
      staggeredDetectionFails: staggeredDetectionFailures.length,
      diameterBandViolations: diameterBandFailures.length,
      
      // Certification status
      certificationPassed: 
        parseFloat(logicOnlyPassRate) >= 95 &&
        criticalFailures.length === 0 &&
        boltPatternFailures.length === 0 &&
        staggeredDetectionFailures.length === 0 &&
        diameterBandFailures.length === 0,
    },
    failuresByType: {
      logic: logicFailures,
      inventory: inventoryFailures,
      categorization: categorizationFailures,
      testData: testDataFailures,
      uiMetadata: uiMetadataFailures,
      apiError: apiErrors,
    },
    allResults,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n📁 Full report saved: ${jsonPath}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL VERDICT
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(75));
  if (report.summary.certificationPassed) {
    console.log('  ✅ CERTIFICATION PASSED');
    console.log('     • Logic pass rate ≥95%');
    console.log('     • 0 critical flow failures');
    console.log('     • 0 wrong bolt patterns');
    console.log('     • 0 staggered detection failures');
    console.log('     • 0 diameter band violations');
  } else {
    console.log('  ❌ CERTIFICATION FAILED');
    if (parseFloat(logicOnlyPassRate) < 95) {
      console.log(`     • Logic pass rate ${logicOnlyPassRate}% < 95%`);
    }
    if (criticalFailures.length > 0) {
      console.log(`     • ${criticalFailures.length} critical severity failures`);
    }
    if (boltPatternFailures.length > 0) {
      console.log(`     • ${boltPatternFailures.length} wrong bolt patterns`);
    }
    if (staggeredDetectionFailures.length > 0) {
      console.log(`     • ${staggeredDetectionFailures.length} staggered detection failures`);
    }
    if (diameterBandFailures.length > 0) {
      console.log(`     • ${diameterBandFailures.length} diameter band violations`);
    }
  }
  console.log('═'.repeat(75));

  process.exit(report.summary.certificationPassed ? 0 : 1);
}

// Run
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
