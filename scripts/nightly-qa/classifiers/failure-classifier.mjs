/**
 * Failure Classifier
 * 
 * Categorizes test failures by type and severity.
 * 
 * Failure Types:
 * - logic: Fitment logic bug (bolt pattern, staggered detection, diameter band)
 * - inventory: Valid fitment but no inventory
 * - supplier: Supplier API/feed issue
 * - data_gap: Missing fitment data in database
 * - test_harness: Test expectation incorrect
 * - regression: Previously passing, now failing
 */

export const FAILURE_TYPE = {
  LOGIC: 'logic',
  INVENTORY: 'inventory',
  SUPPLIER: 'supplier',
  DATA_GAP: 'data_gap',
  TEST_HARNESS: 'test_harness',
  REGRESSION: 'regression',
};

export const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
};

/**
 * Classify a wheel test failure
 */
export function classifyWheelFailure(vehicle, wheelResult) {
  const errors = wheelResult.errors || [];
  const hasApiResponse = wheelResult.apiResponse != null;
  const hasProfile = wheelResult.apiResponse?.fitment?.dbProfile || 
                     wheelResult.apiResponse?.fitment?.profile;
  
  // Bolt pattern mismatch is always a critical logic failure
  if (wheelResult.boltPatternMatch === false) {
    return {
      type: FAILURE_TYPE.LOGIC,
      severity: SEVERITY.CRITICAL,
      reason: `Bolt pattern mismatch: expected ${vehicle.expectedBolt}, got ${wheelResult.boltPattern}`,
    };
  }
  
  // Zero wheels
  if (wheelResult.wheelCount === 0) {
    // If we have a fitment profile but no wheels, it's likely inventory
    if (hasProfile) {
      return {
        type: FAILURE_TYPE.INVENTORY,
        severity: SEVERITY.MEDIUM,
        reason: 'Fitment profile exists but no wheels in inventory',
      };
    }
    
    // No profile at all - data gap
    if (hasApiResponse && !hasProfile) {
      return {
        type: FAILURE_TYPE.DATA_GAP,
        severity: SEVERITY.HIGH,
        reason: 'No fitment profile found for vehicle',
      };
    }
    
    // API error
    if (!hasApiResponse) {
      return {
        type: FAILURE_TYPE.SUPPLIER,
        severity: SEVERITY.MEDIUM,
        reason: 'API request failed',
      };
    }
  }
  
  // Generic failure
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.MEDIUM,
    reason: errors.join('; ') || 'Unknown wheel test failure',
  };
}

/**
 * Classify a tire test failure
 */
export function classifyTireFailure(vehicle, tireResult) {
  const errors = tireResult.errors || [];
  
  // Diameter out of band
  if (tireResult.tireDiameterValid === false) {
    return {
      type: FAILURE_TYPE.LOGIC,
      severity: SEVERITY.HIGH,
      reason: `Tire diameter ${tireResult.tireDiameter}" outside expected range ${tireResult.tireDiameterExpected}"`,
    };
  }
  
  // Zero tires
  if (tireResult.tireCount === 0) {
    // Check supplier breakdown - if we have API response, likely inventory
    if (tireResult.apiResponse && !tireResult.apiResponse.error) {
      return {
        type: FAILURE_TYPE.INVENTORY,
        severity: SEVERITY.MEDIUM,
        reason: 'No tires available for this fitment',
      };
    }
    
    return {
      type: FAILURE_TYPE.SUPPLIER,
      severity: SEVERITY.MEDIUM,
      reason: 'Tire search returned no results',
    };
  }
  
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.MEDIUM,
    reason: errors.join('; ') || 'Unknown tire test failure',
  };
}

/**
 * Classify a staggered test failure
 */
export function classifyStaggeredFailure(vehicle, staggeredResult) {
  if (staggeredResult.staggeredMismatch) {
    // Critical if this is a Tier A staggered vehicle
    const severity = staggeredResult.isCritical ? SEVERITY.CRITICAL : SEVERITY.HIGH;
    
    if (staggeredResult.staggeredExpected && !staggeredResult.staggeredDetected) {
      return {
        type: FAILURE_TYPE.LOGIC,
        severity,
        reason: `Staggered vehicle not detected as staggered (expected=true, detected=false)`,
      };
    }
    
    if (!staggeredResult.staggeredExpected && staggeredResult.staggeredDetected) {
      return {
        type: FAILURE_TYPE.LOGIC,
        severity: SEVERITY.HIGH,
        reason: `Non-staggered vehicle incorrectly detected as staggered`,
      };
    }
  }
  
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.MEDIUM,
    reason: staggeredResult.errors?.join('; ') || 'Unknown staggered test failure',
  };
}

/**
 * Classify a lifted test failure
 */
export function classifyLiftedFailure(vehicle, liftResult) {
  const errors = liftResult.errors || [];
  
  // Diameter band violation
  if (liftResult.inBand === false) {
    return {
      type: FAILURE_TYPE.LOGIC,
      severity: SEVERITY.HIGH,
      reason: `Lifted tire diameter ${liftResult.tireDiameter}" outside band ${liftResult.expectedBand}" for ${liftResult.liftInches}" lift`,
    };
  }
  
  // Zero results
  if (liftResult.wheelCount === 0 || liftResult.tireCount === 0) {
    return {
      type: FAILURE_TYPE.INVENTORY,
      severity: SEVERITY.MEDIUM,
      reason: `No ${liftResult.wheelCount === 0 ? 'wheels' : 'tires'} for ${liftResult.liftInches}" lift`,
    };
  }
  
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.MEDIUM,
    reason: errors.join('; ') || 'Unknown lifted test failure',
  };
}

/**
 * Classify a package test failure
 */
export function classifyPackageFailure(vehicle, packageResult) {
  if (!packageResult.viable) {
    return {
      type: FAILURE_TYPE.INVENTORY,
      severity: SEVERITY.LOW,
      reason: 'Package not viable - missing wheel or tire options',
    };
  }
  
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.LOW,
    reason: packageResult.errors?.join('; ') || 'Unknown package test failure',
  };
}

/**
 * Classify overall vehicle result
 */
export function classifyVehicleFailure(vehicle, results) {
  const { wheelResult, tireResult, staggeredResult, liftedResults, packageResult } = results;
  
  // Priority order for failure classification
  // 1. Staggered mismatch (if critical)
  if (staggeredResult && !staggeredResult.passed && staggeredResult.isCritical) {
    return classifyStaggeredFailure(vehicle, staggeredResult);
  }
  
  // 2. Bolt pattern mismatch
  if (wheelResult && wheelResult.boltPatternMatch === false) {
    return classifyWheelFailure(vehicle, wheelResult);
  }
  
  // 3. Regular staggered mismatch
  if (staggeredResult && !staggeredResult.passed) {
    return classifyStaggeredFailure(vehicle, staggeredResult);
  }
  
  // 4. Wheel failure
  if (wheelResult && !wheelResult.passed) {
    return classifyWheelFailure(vehicle, wheelResult);
  }
  
  // 5. Tire failure
  if (tireResult && !tireResult.passed) {
    return classifyTireFailure(vehicle, tireResult);
  }
  
  // 6. Lifted failures
  if (liftedResults && liftedResults.length > 0) {
    const failedLifts = liftedResults.filter(r => !r.passed);
    if (failedLifts.length > 0) {
      return classifyLiftedFailure(vehicle, failedLifts[0]);
    }
  }
  
  // 7. Package failure (lowest priority)
  if (packageResult && !packageResult.passed) {
    return classifyPackageFailure(vehicle, packageResult);
  }
  
  // Shouldn't get here if called correctly
  return {
    type: FAILURE_TYPE.LOGIC,
    severity: SEVERITY.LOW,
    reason: 'Unknown failure',
  };
}

export default {
  FAILURE_TYPE,
  SEVERITY,
  classifyWheelFailure,
  classifyTireFailure,
  classifyStaggeredFailure,
  classifyLiftedFailure,
  classifyPackageFailure,
  classifyVehicleFailure,
};
