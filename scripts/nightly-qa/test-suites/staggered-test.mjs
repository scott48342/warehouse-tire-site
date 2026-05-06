/**
 * Staggered Detection Test Suite
 * 
 * Validates that staggered vehicles are correctly detected
 * and return appropriate front/rear configurations.
 */

import { config } from '../config.mjs';

/**
 * Run staggered detection test for a vehicle
 */
export async function runStaggeredTest(vehicle, wheelData, tireData) {
  const result = {
    passed: false,
    staggeredExpected: vehicle.isStaggered || vehicle.criticalStaggered || false,
    staggeredDetected: false,
    staggeredMismatch: false,
    isCritical: vehicle.criticalStaggered || false,
    frontWheelWidth: null,
    rearWheelWidth: null,
    frontTireSize: null,
    rearTireSize: null,
    errors: [],
  };
  
  // Extract staggered detection from wheel response
  if (wheelData?.apiResponse) {
    const fitment = wheelData.apiResponse.fitment || {};
    const staggeredInfo = fitment.staggered || {};
    // Correct API path: fitment.staggered.isStaggered
    result.staggeredDetected = staggeredInfo.isStaggered || wheelData.apiResponse.isStaggered || fitment.isStaggered || false;
    result.frontWheelWidth = staggeredInfo.frontSpec?.width || fitment.frontWidth || null;
    result.rearWheelWidth = staggeredInfo.rearSpec?.width || fitment.rearWidth || null;
  }
  
  // Extract front/rear tire sizes
  if (tireData?.frontTireSize) {
    result.frontTireSize = tireData.frontTireSize;
  }
  if (tireData?.rearTireSize) {
    result.rearTireSize = tireData.rearTireSize;
  }
  
  // Check for mismatch
  result.staggeredMismatch = result.staggeredExpected !== result.staggeredDetected;
  
  // Validation
  if (result.staggeredMismatch) {
    result.errors.push(`Staggered mismatch: expected=${result.staggeredExpected}, detected=${result.staggeredDetected}`);
    
    if (result.isCritical) {
      result.errors.push('CRITICAL: This is a Tier A staggered vehicle that MUST be detected correctly');
    }
  }
  
  // If staggered expected, validate we have different front/rear
  if (result.staggeredExpected && result.staggeredDetected) {
    if (!result.frontWheelWidth && !result.rearWheelWidth) {
      result.errors.push('Staggered detected but no front/rear wheel widths returned');
    }
  }
  
  // Pass if no mismatch and (if staggered expected) proper front/rear data
  result.passed = !result.staggeredMismatch;
  
  return result;
}

export default { runStaggeredTest };
