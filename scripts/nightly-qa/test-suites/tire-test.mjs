/**
 * Tire Search Test Suite
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
  
  // Flotation format: "35x12.50R20" or "35X12.50R20LT"
  const flotationMatch = size.match(/^(\d+(?:\.\d+)?)[xX]/);
  if (flotationMatch) {
    return parseFloat(flotationMatch[1]);
  }
  
  // P-metric format: "275/60R20" or "P275/60R20"
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
 * Run tire search test for a vehicle
 */
export async function runTireTest(vehicle, wheelDiameter = null) {
  const result = {
    passed: false,
    tireCount: 0,
    preFilterCount: 0,
    postFilterCount: 0,
    tireDiameter: null,
    tireDiameterExpected: null,
    tireDiameterValid: null,
    frontTireSize: null,
    rearTireSize: null,
    suppliers: {},
    errors: [],
    apiResponse: null,
    durationMs: 0,
  };
  
  const startTime = Date.now();
  
  try {
    let url = `${config.baseUrl}/api/tires/search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
    
    if (vehicle.trim) {
      url += `&trim=${encodeURIComponent(vehicle.trim)}`;
    }
    
    if (wheelDiameter) {
      url += `&wheelDiameter=${wheelDiameter}`;
    }
    
    url += `&_v=${Date.now()}`;
    
    const data = await fetchJson(url);
    result.apiResponse = data;
    result.durationMs = Date.now() - startTime;
    
    // Extract counts
    const tires = data.tires || data.results || [];
    result.tireCount = tires.length;
    result.preFilterCount = data.totalBeforeFiltering || data.preFilterCount || tires.length;
    result.postFilterCount = data.totalCount || tires.length;
    
    // Extract tire sizes
    if (tires.length > 0) {
      const sizes = tires.map(t => t.size || t.tireSize).filter(Boolean);
      if (sizes.length > 0) {
        result.frontTireSize = sizes[0];
        
        // Calculate typical diameter
        const diameters = sizes.map(parseTireDiameter).filter(d => d != null);
        if (diameters.length > 0) {
          result.tireDiameter = Math.round(diameters.reduce((a, b) => a + b, 0) / diameters.length);
        }
      }
      
      // Count by supplier
      for (const tire of tires) {
        const supplier = tire.source || tire.supplier || 'unknown';
        result.suppliers[supplier] = (result.suppliers[supplier] || 0) + 1;
      }
    }
    
    // Staggered vehicles may have different front/rear
    if (vehicle.isStaggered && tires.length > 0) {
      // Try to find front/rear distinction
      const frontTires = tires.filter(t => t.position === 'front' || t.axle === 'front');
      const rearTires = tires.filter(t => t.position === 'rear' || t.axle === 'rear');
      
      if (frontTires.length > 0) {
        result.frontTireSize = frontTires[0].size || frontTires[0].tireSize;
      }
      if (rearTires.length > 0) {
        result.rearTireSize = rearTires[0].size || rearTires[0].tireSize;
      }
    }
    
    // Validate diameter within expected range
    if (result.tireDiameter && vehicle.category) {
      const bands = config.diameterBands[vehicle.category];
      if (bands && bands[0]) {
        const { min, max } = bands[0];
        result.tireDiameterExpected = `${min}-${max}`;
        result.tireDiameterValid = result.tireDiameter >= min && result.tireDiameter <= max;
      }
    }
    
    // Determine pass/fail
    if (result.tireCount === 0) {
      result.passed = false;
      result.errors.push('Zero tires returned');
    } else if (result.tireDiameterValid === false) {
      result.passed = false;
      result.errors.push(`Tire diameter ${result.tireDiameter}" outside expected range ${result.tireDiameterExpected}"`);
    } else {
      result.passed = true;
    }
    
  } catch (err) {
    result.durationMs = Date.now() - startTime;
    result.errors.push(`API error: ${err.message}`);
  }
  
  return result;
}

export default { runTireTest };
