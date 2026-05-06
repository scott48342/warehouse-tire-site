/**
 * Package Flow Test Suite
 * 
 * Tests the viability of wheel+tire package recommendations.
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
 * Run package flow test for a vehicle
 */
export async function runPackageTest(vehicle, wheelDiameter = null) {
  const result = {
    passed: false,
    viable: false,
    wheelCount: 0,
    tireCount: 0,
    errors: [],
    apiResponse: null,
    durationMs: 0,
  };
  
  const startTime = Date.now();
  
  try {
    // Build package recommendation URL
    let url = `${config.baseUrl}/api/packages/recommended?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`;
    
    if (vehicle.trim) {
      url += `&trim=${encodeURIComponent(vehicle.trim)}`;
    }
    
    if (wheelDiameter) {
      url += `&wheelDiameter=${wheelDiameter}`;
    }
    
    const data = await fetchJson(url);
    result.apiResponse = data;
    result.durationMs = Date.now() - startTime;
    
    // Extract package info
    if (data.packages || data.recommendations) {
      const packages = data.packages || data.recommendations || [];
      
      if (packages.length > 0) {
        const pkg = packages[0];
        result.wheelCount = pkg.wheelOptions || pkg.wheels?.length || 0;
        result.tireCount = pkg.tireOptions || pkg.tires?.length || 0;
        result.viable = result.wheelCount > 0 && result.tireCount > 0;
      }
    } else if (data.wheelCount !== undefined && data.tireCount !== undefined) {
      // Alternative response format
      result.wheelCount = data.wheelCount;
      result.tireCount = data.tireCount;
      result.viable = result.wheelCount > 0 && result.tireCount > 0;
    } else {
      // Fallback - check if we have any data suggesting viability
      result.viable = data.viable !== false && !data.error;
    }
    
    // Determine pass/fail
    if (!result.viable) {
      result.errors.push('Package flow not viable: missing wheels or tires');
    }
    
    result.passed = result.viable;
    
  } catch (err) {
    result.durationMs = Date.now() - startTime;
    result.errors.push(`Package test error: ${err.message}`);
  }
  
  return result;
}

export default { runPackageTest };
