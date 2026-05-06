/**
 * Wheel Fitment Test Suite
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
 * Run wheel fitment test for a vehicle
 */
export async function runWheelTest(vehicle) {
  const result = {
    passed: false,
    wheelCount: 0,
    preFilterCount: 0,
    postFilterCount: 0,
    boltPattern: null,
    boltPatternExpected: vehicle.expectedBolt || null,
    boltPatternMatch: null,
    centerBore: null,
    offsetMin: null,
    offsetMax: null,
    wheelDiameterMin: null,
    wheelDiameterMax: null,
    staggeredDetected: false,
    frontWheelWidth: null,
    rearWheelWidth: null,
    frontOffset: null,
    rearOffset: null,
    suppliers: {},
    errors: [],
    apiResponse: null,
    durationMs: 0,
  };
  
  const startTime = Date.now();
  
  try {
    const url = `${config.baseUrl}/api/wheels/fitment-search?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}&trim=${encodeURIComponent(vehicle.trim || '')}&pageSize=500`;
    
    const data = await fetchJson(url);
    result.apiResponse = data;
    result.durationMs = Date.now() - startTime;
    
    // Extract counts
    const wheels = data.wheels || data.results || [];
    result.wheelCount = wheels.length;
    result.preFilterCount = data.totalBeforeFiltering || data.preFilterCount || wheels.length;
    result.postFilterCount = data.totalCount || wheels.length;
    
    // Extract fitment info
    const fitment = data.fitment || {};
    const profile = fitment.dbProfile || fitment.profile || {};
    const envelope = fitment.envelope || {};
    const staggeredInfo = fitment.staggered || {};
    
    result.boltPattern = profile.boltPattern || envelope.boltPattern || null;
    result.centerBore = profile.hubBore || profile.centerBoreMm || envelope.hubBore || envelope.centerBore || null;
    // Staggered detection - check fitment.staggered.isStaggered first (correct API path)
    result.staggeredDetected = staggeredInfo.isStaggered || data.isStaggered || fitment.isStaggered || false;
    
    // Extract offset range
    if (wheels.length > 0) {
      const offsets = wheels.map(w => w.offset).filter(o => o != null);
      const diameters = wheels.map(w => w.diameter).filter(d => d != null);
      
      if (offsets.length > 0) {
        result.offsetMin = Math.min(...offsets);
        result.offsetMax = Math.max(...offsets);
      }
      
      if (diameters.length > 0) {
        result.wheelDiameterMin = Math.min(...diameters);
        result.wheelDiameterMax = Math.max(...diameters);
      }
      
      // Count by supplier/brand
      for (const wheel of wheels) {
        const supplier = wheel.source || wheel.supplier || 'unknown';
        result.suppliers[supplier] = (result.suppliers[supplier] || 0) + 1;
      }
    }
    
    // Staggered details
    if (result.staggeredDetected) {
      result.frontWheelWidth = fitment.frontWidth || profile.frontWidth || null;
      result.rearWheelWidth = fitment.rearWidth || profile.rearWidth || null;
      result.frontOffset = fitment.frontOffset || null;
      result.rearOffset = fitment.rearOffset || null;
    }
    
    // Validation
    result.boltPatternMatch = vehicle.expectedBolt 
      ? result.boltPattern === vehicle.expectedBolt 
      : null;
    
    // Determine pass/fail
    if (result.wheelCount === 0) {
      result.passed = false;
      result.errors.push('Zero wheels returned');
    } else if (vehicle.expectedBolt && !result.boltPatternMatch) {
      result.passed = false;
      result.errors.push(`Bolt pattern mismatch: expected ${vehicle.expectedBolt}, got ${result.boltPattern}`);
    } else {
      result.passed = true;
    }
    
  } catch (err) {
    result.durationMs = Date.now() - startTime;
    result.errors.push(`API error: ${err.message}`);
  }
  
  return result;
}

export default { runWheelTest };
