/**
 * Batch 136 Verification - Ram 2500/3500 Vehicles
 * Tests fitment API for each vehicle and records results
 */

import fs from 'fs';

const BATCH_FILE = './batches-overnight/overnight-136-ram.json';
const RESULTS_FILE = './results-overnight/overnight-136-ram.json';
const BASE_URL = 'https://shop.warehousetiredirect.com';

// Read batch
const batch = JSON.parse(fs.readFileSync(BATCH_FILE, 'utf-8'));
console.log(`Processing ${batch.length} vehicles from batch 136 (Ram)`);

const results = [];
let processed = 0;
let verified = 0;
let failed = 0;

// Rate limiting - 500ms between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function verifyVehicle(vehicle) {
  const { id, year, make, model, trim } = vehicle;
  
  try {
    // Call fitment search API
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim || '')}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FitmentVerifier/1.0'
      }
    });
    
    if (!response.ok) {
      return {
        ...vehicle,
        status: 'failed',
        reason: `HTTP ${response.status}: ${response.statusText}`,
        verifiedBoltPattern: null,
        verifiedHubBore: null,
        verifiedWheelSizes: [],
        verifiedTireSizes: [],
        wheelCount: 0,
        isStaggered: false
      };
    }
    
    const data = await response.json();
    
    // Extract fitment info from response
    const wheelCount = data.wheels?.length || 0;
    const isStaggered = data.isStaggered || false;
    const boltPattern = data.fitment?.boltPattern || data.boltPattern || null;
    const hubBore = data.fitment?.hubBore || data.hubBore || null;
    
    // Extract wheel sizes from results
    const wheelSizes = [];
    if (data.wheels?.length > 0) {
      const sizes = new Set();
      for (const wheel of data.wheels.slice(0, 20)) { // Sample first 20
        const size = `${wheel.width}x${wheel.diameter}`;
        if (!sizes.has(size)) {
          sizes.add(size);
          wheelSizes.push({
            width: wheel.width,
            diameter: wheel.diameter,
            offset: wheel.offset
          });
        }
      }
    }
    
    // Get tire sizes if available
    const tireSizes = data.fitment?.tireSizes || data.tireSizes || [];
    
    return {
      ...vehicle,
      status: 'verified',
      reason: null,
      verifiedBoltPattern: boltPattern,
      verifiedHubBore: hubBore,
      verifiedWheelSizes: wheelSizes,
      verifiedTireSizes: Array.isArray(tireSizes) ? tireSizes : [],
      wheelCount,
      isStaggered
    };
    
  } catch (err) {
    return {
      ...vehicle,
      status: 'failed',
      reason: err.message,
      verifiedBoltPattern: null,
      verifiedHubBore: null,
      verifiedWheelSizes: [],
      verifiedTireSizes: [],
      wheelCount: 0,
      isStaggered: false
    };
  }
}

// Process all vehicles
async function processAll() {
  const startTime = Date.now();
  
  for (const vehicle of batch) {
    const result = await verifyVehicle(vehicle);
    results.push(result);
    
    processed++;
    if (result.status === 'verified') {
      verified++;
    } else {
      failed++;
    }
    
    // Progress every 10 vehicles
    if (processed % 10 === 0 || processed === batch.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${processed}/${batch.length}] Verified: ${verified}, Failed: ${failed} (${elapsed}s)`);
    }
    
    // Save intermediate results every 20 vehicles
    if (processed % 20 === 0) {
      fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    }
    
    // Rate limit
    await delay(300);
  }
  
  // Save final results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== COMPLETE ===`);
  console.log(`Total: ${processed} vehicles`);
  console.log(`Verified: ${verified}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time: ${totalTime}s`);
  console.log(`Results saved to: ${RESULTS_FILE}`);
}

processAll().catch(console.error);
