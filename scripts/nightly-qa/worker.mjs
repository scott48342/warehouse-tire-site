/**
 * QA Worker - Tests a single vehicle
 * 
 * Scoring Model:
 * - PASS: Core logic tests pass (wheel fitment valid, staggered correct)
 * - WARNING: Logic passes but inventory/data gaps exist
 * - FAIL: Logic failures (wrong bolt pattern, staggered mismatch, etc.)
 */

import { runWheelTest } from './test-suites/wheel-test.mjs';
import { runTireTest } from './test-suites/tire-test.mjs';
import { runStaggeredTest } from './test-suites/staggered-test.mjs';
import { runLiftedTest } from './test-suites/lifted-test.mjs';
import { runPackageTest } from './test-suites/package-test.mjs';
import { classifyVehicleFailure, SEVERITY, FAILURE_TYPE } from './classifiers/failure-classifier.mjs';

// Known data gaps - vehicles without complete fitment data in our DB
const KNOWN_DATA_GAPS = [
  { make: 'Chevrolet', model: 'Camaro', trim: '1LE' },
  { make: 'Dodge', model: 'Challenger', trim: 'Widebody' },
  { make: 'Dodge', model: 'Challenger', trim: 'R/T' },
  { make: 'BMW', model: 'M3' },
  { make: 'BMW', model: 'M4' },
  { make: 'Mercedes-Benz', model: 'AMG C 63' },
  { make: 'Audi', model: 'RS5' },
  { make: 'Audi', model: 'RS6' },
  { make: 'Porsche', model: '911' },
];

/**
 * Check if vehicle is a known data gap
 */
function isKnownDataGap(vehicle) {
  return KNOWN_DATA_GAPS.some(gap => {
    const makeMatch = gap.make === vehicle.make;
    const modelMatch = gap.model === vehicle.model;
    const trimMatch = !gap.trim || gap.trim === vehicle.trim;
    return makeMatch && modelMatch && trimMatch;
  });
}

/**
 * Format vehicle as string
 */
function formatVehicle(v) {
  return `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ''}`;
}

/**
 * Determine if a failure is a LOGIC failure vs inventory/data gap
 */
function isLogicFailure(result) {
  // Logic failures that MUST be counted:
  // 1. Bolt pattern mismatch (when we have expected and actual differs)
  if (result.wheelResult?.boltPatternMatch === false) {
    return true;
  }
  
  // 2. Staggered mismatch on a critical staggered vehicle (when API returned data)
  if (result.staggeredResult?.staggeredMismatch && 
      result.wheelResult?.wheelCount > 0) {
    return true;
  }
  
  // 3. Lifted diameter band violation (when we have tires)
  const liftedLogicFail = result.liftedResults?.some(lr => 
    lr.inBand === false && lr.tireCount > 0
  );
  if (liftedLogicFail) {
    return true;
  }
  
  return false;
}

/**
 * Determine if failure is inventory/supplier issue (not logic)
 */
function isInventoryIssue(result) {
  // Zero wheels but API didn't error - inventory gap
  if (result.wheelResult?.wheelCount === 0 && 
      result.wheelResult?.apiResponse && 
      !result.wheelResult?.apiResponse?.error) {
    return true;
  }
  
  // Zero tires but API didn't error - inventory gap
  if (result.tireResult?.tireCount === 0 && 
      result.tireResult?.apiResponse && 
      !result.tireResult?.apiResponse?.error) {
    return true;
  }
  
  return false;
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
    status: 'pass',        // pass | warning | fail
    logicStatus: 'pass',   // Separate logic-only status
    severity: null,
    failureType: null,
    isKnownGap: false,
    
    wheelResult: null,
    tireResult: null,
    staggeredResult: null,
    liftedResults: [],
    packageResult: null,
    
    errors: [],
    warnings: [],
    durationMs: 0,
  };
  
  // Check if this is a known data gap
  result.isKnownGap = isKnownDataGap(vehicle);
  
  try {
    // 1. Wheel test
    result.wheelResult = await runWheelTest(vehicle);
    
    // 2. Tire test (use a common wheel diameter if available)
    let wheelDiameter = null;
    if (result.wheelResult.wheelDiameterMin) {
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
    
    // Collect errors and warnings separately
    if (result.wheelResult?.errors?.length) {
      result.errors.push(...result.wheelResult.errors.map(e => `[wheel] ${e}`));
    }
    if (result.tireResult?.errors?.length) {
      // Zero tires is a warning, not error (unless logic failed)
      if (result.tireResult.tireCount === 0) {
        result.warnings.push('[tire] No tires in inventory for this fitment');
      } else {
        result.errors.push(...result.tireResult.errors.map(e => `[tire] ${e}`));
      }
    }
    if (result.staggeredResult?.errors?.length) {
      result.errors.push(...result.staggeredResult.errors.map(e => `[staggered] ${e}`));
    }
    for (const lr of result.liftedResults) {
      if (lr.errors?.length) {
        // Lifted with zero results is warning, not error
        if (lr.wheelCount === 0 || lr.tireCount === 0) {
          result.warnings.push(`[lift-${lr.liftInches}] Limited inventory for this lift height`);
        } else {
          result.errors.push(...lr.errors.map(e => `[lift-${lr.liftInches}] ${e}`));
        }
      }
    }
    if (result.packageResult?.errors?.length) {
      // Package not viable is a warning unless core tests failed
      result.warnings.push(...result.packageResult.errors.map(e => `[package] ${e}`));
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // NEW SCORING MODEL
    // ═══════════════════════════════════════════════════════════════════
    
    // Check for LOGIC failures first
    const hasLogicFailure = isLogicFailure(result);
    const hasInventoryIssue = isInventoryIssue(result);
    const hasNoData = result.wheelResult?.wheelCount === 0 && 
                      result.wheelResult?.boltPattern === null;
    
    if (hasLogicFailure) {
      // Real logic failure - this is a FAIL
      result.status = 'fail';
      result.logicStatus = 'fail';
      
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
      
    } else if (hasNoData && result.isKnownGap) {
      // Known data gap - WARNING, not fail
      result.status = 'warning';
      result.logicStatus = 'pass';  // Logic didn't fail, data just missing
      result.severity = SEVERITY.INFO;
      result.failureType = FAILURE_TYPE.DATA_GAP;
      result.warnings.unshift('[info] Known data gap - fitment data not yet imported');
      
    } else if (hasNoData) {
      // Unknown data gap - still a problem but not logic
      result.status = 'warning';
      result.logicStatus = 'pass';
      result.severity = SEVERITY.MEDIUM;
      result.failureType = FAILURE_TYPE.DATA_GAP;
      result.warnings.unshift('[medium] Missing fitment data for this vehicle');
      
    } else if (hasInventoryIssue) {
      // Inventory gap - WARNING
      result.status = 'warning';
      result.logicStatus = 'pass';
      result.severity = SEVERITY.LOW;
      result.failureType = FAILURE_TYPE.INVENTORY;
      result.warnings.unshift('[low] Limited inventory for this fitment');
      
    } else if (result.wheelResult?.passed && 
               (result.staggeredResult === null || result.staggeredResult.passed)) {
      // Core tests passed
      result.status = 'pass';
      result.logicStatus = 'pass';
      
    } else {
      // Some non-critical issue
      result.status = 'warning';
      result.logicStatus = 'pass';
      result.severity = SEVERITY.LOW;
    }
    
  } catch (err) {
    result.status = 'fail';
    result.logicStatus = 'fail';
    result.severity = SEVERITY.HIGH;
    result.failureType = FAILURE_TYPE.TEST_HARNESS;
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
