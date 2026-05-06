/**
 * QA Worker - Tests a single vehicle
 */

import { runWheelTest } from './test-suites/wheel-test.mjs';
import { runTireTest } from './test-suites/tire-test.mjs';
import { runStaggeredTest } from './test-suites/staggered-test.mjs';
import { runLiftedTest } from './test-suites/lifted-test.mjs';
import { runPackageTest } from './test-suites/package-test.mjs';
import { classifyVehicleFailure, SEVERITY } from './classifiers/failure-classifier.mjs';

/**
 * Format vehicle as string
 */
function formatVehicle(v) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`;
}

/**
 * Test a single vehicle
 */
export async function testVehicle(vehicle) {
  const startTime = Date.now();
  
  const result = {
    vehicle: {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim || null,
      category: vehicle.category || 'unknown',
      isPerformance: vehicle.isPerformance || false,
      isCanary: vehicle.isCanary || false,
    },
    status: 'pass',
    severity: null,
    failureType: null,
    
    wheelResult: null,
    tireResult: null,
    staggeredResult: null,
    liftedResults: [],
    packageResult: null,
    
    errors: [],
    durationMs: 0,
  };
  
  try {
    // 1. Wheel test
    result.wheelResult = await runWheelTest(vehicle);
    
    // 2. Tire test (use a common wheel diameter if available)
    let wheelDiameter = null;
    if (result.wheelResult.wheelDiameterMin) {
      // Pick middle of range
      wheelDiameter = Math.round(
        (result.wheelResult.wheelDiameterMin + result.wheelResult.wheelDiameterMax) / 2
      );
    }
    result.tireResult = await runTireTest(vehicle, wheelDiameter);
    
    // 3. Staggered test (only if vehicle has staggered expectations)
    if (vehicle.isStaggered !== undefined || vehicle.criticalStaggered) {
      result.staggeredResult = await runStaggeredTest(vehicle, result.wheelResult, result.tireResult);
    }
    
    // 4. Lifted tests (only for applicable categories)
    if (vehicle.testLifted || ['half-ton', 'hd', 'midsize', 'jeep', 'bronco', 'suv'].includes(vehicle.category)) {
      result.liftedResults = await runLiftedTest(vehicle);
    }
    
    // 5. Package test
    result.packageResult = await runPackageTest(vehicle, wheelDiameter);
    
    // Aggregate errors
    if (result.wheelResult?.errors?.length) {
      result.errors.push(...result.wheelResult.errors.map(e => `[wheel] ${e}`));
    }
    if (result.tireResult?.errors?.length) {
      result.errors.push(...result.tireResult.errors.map(e => `[tire] ${e}`));
    }
    if (result.staggeredResult?.errors?.length) {
      result.errors.push(...result.staggeredResult.errors.map(e => `[staggered] ${e}`));
    }
    for (const lr of result.liftedResults) {
      if (lr.errors?.length) {
        result.errors.push(...lr.errors.map(e => `[lift-${lr.liftInches}] ${e}`));
      }
    }
    if (result.packageResult?.errors?.length) {
      result.errors.push(...result.packageResult.errors.map(e => `[package] ${e}`));
    }
    
    // Determine overall status
    const allPassed = [
      result.wheelResult?.passed,
      result.tireResult?.passed,
      result.staggeredResult?.passed,
      result.packageResult?.passed,
      ...result.liftedResults.map(lr => lr.passed),
    ].filter(p => p !== undefined && p !== null);
    
    if (allPassed.every(p => p === true)) {
      result.status = 'pass';
    } else if (allPassed.some(p => p === false)) {
      result.status = 'fail';
      
      // Classify the failure
      const classification = classifyVehicleFailure(vehicle, {
        wheelResult: result.wheelResult,
        tireResult: result.tireResult,
        staggeredResult: result.staggeredResult,
        liftedResults: result.liftedResults,
        packageResult: result.packageResult,
      });
      
      result.severity = classification.severity;
      result.failureType = classification.type;
      result.errors.unshift(`[${classification.severity}] ${classification.reason}`);
    } else {
      result.status = 'warning';
      result.severity = SEVERITY.LOW;
    }
    
  } catch (err) {
    result.status = 'fail';
    result.severity = SEVERITY.HIGH;
    result.failureType = 'test_harness';
    result.errors.push(`Test harness error: ${err.message}`);
  }
  
  result.durationMs = Date.now() - startTime;
  
  return result;
}

/**
 * Test multiple vehicles with concurrency control
 */
export async function testVehicles(vehicles, options = {}) {
  const { concurrency = 5, onProgress = null } = options;
  const results = [];
  let completed = 0;
  
  const runBatch = async (batch) => {
    const batchResults = await Promise.all(batch.map(v => testVehicle(v)));
    return batchResults;
  };
  
  // Process in batches
  for (let i = 0; i < vehicles.length; i += concurrency) {
    const batch = vehicles.slice(i, i + concurrency);
    const batchResults = await runBatch(batch);
    results.push(...batchResults);
    
    completed += batch.length;
    if (onProgress) {
      onProgress({
        completed,
        total: vehicles.length,
        percent: Math.round((completed / vehicles.length) * 100),
        lastBatch: batchResults,
      });
    }
  }
  
  return results;
}

export default { testVehicle, testVehicles };
