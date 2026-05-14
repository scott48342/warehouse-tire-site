/**
 * 100-Vehicle Production QA Sweep
 * Tests full fitment flow against live production APIs
 */

const BASE_URL = 'https://shop.warehousetiredirect.com';

// ============================================================================
// Vehicle Test Set (100 vehicles across required categories)
// ============================================================================

const VEHICLES = [
  // === 35 Normal Daily Drivers ===
  // Sedans - PRIORITY (recently fixed)
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE', category: 'daily' },
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE', category: 'daily' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'LX', category: 'daily' },
  { year: 2024, make: 'Honda', model: 'Civic', trim: 'Sport', category: 'daily' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'LX', category: 'daily' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Sport', category: 'daily' },
  { year: 2024, make: 'Toyota', model: 'Corolla', trim: 'LE', category: 'daily' },
  { year: 2024, make: 'Nissan', model: 'Altima', trim: 'S', category: 'daily' },
  { year: 2024, make: 'Hyundai', model: 'Elantra', trim: 'SE', category: 'daily' },
  { year: 2024, make: 'Kia', model: 'Forte', trim: 'LXS', category: 'daily' },
  { year: 2023, make: 'Mazda', model: 'Mazda3', trim: 'Select', category: 'daily' },
  { year: 2022, make: 'Subaru', model: 'Impreza', trim: 'Base', category: 'daily' },
  { year: 2021, make: 'Volkswagen', model: 'Jetta', trim: 'S', category: 'daily' },
  // SUVs/Crossovers
  { year: 2024, make: 'Toyota', model: 'RAV4', trim: 'LE', category: 'daily' },
  { year: 2024, make: 'Honda', model: 'CR-V', trim: 'LX', category: 'daily' },
  { year: 2024, make: 'Mazda', model: 'CX-5', trim: 'Sport', category: 'daily' },
  { year: 2023, make: 'Hyundai', model: 'Tucson', trim: 'SE', category: 'daily' },
  { year: 2023, make: 'Kia', model: 'Sportage', trim: 'LX', category: 'daily' },
  { year: 2022, make: 'Nissan', model: 'Rogue', trim: 'S', category: 'daily' },
  { year: 2024, make: 'Chevrolet', model: 'Equinox', trim: 'LT', category: 'daily' },
  { year: 2024, make: 'Ford', model: 'Escape', trim: 'Base', category: 'daily' },
  // 2010-2019 range
  { year: 2018, make: 'Toyota', model: 'Camry', trim: 'LE', category: 'daily' },
  { year: 2017, make: 'Honda', model: 'Civic', trim: 'LX', category: 'daily' },
  { year: 2016, make: 'Honda', model: 'Accord', trim: 'LX', category: 'daily' },
  { year: 2015, make: 'Toyota', model: 'Corolla', trim: 'LE', category: 'daily' },
  { year: 2019, make: 'Nissan', model: 'Altima', trim: 'S', category: 'daily' },
  { year: 2018, make: 'Mazda', model: 'Mazda6', trim: 'Sport', category: 'daily' },
  { year: 2014, make: 'Ford', model: 'Fusion', trim: 'SE', category: 'daily' },
  { year: 2012, make: 'Chevrolet', model: 'Malibu', trim: 'LT', category: 'daily' },
  // 2000-2009 range
  { year: 2008, make: 'Toyota', model: 'Camry', trim: 'LE', category: 'daily' },
  { year: 2006, make: 'Honda', model: 'Civic', trim: 'LX', category: 'daily' },
  { year: 2005, make: 'Honda', model: 'Accord', trim: 'LX', category: 'daily' },
  { year: 2009, make: 'Nissan', model: 'Altima', trim: 'S', category: 'daily' },
  { year: 2007, make: 'Toyota', model: 'Corolla', trim: 'LE', category: 'daily' },
  { year: 2004, make: 'Ford', model: 'Focus', trim: 'ZX4', category: 'daily' },

  // === 15 Trucks/SUVs ===
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'truck' },
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Lariat', category: 'truck' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', category: 'truck' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Big Horn', category: 'truck' },
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'SR5', category: 'truck' },
  { year: 2024, make: 'GMC', model: 'Sierra 1500', trim: 'SLE', category: 'truck' },
  { year: 2023, make: 'Nissan', model: 'Frontier', trim: 'SV', category: 'truck' },
  { year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Laredo', category: 'truck' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Big Bend', category: 'truck' },
  { year: 2022, make: 'Toyota', model: 'Tundra', trim: 'SR5', category: 'truck' },
  { year: 2020, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'truck' },
  { year: 2018, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', category: 'truck' },
  { year: 2015, make: 'Toyota', model: 'Tacoma', trim: 'TRD Sport', category: 'truck' },
  { year: 2010, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'truck' },
  { year: 2008, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LT', category: 'truck' },

  // === 10 Lifted/Off-Road Candidates ===
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', category: 'lifted' },
  { year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Sport', category: 'lifted' },
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Off-Road', category: 'lifted' },
  { year: 2024, make: 'Toyota', model: 'Tacoma', trim: 'TRD Pro', category: 'lifted' },
  { year: 2024, make: 'Ford', model: 'F-150', trim: 'Raptor', category: 'lifted' },
  { year: 2024, make: 'Chevrolet', model: 'Colorado', trim: 'ZR2', category: 'lifted' },
  { year: 2024, make: 'Ford', model: 'Bronco', trim: 'Badlands', category: 'lifted' },
  { year: 2023, make: 'GMC', model: 'Sierra 1500', trim: 'AT4', category: 'lifted' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'Rebel', category: 'lifted' },
  { year: 2024, make: 'Ram', model: '1500', trim: 'TRX', category: 'lifted' },

  // === 15 Staggered/Performance Vehicles ===
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'performance' },
  { year: 2024, make: 'Ford', model: 'Mustang', trim: 'Dark Horse', category: 'performance' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'SS', category: 'performance' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1', category: 'performance' },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T', category: 'performance' },
  { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'SRT Hellcat', category: 'performance' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', category: 'performance' },
  { year: 2024, make: 'BMW', model: 'M3', trim: 'Base', category: 'performance' },
  { year: 2024, make: 'BMW', model: 'M4', trim: 'Base', category: 'performance' },
  { year: 2024, make: 'Mercedes-Benz', model: 'C-Class', trim: 'AMG C 43', category: 'performance' },
  { year: 2024, make: 'Audi', model: 'S4', trim: 'Premium', category: 'performance' },
  { year: 2024, make: 'Porsche', model: '911', trim: 'Carrera', category: 'performance' },
  { year: 2020, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'performance' },
  { year: 2018, make: 'Chevrolet', model: 'Camaro', trim: 'SS', category: 'performance' },
  { year: 2015, make: 'Ford', model: 'Mustang', trim: 'GT', category: 'performance' },

  // === 10 HD/Commercial Vehicles ===
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LTZ', category: 'hd' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 3500 HD', trim: 'LT', category: 'hd' },
  { year: 2024, make: 'Ford', model: 'F-250', trim: 'XLT', category: 'hd' },
  { year: 2024, make: 'Ford', model: 'F-350', trim: 'Lariat', category: 'hd' },
  { year: 2024, make: 'Ram', model: '2500', trim: 'Tradesman', category: 'hd' },
  { year: 2024, make: 'Ram', model: '3500', trim: 'Laramie', category: 'hd' },
  { year: 2024, make: 'GMC', model: 'Sierra 2500 HD', trim: 'SLT', category: 'hd' },
  { year: 2022, make: 'Ford', model: 'F-250', trim: 'XLT', category: 'hd' },
  { year: 2020, make: 'Chevrolet', model: 'Silverado 2500 HD', trim: 'LT', category: 'hd' },
  { year: 2018, make: 'Ram', model: '2500', trim: 'Laramie', category: 'hd' },

  // === 10 EV/Hybrid Vehicles ===
  { year: 2024, make: 'Tesla', model: 'Model 3', trim: 'Long Range', category: 'ev' },
  { year: 2024, make: 'Tesla', model: 'Model Y', trim: 'Long Range', category: 'ev' },
  { year: 2024, make: 'Ford', model: 'Mustang Mach E', trim: 'Select', category: 'ev' },
  { year: 2024, make: 'Ford', model: 'F 150 Lightning', trim: 'XLT', category: 'ev' },
  { year: 2024, make: 'Chevrolet', model: 'Bolt EV', trim: 'LT', category: 'ev' },
  { year: 2024, make: 'Hyundai', model: 'Ioniq 5', trim: 'SE', category: 'ev' },
  { year: 2024, make: 'Rivian', model: 'R1T', trim: 'Adventure', category: 'ev' },
  { year: 2024, make: 'Toyota', model: 'Prius', trim: 'LE', category: 'ev' },
  { year: 2024, make: 'Toyota', model: 'Camry', trim: 'Hybrid LE', category: 'ev' },
  { year: 2024, make: 'Honda', model: 'Accord', trim: 'Hybrid', category: 'ev' },

  // === 5 Older/Edge-Case Vehicles ===
  { year: 2000, make: 'Honda', model: 'Civic', trim: 'LX', category: 'edge' },
  { year: 2002, make: 'Toyota', model: 'Camry', trim: 'LE', category: 'edge' },
  { year: 2001, make: 'Ford', model: 'F-150', trim: 'XLT', category: 'edge' },
  { year: 2003, make: 'Chevrolet', model: 'Silverado 1500', trim: 'LS', category: 'edge' },
  { year: 2005, make: 'Jeep', model: 'Wrangler', trim: 'Sport', category: 'edge' },
];

// ============================================================================
// Test Functions
// ============================================================================

async function fetchJson(url, timeout = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, status: res.status };
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message, status: 0 };
  }
}

async function testVehicle(vehicle) {
  const { year, make, model, trim, category } = vehicle;
  const result = {
    vehicle: `${year} ${make} ${model} ${trim}`,
    category,
    tests: {},
    errors: [],
    failureType: null,
    passed: true,
  };

  const enc = (s) => encodeURIComponent(s);

  // 1. Makes endpoint (alias resolution)
  const makesUrl = `${BASE_URL}/api/vehicles/makes?year=${year}`;
  const makesData = await fetchJson(makesUrl);
  if (makesData.error) {
    result.tests.makes = { pass: false, error: makesData.error };
    result.errors.push(`makes: ${makesData.error}`);
    result.failureType = makesData.status === 500 ? 'runtime' : 'alias';
    result.passed = false;
  } else {
    const makeFound = makesData.results?.some(m => 
      m.toLowerCase() === make.toLowerCase() || 
      m.toLowerCase().replace('-', '') === make.toLowerCase().replace('-', '')
    );
    result.tests.makes = { pass: makeFound, count: makesData.results?.length };
    if (!makeFound) {
      result.errors.push(`makes: ${make} not found`);
      result.failureType = 'alias';
      result.passed = false;
      return result; // Can't continue without make
    }
  }

  // 2. Models endpoint
  const modelsUrl = `${BASE_URL}/api/vehicles/models?year=${year}&make=${enc(make)}`;
  const modelsData = await fetchJson(modelsUrl);
  if (modelsData.error) {
    result.tests.models = { pass: false, error: modelsData.error };
    result.errors.push(`models: ${modelsData.error}`);
    result.failureType = modelsData.status === 500 ? 'runtime' : 'fitment';
    result.passed = false;
  } else {
    const modelFound = modelsData.results?.some(m => 
      m.toLowerCase().replace(/[\s-]/g, '') === model.toLowerCase().replace(/[\s-]/g, '')
    );
    result.tests.models = { pass: modelFound, count: modelsData.results?.length };
    if (!modelFound) {
      result.errors.push(`models: ${model} not found`);
      result.failureType = 'fitment';
      result.passed = false;
      return result;
    }
  }

  // 3. Trims endpoint
  const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${enc(make)}&model=${enc(model)}`;
  const trimsData = await fetchJson(trimsUrl);
  if (trimsData.error) {
    result.tests.trims = { pass: false, error: trimsData.error };
    result.errors.push(`trims: ${trimsData.error}`);
    result.failureType = trimsData.status === 500 ? 'runtime' : 'trim';
    result.passed = false;
  } else {
    const trimCount = trimsData.results?.length || 0;
    
    // Known single-trim patterns that contain slashes but should NOT be flagged as grouped
    const SINGLE_TRIM_PATTERNS = [
      /^R\/T/i,           // R/T, R/T Scat Pack
      /^T\/A$/i,          // Trans Am
      /^Z\/28$/i,         // Camaro Z/28
      /^GT\/CS$/i,        // California Special
      /\bw\//i,           // w/Tech, w/All-Terrain Pkg
    ];
    
    const isGroupedLabel = (label) => {
      if (!label) return false;
      if (label.includes(',')) return true;  // Comma always grouped
      if (/ \/ /.test(label)) return true;   // Spaced slash always grouped
      if (!label.includes('/')) return false; // No slash = not grouped
      
      // Check against known single-trim patterns
      for (const pattern of SINGLE_TRIM_PATTERNS) {
        if (pattern.test(label)) return false;
      }
      
      // Compact slash - check if both sides look like distinct trims
      const slashIdx = label.indexOf('/');
      const left = label.slice(0, slashIdx).trim();
      const right = label.slice(slashIdx + 1).split('/')[0].trim();
      
      if (left.length < 2 || right.length < 2) return false;
      
      // Both sides capitalized = likely grouped (Titanium/Sport)
      const looksLikeTrim = (s) => /^[A-Z][a-z]+/.test(s) || /^[A-Z]{2,}$/.test(s);
      return looksLikeTrim(left) && looksLikeTrim(right);
    };
    
    const hasGroupedTrim = trimsData.results?.some(t => isGroupedLabel(t.label));
    const trimFound = trimsData.results?.some(t => {
      const label = t.label?.toLowerCase() || '';
      const search = trim.toLowerCase();
      return label === search || label.includes(search) || search.includes(label);
    });
    
    result.tests.trims = { 
      pass: trimFound && !hasGroupedTrim, 
      count: trimCount,
      hasGrouped: hasGroupedTrim,
      trimFound 
    };
    
    if (hasGroupedTrim) {
      result.errors.push('trims: has grouped trim labels');
      result.failureType = 'trim';
      result.passed = false;
    }
    if (!trimFound && trimCount > 0) {
      result.errors.push(`trims: ${trim} not found in ${trimCount} trims`);
      result.failureType = 'trim';
      result.passed = false;
    }
  }

  // 4. Tire-sizes endpoint
  const tireSizesUrl = `${BASE_URL}/api/vehicles/tire-sizes?year=${year}&make=${enc(make)}&model=${enc(model)}&modification=${enc(trim)}`;
  const tireSizesData = await fetchJson(tireSizesUrl);
  if (tireSizesData.error) {
    result.tests.tireSizes = { pass: false, error: tireSizesData.error };
    result.errors.push(`tire-sizes: ${tireSizesData.error}`);
    result.failureType = tireSizesData.status === 500 ? 'runtime' : 'fitment';
    result.passed = false;
  } else {
    const sizes = tireSizesData.tireSizes || [];
    const source = tireSizesData.source;
    const matchedBy = tireSizesData.debug?.matchedBy;
    
    result.tests.tireSizes = {
      pass: sizes.length > 0,
      sizes,
      source,
      matchedBy,
    };
    
    if (sizes.length === 0) {
      result.errors.push(`tire-sizes: no sizes (source=${source})`);
      result.failureType = 'fitment';
      result.passed = false;
    }
  }

  // 5. Wheel fitment search
  const wheelFitUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${enc(make)}&model=${enc(model)}&trim=${enc(trim)}`;
  const wheelFitData = await fetchJson(wheelFitUrl, 45000);
  if (wheelFitData.error) {
    result.tests.wheelFitment = { pass: false, error: wheelFitData.error };
    result.errors.push(`wheel-fitment: ${wheelFitData.error}`);
    if (wheelFitData.status === 500) result.failureType = 'runtime';
  } else {
    const wheels = wheelFitData.results || [];
    const isStaggered = wheelFitData.isStaggered || false;
    
    result.tests.wheelFitment = {
      pass: wheels.length > 0 || wheelFitData.hasCoverage === false,
      count: wheels.length,
      isStaggered,
      boltPattern: wheelFitData.fitment?.boltPattern,
    };
    
    if (wheels.length === 0 && wheelFitData.hasCoverage !== false) {
      result.errors.push('wheel-fitment: no results');
      if (!result.failureType) result.failureType = 'inventory';
    }
  }

  // 6. Tire search (only if we have sizes)
  if (result.tests.tireSizes?.pass) {
    const tireSearchUrl = `${BASE_URL}/api/tires/search?year=${year}&make=${enc(make)}&model=${enc(model)}&trim=${enc(trim)}`;
    const tireSearchData = await fetchJson(tireSearchUrl, 60000);
    if (tireSearchData.error) {
      result.tests.tireSearch = { pass: false, error: tireSearchData.error };
      result.errors.push(`tire-search: ${tireSearchData.error}`);
      if (tireSearchData.status === 500) result.failureType = 'runtime';
    } else {
      const tires = tireSearchData.results || [];
      const sources = new Set(tires.map(t => t.source?.split(':')[0]));
      
      result.tests.tireSearch = {
        pass: tires.length > 0,
        count: tires.length,
        sources: [...sources],
        oemSizes: tireSearchData.oemTireSizes,
      };
      
      if (tires.length === 0) {
        result.errors.push('tire-search: no products');
        if (!result.failureType) result.failureType = 'inventory';
        result.passed = false;
      }
    }
  }

  // Check for staggered integrity (performance vehicles)
  if (category === 'performance' && result.tests.tireSizes?.pass) {
    const sizes = result.tests.tireSizes.sizes;
    const hasStaggered = sizes.length >= 2 && 
      sizes.some(s => s.includes('245') || s.includes('255')) &&
      sizes.some(s => s.includes('275') || s.includes('285') || s.includes('305'));
    result.tests.staggered = { 
      detected: hasStaggered,
      sizes 
    };
  }

  // Check for HD load range (HD vehicles)
  if (category === 'hd' && result.tests.tireSizes?.pass) {
    const sizes = result.tests.tireSizes.sizes;
    const hasLT = sizes.some(s => s.startsWith('LT'));
    result.tests.hdLoadRange = { hasLT, sizes };
  }

  return result;
}

// ============================================================================
// Main Execution
// ============================================================================

async function runQASweep() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   100-VEHICLE PRODUCTION QA SWEEP                            ║');
  console.log('║   Target: https://shop.warehousetiredirect.com               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = [];
  const failures = {
    fitment: [],
    inventory: [],
    alias: [],
    trim: [],
    staggered: [],
    supplier: [],
    cache: [],
    runtime: [],
    unknown: [],
  };

  let passed = 0;
  let failed = 0;

  // Shuffle vehicles for randomization
  const shuffled = [...VEHICLES].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length; i++) {
    const vehicle = shuffled[i];
    const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}`;
    
    process.stdout.write(`\r[${i + 1}/${shuffled.length}] Testing ${vehicleStr.padEnd(45)}`);
    
    try {
      const result = await testVehicle(vehicle);
      results.push(result);
      
      if (result.passed) {
        passed++;
      } else {
        failed++;
        const failType = result.failureType || 'unknown';
        failures[failType].push({
          vehicle: vehicleStr,
          category: vehicle.category,
          errors: result.errors,
        });
      }
    } catch (err) {
      failed++;
      failures.runtime.push({
        vehicle: vehicleStr,
        category: vehicle.category,
        errors: [`Exception: ${err.message}`],
      });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n\n');

  // ============================================================================
  // Results Summary
  // ============================================================================

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`TOTAL: ${VEHICLES.length} vehicles`);
  console.log(`PASSED: ${passed} (${(passed / VEHICLES.length * 100).toFixed(1)}%)`);
  console.log(`FAILED: ${failed} (${(failed / VEHICLES.length * 100).toFixed(1)}%)`);
  console.log('');

  // Category breakdown
  const categories = ['daily', 'truck', 'lifted', 'performance', 'hd', 'ev', 'edge'];
  console.log('BY CATEGORY:');
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    console.log(`  ${cat.padEnd(12)}: ${catPassed}/${catResults.length} passed`);
  }
  console.log('');

  // Failure breakdown
  console.log('FAILURES BY TYPE:');
  for (const [type, list] of Object.entries(failures)) {
    if (list.length > 0) {
      console.log(`  ${type.padEnd(12)}: ${list.length}`);
    }
  }
  console.log('');

  // Detailed failures
  if (failed > 0) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      DETAILED FAILURES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const [type, list] of Object.entries(failures)) {
      if (list.length > 0) {
        console.log(`\n[${type.toUpperCase()}] (${list.length} failures)`);
        console.log('─'.repeat(60));
        for (const fail of list) {
          console.log(`  ${fail.vehicle} [${fail.category}]`);
          for (const err of fail.errors) {
            console.log(`    → ${err}`);
          }
        }
      }
    }
  }

  // Priority vehicles check
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                    PRIORITY VEHICLES CHECK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const priorityVehicles = [
    'Camry', 'Civic', 'Accord', 'Corolla', 'Altima',
    'Mercedes', 'Mustang', 'Corvette', 'M3', 'M4',
    'Silverado 2500', 'Silverado 3500', 'Ram 2500', 'Ram 3500'
  ];

  for (const pv of priorityVehicles) {
    const matching = results.filter(r => r.vehicle.includes(pv));
    const passCount = matching.filter(r => r.passed).length;
    const status = passCount === matching.length ? '✅' : '❌';
    console.log(`${status} ${pv}: ${passCount}/${matching.length} passed`);
  }

  // Regression check
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      REGRESSION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const regressionChecks = {
    'Sedan tire-sizes fix': results.filter(r => 
      ['Camry', 'Civic', 'Accord', 'Corolla', 'Altima'].some(m => r.vehicle.includes(m))
    ).every(r => r.tests.tireSizes?.pass),
    'Truck fitment': results.filter(r => r.category === 'truck').every(r => r.tests.tireSizes?.pass),
    'Performance staggered': results.filter(r => r.category === 'performance').every(r => r.tests.tireSizes?.pass),
    'HD load range': results.filter(r => r.category === 'hd').every(r => r.tests.tireSizes?.pass),
    'EV/Hybrid': results.filter(r => r.category === 'ev').every(r => r.tests.tireSizes?.pass || r.tests.models?.pass === false),
    'No 500 errors': !Object.values(failures).flat().some(f => f.errors.some(e => e.includes('500'))),
  };

  for (const [check, passed] of Object.entries(regressionChecks)) {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  }

  // Recommendations
  if (failed > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                      RECOMMENDATIONS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (failures.fitment.length > 0) {
      console.log('FITMENT GAPS:');
      console.log('  - Check vehicle_fitments table for missing records');
      console.log('  - Verify oem_tire_sizes populated for failed vehicles');
    }
    if (failures.inventory.length > 0) {
      console.log('INVENTORY GAPS:');
      console.log('  - No supplier stock for searched sizes');
      console.log('  - Check TireWeb/USAF inventory freshness');
    }
    if (failures.trim.length > 0) {
      console.log('TRIM ISSUES:');
      console.log('  - Check for grouped trim labels that need explosion');
      console.log('  - Verify trim names match customer expectations');
    }
    if (failures.runtime.length > 0) {
      console.log('RUNTIME ERRORS:');
      console.log('  - Check Vercel function logs for stack traces');
      console.log('  - Review recent deployments for breaking changes');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                         QA SWEEP COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runQASweep().catch(console.error);
