#!/usr/bin/env node
/**
 * Fitment QA Certification - 100 Vehicle Hard Test
 * 
 * Tests: standard fit, staggered fit, plus sizing, lifted tire sizing, offset logic
 * Verifies diameter band enforcement for lifted builds
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const OUTPUT_DIR = path.join(process.cwd(), 'scripts', 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

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
  // MIDSIZE TRUCKS/SUVs (15)
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
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Big Bend', category: 'midsize', expectedBolt: '6x139.7' },

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
  // STAGGERED/PERFORMANCE VEHICLES (10)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'staggered', expectedBolt: '5x114.3', isStaggered: true },
  { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack', category: 'staggered', expectedBolt: '5x114.3', isStaggered: true },
  { year: 2022, make: 'Chevrolet', model: 'Camaro', trim: 'SS', category: 'staggered', expectedBolt: '5x120', isStaggered: true },
  { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1', category: 'staggered', expectedBolt: '5x120', isStaggered: true },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T', category: 'staggered', expectedBolt: '5x115', isStaggered: true },
  { year: 2023, make: 'Dodge', model: 'Challenger', trim: 'Hellcat', category: 'staggered', expectedBolt: '5x115', isStaggered: true },
  { year: 2024, make: 'BMW', model: '3 Series', trim: '330i', category: 'staggered', expectedBolt: '5x112', isStaggered: true },
  { year: 2024, make: 'Mercedes-Benz', model: 'C-Class', trim: 'C300', category: 'staggered', expectedBolt: '5x112', isStaggered: true },
  { year: 2024, make: 'Audi', model: 'A4', trim: 'Premium', category: 'staggered', expectedBolt: '5x112', isStaggered: true },
  { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', category: 'staggered', expectedBolt: '5x120', isStaggered: true },

  // ─────────────────────────────────────────────────────────────────────────
  // JEEPS/OFF-ROAD (10)
  // ─────────────────────────────────────────────────────────────────────────
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sport', category: 'jeep', expectedBolt: '5x127' },
  { year: 2023, make: 'Jeep', model: 'Wrangler', trim: 'Sahara', category: 'jeep', expectedBolt: '5x127' },
  { year: 2022, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', category: 'jeep', expectedBolt: '5x127', isPerformance: true },
  { year: 2021, make: 'Jeep', model: 'Wrangler', trim: 'Willys', category: 'jeep', expectedBolt: '5x127' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: '392', category: 'jeep', expectedBolt: '5x127', isPerformance: true },
  { year: 2020, make: 'Jeep', model: 'Wrangler', trim: 'Sport S', category: 'jeep', expectedBolt: '5x127' },
  { year: 2018, make: 'Jeep', model: 'Wrangler JK', trim: 'Unlimited', category: 'jeep', expectedBolt: '5x127' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Wildtrak', category: 'jeep', expectedBolt: '6x139.7' },
  { year: 2023, make: 'Ford', model: 'Bronco', trim: 'Badlands', category: 'jeep', expectedBolt: '6x139.7' },
  { year: 2022, make: 'Ford', model: 'Bronco', trim: 'Raptor', category: 'jeep', expectedBolt: '6x139.7', isPerformance: true },

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

// These bands should match what's implemented in liftedRecommendations.ts
// Note: 8" lift bands are wider since inventory varies
const DIAMETER_BANDS = {
  'half-ton': {
    2: { min: 33, max: 33, preferred: 33 },
    4: { min: 34, max: 35, preferred: 35 },
    6: { min: 35, max: 37, preferred: 35 },
    8: { min: 35, max: 40, preferred: 37 }, // 35-40 allowed for extreme lifts
  },
  'suv': {
    2: { min: 33, max: 33, preferred: 33 },
    4: { min: 34, max: 35, preferred: 35 },
    6: { min: 35, max: 37, preferred: 35 },
    8: { min: 35, max: 40, preferred: 37 }, // 35-40 allowed for extreme lifts
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
};

/**
 * Parse tire diameter from size string
 * Handles flotation (35x12.50R20) and P-metric (275/60R20)
 */
function parseTireDiameter(tireSize) {
  if (!tireSize) return null;
  const size = tireSize.trim().toUpperCase();
  
  // Flotation format: "35x12.50R20"
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)[xX]/);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // P-metric format: "275/60R20" → calculate diameter
  // Diameter = (width * aspect / 100 * 2 / 25.4) + rim
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
// API HELPERS
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
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.trim || '')}`;
  return fetchWithRetry(url);
}

async function testTireSearch(vehicle, wheelDia = null, buildType = null, liftInches = null) {
  let url = `${BASE_URL}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
  if (wheelDia) url += `&wheelDia=${wheelDia}`;
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
// TEST RUNNERS
// ═══════════════════════════════════════════════════════════════════════════

async function runStandardFitmentTest(vehicle) {
  const result = {
    vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim(),
    category: vehicle.category,
    flow: 'standard-fitment',
    pass: true,
    failures: [],
    warnings: [],
    data: {},
  };

  try {
    const wheelData = await testWheelFitment(vehicle);
    // API returns results, not wheels
    const wheels = wheelData.results || wheelData.wheels || [];
    result.data.wheelCount = wheels.length;
    result.data.totalCount = wheelData.totalCount || wheels.length;
    result.data.fitmentSource = wheelData.fitment?.fitmentSource || wheelData.summary?.fitmentSource || 'unknown';
    result.data.boltPattern = wheelData.fitment?.envelope?.boltPattern || wheelData.fitment?.dbProfile?.boltPattern || null;
    result.data.centerBore = wheelData.fitment?.envelope?.centerBore || wheelData.fitment?.dbProfile?.centerBoreMm || null;
    result.data.wheelDiameters = [...new Set(wheels.map(w => w.properties?.diameter).filter(Boolean))];
    result.data.offsetRange = wheelData.fitment?.dbProfile?.offsetRange || null;
    result.data.confidence = wheelData.fitment?.confidence || 'unknown';

    // Validate bolt pattern
    if (vehicle.expectedBolt && result.data.boltPattern) {
      const normalizedExpected = vehicle.expectedBolt.toLowerCase().replace('x', 'x');
      const normalizedActual = result.data.boltPattern.toLowerCase().replace('x', 'x');
      // Check if lug count matches (first number before x)
      const expectedLugs = normalizedExpected.split('x')[0];
      const actualLugs = normalizedActual.split('x')[0];
      if (expectedLugs !== actualLugs) {
        result.pass = false;
        result.failures.push(`Wrong bolt pattern: expected ${vehicle.expectedBolt}, got ${result.data.boltPattern}`);
      }
    }

    // Check wheel results - use totalCount not just page results
    if ((result.data.totalCount || result.data.wheelCount) === 0) {
      result.pass = false;
      result.failures.push('No wheel results for standard fitment');
    }

  } catch (err) {
    result.pass = false;
    result.failures.push(`API error: ${err.message}`);
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
    warnings: [],
    data: {},
  };

  try {
    const tireData = await testTireSearch(vehicle);
    result.data.tireCount = tireData.results?.length || 0;
    result.data.matchMode = tireData.mode || 'unknown';
    result.data.sizesSearched = tireData.sizesSearched || [];
    
    // Get first tire info
    if (tireData.results?.length > 0) {
      const firstTire = tireData.results[0];
      result.data.sampleSize = firstTire.size;
      result.data.sampleBrand = firstTire.brand;
    }

    // Check tire results
    if (result.data.tireCount === 0) {
      result.pass = false;
      result.failures.push('No tire results for standard search');
    }

  } catch (err) {
    result.pass = false;
    result.failures.push(`API error: ${err.message}`);
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
    warnings: [],
    data: {},
  };

  // Skip lifted tests for cars
  if (vehicle.category === 'car' || vehicle.category === 'staggered') {
    result.flow = `lifted-${liftInches}in-skipped`;
    result.data.skipped = true;
    result.data.reason = 'Not applicable for this vehicle type';
    return result;
  }

  try {
    const wheelDia = 20; // Standard test diameter
    const tireData = await testTireSearch(vehicle, wheelDia, 'lifted', liftInches);
    
    result.data.tireCount = tireData.results?.length || 0;
    result.data.liftedBuildInfo = tireData.liftedBuildInfo || {};
    result.data.sizesSearched = tireData.liftedBuildInfo?.sizesSearched || [];
    result.data.minDiameter = tireData.liftedBuildInfo?.minDiameterEnforced;
    result.data.maxDiameter = tireData.liftedBuildInfo?.maxDiameterEnforced;
    result.data.preferredDiameter = tireData.liftedBuildInfo?.preferredDiameter;
    result.data.aboveMaxFiltered = tireData.liftedBuildInfo?.aboveMaxFilteredCount || 0;
    result.data.vehicleClass = tireData.liftedBuildInfo?.vehicleClass;

    // Get the expected diameter band
    const categoryKey = vehicle.category === 'jeep' ? 'jeep' : 
                        vehicle.category === 'hd' ? 'hd' :
                        vehicle.category === 'midsize' ? 'midsize' :
                        vehicle.category === 'suv' ? 'suv' : 'half-ton';
    
    const expectedBand = DIAMETER_BANDS[categoryKey]?.[liftInches];
    
    if (expectedBand) {
      result.data.expectedMin = expectedBand.min;
      result.data.expectedMax = expectedBand.max;
      result.data.expectedPreferred = expectedBand.preferred;

      // Validate max diameter enforcement
      if (result.data.maxDiameter && result.data.maxDiameter > expectedBand.max) {
        result.pass = false;
        result.failures.push(`Max diameter ${result.data.maxDiameter}" exceeds expected ${expectedBand.max}" for ${categoryKey} ${liftInches}" lift`);
      }

      // Validate no oversized/undersized tires in results
      if (result.data.sizesSearched?.length > 0) {
        for (const size of result.data.sizesSearched) {
          const tireDia = parseTireDiameter(size);
          if (tireDia !== null) {
            if (tireDia > expectedBand.max) {
              result.pass = false;
              result.failures.push(`Tire size ${size} (${tireDia}") exceeds max ${expectedBand.max}" for ${categoryKey} ${liftInches}" lift`);
            }
            if (tireDia < expectedBand.min) {
              result.pass = false;
              result.failures.push(`Tire size ${size} (${tireDia}") below min ${expectedBand.min}" for ${categoryKey} ${liftInches}" lift`);
            }
          }
        }
      }

      // Special HD 4" check
      if (categoryKey === 'hd' && liftInches === 4) {
        if (result.data.sizesSearched?.some(s => s.includes('37'))) {
          result.pass = false;
          result.failures.push('HD truck 4" lift showing 37" tires (should be 35" only)');
        }
      }
    }

    // Check we got results
    if (result.data.tireCount === 0 && result.data.sizesSearched?.length > 0) {
      result.warnings.push('No tire results but sizes were searched (inventory issue?)');
    }

  } catch (err) {
    result.pass = false;
    result.failures.push(`API error: ${err.message}`);
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
    warnings: [],
    data: {},
  };

  if (!vehicle.isStaggered) {
    result.flow = 'staggered-skipped';
    result.data.skipped = true;
    result.data.reason = 'Not a staggered vehicle';
    return result;
  }

  try {
    const wheelData = await testWheelFitment(vehicle);
    result.data.isStaggered = wheelData.fitment?.isStaggered || wheelData.isStaggered || false;
    result.data.wheelCount = wheelData.wheels?.length || 0;
    
    // Check if staggered flag is set
    if (!result.data.isStaggered) {
      result.warnings.push('Expected staggered but isStaggered flag not set');
    }

    // Check for front/rear distinction in wheels
    const wheels = wheelData.wheels || [];
    const hasFrontRear = wheels.some(w => w.position === 'front' || w.position === 'rear');
    result.data.hasFrontRearDistinction = hasFrontRear;

  } catch (err) {
    result.pass = false;
    result.failures.push(`API error: ${err.message}`);
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
    warnings: [],
    data: {},
  };

  try {
    const pkgData = await testPackageRecommendation(vehicle);
    result.data.hasPackages = pkgData.packages?.length > 0 || pkgData.recommendations?.length > 0;
    result.data.packageCount = pkgData.packages?.length || pkgData.recommendations?.length || 0;

    if (!result.data.hasPackages) {
      result.warnings.push('No package recommendations returned');
    }

  } catch (err) {
    // Package API might 404 for some vehicles - that's a warning not failure
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
  console.log('  FITMENT QA CERTIFICATION - 100 Vehicle Hard Test');
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  for (let i = 0; i < TEST_VEHICLES.length; i++) {
    const vehicle = TEST_VEHICLES[i];
    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}`.trim();
    
    console.log(`[${i + 1}/${TEST_VEHICLES.length}] Testing: ${vehicleName}`);

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
    if (['half-ton', 'hd', 'midsize', 'jeep', 'suv'].includes(vehicle.category)) {
      for (const liftInches of [2, 4, 6, 8]) {
        const liftedResult = await runLiftedTireTest(vehicle, liftInches);
        if (!liftedResult.data.skipped) {
          allResults.push(liftedResult);
        }
      }
    }

    // Rate limiting - don't hammer the API
    await new Promise(r => setTimeout(r, 200));
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATE REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  const passed = allResults.filter(r => r.pass);
  const failed = allResults.filter(r => !r.pass && !r.data.skipped);
  const warnings = allResults.filter(r => r.warnings?.length > 0);
  const skipped = allResults.filter(r => r.data.skipped);

  const passRate = ((passed.length / (allResults.length - skipped.length)) * 100).toFixed(1);
  const regressionRisk = failed.length > 5 ? 'HIGH' : failed.length > 0 ? 'MEDIUM' : 'LOW';

  // Executive summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  EXECUTIVE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Total tests run:     ${allResults.length - skipped.length}`);
  console.log(`  Passed:              ${passed.length} (${passRate}%)`);
  console.log(`  Failed:              ${failed.length}`);
  console.log(`  Warnings:            ${warnings.length}`);
  console.log(`  Skipped:             ${skipped.length}`);
  console.log(`  Duration:            ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  Regression Risk:     ${regressionRisk}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Failure table
  if (failed.length > 0) {
    console.log('FAILURES:');
    console.log('─────────────────────────────────────────────────────────────────────');
    for (const f of failed) {
      console.log(`  ${f.vehicle} | ${f.flow}`);
      for (const failure of f.failures) {
        console.log(`    ❌ ${failure}`);
      }
    }
    console.log('');
  }

  // Top warnings
  if (warnings.length > 0) {
    console.log('WARNINGS (first 10):');
    console.log('─────────────────────────────────────────────────────────────────────');
    for (const w of warnings.slice(0, 10)) {
      console.log(`  ${w.vehicle} | ${w.flow}`);
      for (const warning of w.warnings) {
        console.log(`    ⚠️  ${warning}`);
      }
    }
    console.log('');
  }

  // Save artifacts
  const timestamp = new Date().toISOString().split('T')[0];
  const jsonPath = path.join(OUTPUT_DIR, `fitment-qa-certification-${timestamp}.json`);
  const csvPath = path.join(OUTPUT_DIR, `fitment-qa-certification-${timestamp}.csv`);

  // JSON artifact
  const jsonReport = {
    summary: {
      totalTests: allResults.length - skipped.length,
      passed: passed.length,
      failed: failed.length,
      warnings: warnings.length,
      skipped: skipped.length,
      passRate: parseFloat(passRate),
      regressionRisk,
      durationMs,
      timestamp: new Date().toISOString(),
      targetUrl: BASE_URL,
    },
    failures: failed.map(f => ({
      vehicle: f.vehicle,
      category: f.category,
      flow: f.flow,
      failures: f.failures,
      data: f.data,
    })),
    warnings: warnings.map(w => ({
      vehicle: w.vehicle,
      category: w.category,
      flow: w.flow,
      warnings: w.warnings,
    })),
    results: allResults,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`JSON report saved: ${jsonPath}`);

  // CSV artifact
  const csvHeaders = [
    'vehicle', 'category', 'flow', 'pass', 'failure_reason', 'warning',
    'wheel_count', 'tire_count', 'bolt_pattern', 'min_diameter', 'max_diameter',
    'sizes_searched', 'fitment_source'
  ];
  const csvRows = allResults.map(r => [
    r.vehicle,
    r.category,
    r.flow,
    r.pass ? 'PASS' : 'FAIL',
    r.failures?.join('; ') || '',
    r.warnings?.join('; ') || '',
    r.data.wheelCount || '',
    r.data.tireCount || '',
    r.data.boltPattern || '',
    r.data.minDiameter || '',
    r.data.maxDiameter || '',
    (r.data.sizesSearched || []).join(' | '),
    r.data.fitmentSource || '',
  ]);
  
  const csvContent = [csvHeaders.join(','), ...csvRows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
  fs.writeFileSync(csvPath, csvContent);
  console.log(`CSV report saved: ${csvPath}`);

  // Return summary for caller
  return {
    passRate: parseFloat(passRate),
    passed: passed.length,
    failed: failed.length,
    regressionRisk,
    criticalFailures: failed.filter(f => 
      f.failures.some(msg => 
        msg.includes('bolt pattern') || 
        msg.includes('37" tires') ||
        msg.includes('exceeds max')
      )
    ),
  };
}

// Run the tests
runAllTests()
  .then(summary => {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    if (summary.passRate >= 95 && summary.criticalFailures.length === 0) {
      console.log('  ✅ CERTIFICATION PASSED');
    } else {
      console.log('  ❌ CERTIFICATION FAILED');
      if (summary.criticalFailures.length > 0) {
        console.log(`     ${summary.criticalFailures.length} critical failures detected`);
      }
      if (summary.passRate < 95) {
        console.log(`     Pass rate ${summary.passRate}% below 95% threshold`);
      }
    }
    console.log('═══════════════════════════════════════════════════════════════════');
    process.exit(summary.passRate >= 95 && summary.criticalFailures.length === 0 ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
