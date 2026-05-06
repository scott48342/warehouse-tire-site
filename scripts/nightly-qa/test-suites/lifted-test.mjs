/**
 * Lifted Build Test Suite
 * 
 * Tests lifted builds across multiple lift heights (2", 4", 6", 8")
 */

import { config } from '../config.mjs';

/**
 * Fetch JSON with timeout and retry
 */
async function fetchJson(url, retries = config.retryCount) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.testTimeout);
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, config.retryDelay * (i + 1)));
    }
  }
}

/**
 * Parse tire diameter from size string
 */
function parseTireDiameter(tireSize) {
  if (!tireSize) return null;
  const size = String(tireSize).trim().toUpperCase();
  
  // Flotation format: "35x12.50R20" 
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)[xX]/);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // P-metric format: "275/60R20"
  const pMetricMatch = size.match(/^[P]?(\d+)\/(\d+)R(\d+)/);
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

/**
 * Map lift inches to build type
 */
function getBuildType(liftInches) {
  if (liftInches === 2) return 'leveled';
  if (liftInches === 4) return 'offroad';
  if (liftInches === 6) return 'extreme';
  if (liftInches === 8) return 'extreme-8';
  return 'lifted';
}

/**
 * Run lifted build tests for a vehicle
 */
export async function runLiftedTest(vehicle, liftHeights = config.liftHeights) {
  const results = [];
  
  // Only test lifted-applicable vehicles
  const liftableCategories = ['half-ton', 'hd', 'midsize', 'jeep', 'bronco', 'suv'];
  if (!liftableCategories.includes(vehicle.category)) {
    return results;
  }
  
  // Use vehicle's configured lift heights if available
  const heights = vehicle.liftHeights || liftHeights;
  
  for (const liftInches of heights) {
    const result = {
      liftInches,
      passed: false,
      wheelCount: 0,
      tireCount: 0,
      tireDiameter: null,
      expectedBand: null,
      inBand: null,
      errors: [],
      wheelResponse: null,
      tireResponse: null,
      durationMs: 0,
    };
    
    const startTime = Date.now();
    
    try {
      const buildType = getBuildType(liftInches);
      
      // Test wheel search with lift
      const wheelUrl = `${config.baseUrl}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.trim || '')}&liftInches=${liftInches}&pageSize=100`;
      
      const wheelData = await fetchJson(wheelUrl);
      result.wheelResponse = wheelData;
      
      const wheels = wheelData.wheels || wheelData.results || [];
      result.wheelCount = wheels.length;
      
      // Get a common wheel diameter for tire search
      let wheelDiameter = 20;
      if (wheels.length > 0) {
        const diameters = wheels.map(w => w.diameter).filter(d => d != null);
        if (diameters.length > 0) {
          // Pick most common diameter
          const counts = {};
          for (const d of diameters) {
            counts[d] = (counts[d] || 0) + 1;
          }
          wheelDiameter = parseInt(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0], 10);
        }
      }
      
      // Test tire search with lift
      const tireUrl = `${config.baseUrl}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&wheelDiameter=${wheelDiameter}&liftInches=${liftInches}&buildType=${buildType}&_v=${Date.now()}`;
      
      const tireData = await fetchJson(tireUrl);
      result.tireResponse = tireData;
      
      const tires = tireData.tires || tireData.results || [];
      result.tireCount = tires.length;
      
      // Calculate tire diameter
      if (tires.length > 0) {
        const diameters = tires.map(t => parseTireDiameter(t.size || t.tireSize)).filter(d => d != null);
        if (diameters.length > 0) {
          result.tireDiameter = Math.round(diameters.reduce((a, b) => a + b, 0) / diameters.length);
        }
      }
      
      // Check diameter band compliance
      const bands = config.diameterBands[vehicle.category];
      if (bands && bands[liftInches]) {
        const { min, max } = bands[liftInches];
        result.expectedBand = `${min}-${max}`;
        
        if (result.tireDiameter) {
          result.inBand = result.tireDiameter >= min && result.tireDiameter <= max;
        }
      }
      
      result.durationMs = Date.now() - startTime;
      
      // Determine pass/fail
      if (result.wheelCount === 0) {
        result.errors.push(`Zero wheels for ${liftInches}" lift`);
      }
      if (result.tireCount === 0) {
        result.errors.push(`Zero tires for ${liftInches}" lift`);
      }
      if (result.inBand === false) {
        result.errors.push(`Tire diameter ${result.tireDiameter}" outside expected band ${result.expectedBand}" for ${liftInches}" lift`);
      }
      
      result.passed = result.wheelCount > 0 && result.tireCount > 0 && result.inBand !== false;
      
    } catch (err) {
      result.durationMs = Date.now() - startTime;
      result.errors.push(`Lift test error: ${err.message}`);
    }
    
    results.push(result);
  }
  
  return results;
}

export default { runLiftedTest };
