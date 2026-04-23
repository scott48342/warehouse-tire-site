/**
 * Batch 127 Verification Script
 * Verifies GMC Sierra 3500HD fitments against live API
 */

import fs from 'fs';

const BATCH_FILE = './batches-overnight/overnight-127-gmc.json';
const RESULTS_FILE = './results-overnight/overnight-127-gmc.json';
const BASE_URL = 'https://shop.warehousetiredirect.com';

// Load batch
const vehicles = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));
console.log(`Loaded ${vehicles.length} vehicles from batch 127`);

const results = {
  batch: 'overnight-127-gmc',
  timestamp: new Date().toISOString(),
  totalVehicles: vehicles.length,
  passed: 0,
  failed: 0,
  errors: 0,
  vehicles: []
};

// Process vehicles
for (let i = 0; i < vehicles.length; i++) {
  const v = vehicles[i];
  const vehicleKey = `${v.year} ${v.make} ${v.model} ${v.trim}`;
  console.log(`[${i + 1}/${vehicles.length}] Testing ${vehicleKey}...`);
  
  const result = {
    id: v.id,
    year: v.year,
    make: v.make,
    model: v.model,
    trim: v.trim,
    expected: {
      boltPattern: v.currentBoltPattern,
      hubBore: v.currentHubBore,
      wheelSizes: v.currentWheelSizes,
      tireSizes: v.currentTireSizes
    },
    actual: null,
    status: 'pending',
    issues: [],
    wheelCount: 0
  };
  
  try {
    // Call the fitment search API
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}&limit=1`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      result.status = 'error';
      result.issues.push(`API error: ${response.status} - ${data.error || 'Unknown'}`);
      results.errors++;
    } else if (!data.fitment || !data.fitment.envelope) {
      result.status = 'failed';
      result.issues.push('No fitment data returned');
      results.failed++;
    } else {
      // Extract fitment data from correct API response structure
      const envelope = data.fitment.envelope;
      const dbProfile = data.fitment.dbProfile;
      
      result.actual = {
        boltPattern: envelope.boltPattern,
        centerBore: envelope.centerBore,
        oemDiameters: envelope.oem?.diameter || [],
        oemWheelSizes: dbProfile?.oemWheelSizes || [],
        totalWheels: data.totalCount || 0
      };
      result.wheelCount = data.totalCount || 0;
      
      // Validate bolt pattern (normalize case for comparison)
      const expectedBP = v.currentBoltPattern?.toLowerCase();
      const actualBP = envelope.boltPattern?.toLowerCase();
      if (actualBP !== expectedBP) {
        result.issues.push(`Bolt pattern mismatch: expected ${v.currentBoltPattern}, got ${envelope.boltPattern}`);
      }
      
      // Validate hub bore (center bore) - allow small tolerance
      const expectedHB = parseFloat(v.currentHubBore);
      const actualHB = parseFloat(envelope.centerBore);
      if (Math.abs(actualHB - expectedHB) > 1) {
        result.issues.push(`Hub bore mismatch: expected ${v.currentHubBore}, got ${envelope.centerBore}`);
      }
      
      // Check wheel diameters from OEM specs
      const expectedDiameters = v.currentWheelSizes.map(ws => 
        typeof ws === 'object' ? ws.diameter : parseInt(ws.match(/\d+$/)?.[0] || '0')
      ).filter(d => d > 0);
      
      const actualDiameters = envelope.oem?.diameter || [];
      const actualDiameterRange = actualDiameters.length === 2 ? 
        Array.from({length: actualDiameters[1] - actualDiameters[0] + 1}, (_, i) => actualDiameters[0] + i) :
        actualDiameters;
      
      const missingDiameters = expectedDiameters.filter(d => !actualDiameterRange.includes(d));
      if (missingDiameters.length > 0) {
        result.issues.push(`Missing wheel diameters: ${[...new Set(missingDiameters)].join(', ')} (API range: ${actualDiameters.join('-')})`);
      }
      
      // Check wheel count - should have results
      if (data.totalCount === 0) {
        result.issues.push('No wheels found for this vehicle');
      }
      
      // Determine pass/fail
      if (result.issues.length === 0) {
        result.status = 'passed';
        results.passed++;
      } else {
        result.status = 'failed';
        results.failed++;
      }
    }
  } catch (err) {
    result.status = 'error';
    result.issues.push(`Fetch error: ${err.message}`);
    results.errors++;
  }
  
  results.vehicles.push(result);
  
  // Rate limiting - 100ms between requests
  await new Promise(r => setTimeout(r, 100));
}

// Summary
console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`Total: ${results.totalVehicles}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Errors: ${results.errors}`);

// Show sample failures if any
const failures = results.vehicles.filter(v => v.status === 'failed').slice(0, 5);
if (failures.length > 0) {
  console.log('\nSample failures:');
  failures.forEach(f => {
    console.log(`  ${f.year} ${f.make} ${f.model} ${f.trim}: ${f.issues.join('; ')}`);
  });
}

// Save results
fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
console.log(`\nResults saved to ${RESULTS_FILE}`);
