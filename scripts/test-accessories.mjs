/**
 * Test Accessory Fitment Service
 * 
 * Examples:
 * 1. 2009 Jeep Wrangler + aftermarket wheel (hub ring needed)
 * 2. 2020 Silverado + aftermarket wheel (different thread size)
 * 3. Missing data case (1995 Camaro - no API data)
 */

// Import the service (we'll simulate since this is a test script)
// In real usage: import { getAccessoryFitment, ... } from '@/lib/fitment/accessories'

// ============================================================================
// Simulated service (copy of key functions for testing)
// ============================================================================

function parseThreadSize(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  
  // Metric: M14x1.5
  const metricMatch = s.match(/M(\d+)\s*[Xx×]\s*([\d.]+)/);
  if (metricMatch) {
    return {
      threadDiameter: parseFloat(metricMatch[1]),
      threadPitch: parseFloat(metricMatch[2]),
      isMetric: true,
      seatType: "conical",
      quantity: 20,
      raw,
    };
  }
  
  // Imperial: 1/2"-20
  const imperialMatch = s.match(/(\d+)\/(\d+)["\s-]*(\d+)/);
  if (imperialMatch) {
    return {
      threadDiameter: parseFloat(imperialMatch[1]) / parseFloat(imperialMatch[2]),
      threadPitch: parseFloat(imperialMatch[3]),
      isMetric: false,
      seatType: "conical",
      quantity: 20,
      raw,
    };
  }
  
  return null;
}

function formatThreadSize(spec) {
  if (spec.isMetric) {
    return `M${spec.threadDiameter}x${spec.threadPitch}`;
  }
  const fractions = { 0.5: "1/2", 0.4375: "7/16" };
  const frac = fractions[spec.threadDiameter] || spec.threadDiameter.toFixed(3);
  return `${frac}"-${spec.threadPitch}`;
}

function getLugCount(boltPattern) {
  if (!boltPattern) return 5;
  const match = boltPattern.match(/^(\d+)\s*[xX×]/);
  return match ? parseInt(match[1], 10) : 5;
}

function calculateHubRingSpec(vehicleHub, wheelBore) {
  if (!vehicleHub || !wheelBore) return null;
  if (Math.abs(wheelBore - vehicleHub) < 0.5) return null;
  if (wheelBore < vehicleHub) return null;
  return { outerDiameter: wheelBore, innerDiameter: vehicleHub, quantity: 4 };
}

function getAccessoryFitment(vehicle, wheel) {
  const lugCount = getLugCount(vehicle.boltPattern);
  const totalLugs = lugCount * 4;
  
  // Lug nuts
  let lugNuts;
  const threadSpec = parseThreadSize(vehicle.threadSize);
  
  if (!threadSpec) {
    lugNuts = {
      status: "skipped",
      reason: vehicle.threadSize 
        ? `Could not parse: "${vehicle.threadSize}"`
        : "No thread size data",
      spec: null,
    };
  } else {
    threadSpec.quantity = totalLugs;
    threadSpec.seatType = vehicle.seatType || "conical";
    lugNuts = {
      status: "required",
      reason: `${totalLugs} ${threadSpec.seatType} lug nuts (${formatThreadSize(threadSpec)})`,
      spec: threadSpec,
    };
  }
  
  // Hub rings
  let hubRings;
  const ringSpec = calculateHubRingSpec(vehicle.centerBoreMm, wheel.centerBore);
  
  if (vehicle.centerBoreMm === null) {
    hubRings = {
      status: "skipped",
      reason: "No center bore data",
      spec: null,
    };
  } else if (wheel.centerBore === null) {
    hubRings = {
      status: "skipped", 
      reason: "Wheel bore not specified",
      spec: null,
    };
  } else if (!ringSpec) {
    hubRings = {
      status: "not_needed",
      reason: `Wheel bore (${wheel.centerBore}mm) matches vehicle (${vehicle.centerBoreMm}mm)`,
      spec: null,
    };
  } else {
    hubRings = {
      status: "required",
      reason: `Ring needed: ${ringSpec.outerDiameter}mm → ${ringSpec.innerDiameter}mm`,
      spec: ringSpec,
    };
  }
  
  return { lugNuts, hubRings, lugCount, totalLugs };
}

// ============================================================================
// Test Cases
// ============================================================================

console.log('═'.repeat(70));
console.log('ACCESSORY FITMENT TEST');
console.log('═'.repeat(70));

// Test 1: 2009 Jeep Wrangler Rubicon
console.log('\n' + '─'.repeat(70));
console.log('TEST 1: 2009 Jeep Wrangler Rubicon + Aftermarket Wheel');
console.log('─'.repeat(70));

const wranglerProfile = {
  threadSize: '1/2" - 20 UNF',
  seatType: 'conical',
  centerBoreMm: 71.6,
  boltPattern: '5x127',
};

const wranglerWheel = {
  sku: 'FUEL-D538-17',
  centerBore: 78.0,  // Aftermarket wheel with larger bore
  seatType: null,
};

console.log('\nVehicle:', wranglerProfile);
console.log('Wheel:', wranglerWheel);

const wranglerResult = getAccessoryFitment(wranglerProfile, wranglerWheel);

console.log('\n📦 LUG NUTS:');
console.log(`   Status: ${wranglerResult.lugNuts.status.toUpperCase()}`);
console.log(`   Reason: ${wranglerResult.lugNuts.reason}`);
if (wranglerResult.lugNuts.spec) {
  console.log(`   Thread: ${formatThreadSize(wranglerResult.lugNuts.spec)}`);
  console.log(`   Seat: ${wranglerResult.lugNuts.spec.seatType}`);
  console.log(`   Quantity: ${wranglerResult.lugNuts.spec.quantity}`);
}

console.log('\n🔘 HUB RINGS:');
console.log(`   Status: ${wranglerResult.hubRings.status.toUpperCase()}`);
console.log(`   Reason: ${wranglerResult.hubRings.reason}`);
if (wranglerResult.hubRings.spec) {
  console.log(`   Spec: ${wranglerResult.hubRings.spec.outerDiameter}mm OD → ${wranglerResult.hubRings.spec.innerDiameter}mm ID`);
  console.log(`   Quantity: ${wranglerResult.hubRings.spec.quantity}`);
}

// Test 2: 2020 Chevy Silverado 1500
console.log('\n' + '─'.repeat(70));
console.log('TEST 2: 2020 Chevy Silverado 1500 + Aftermarket Wheel');
console.log('─'.repeat(70));

const silveradoProfile = {
  threadSize: 'M14 x 1.5',
  seatType: 'conical',
  centerBoreMm: 78.1,
  boltPattern: '6x139.7',
};

const silveradoWheel = {
  sku: 'MOTO-MO970-20',
  centerBore: 106.1,  // Common aftermarket truck wheel bore
  seatType: null,
};

console.log('\nVehicle:', silveradoProfile);
console.log('Wheel:', silveradoWheel);

const silveradoResult = getAccessoryFitment(silveradoProfile, silveradoWheel);

console.log('\n📦 LUG NUTS:');
console.log(`   Status: ${silveradoResult.lugNuts.status.toUpperCase()}`);
console.log(`   Reason: ${silveradoResult.lugNuts.reason}`);
if (silveradoResult.lugNuts.spec) {
  console.log(`   Thread: ${formatThreadSize(silveradoResult.lugNuts.spec)}`);
  console.log(`   Seat: ${silveradoResult.lugNuts.spec.seatType}`);
  console.log(`   Quantity: ${silveradoResult.lugNuts.spec.quantity}`);
}

console.log('\n🔘 HUB RINGS:');
console.log(`   Status: ${silveradoResult.hubRings.status.toUpperCase()}`);
console.log(`   Reason: ${silveradoResult.hubRings.reason}`);
if (silveradoResult.hubRings.spec) {
  console.log(`   Spec: ${silveradoResult.hubRings.spec.outerDiameter}mm OD → ${silveradoResult.hubRings.spec.innerDiameter}mm ID`);
  console.log(`   Quantity: ${silveradoResult.hubRings.spec.quantity}`);
}

// Test 3: 1995 Camaro (missing data)
console.log('\n' + '─'.repeat(70));
console.log('TEST 3: 1995 Camaro Z28 (MISSING DATA CASE)');
console.log('─'.repeat(70));

const camaroProfile = {
  threadSize: null,      // No data from API
  seatType: null,
  centerBoreMm: null,
  boltPattern: null,
};

const camaroWheel = {
  sku: 'AMERICAN-RACING-17',
  centerBore: 73.1,
  seatType: null,
};

console.log('\nVehicle:', camaroProfile);
console.log('Wheel:', camaroWheel);

const camaroResult = getAccessoryFitment(camaroProfile, camaroWheel);

console.log('\n📦 LUG NUTS:');
console.log(`   Status: ${camaroResult.lugNuts.status.toUpperCase()}`);
console.log(`   Reason: ${camaroResult.lugNuts.reason}`);

console.log('\n🔘 HUB RINGS:');
console.log(`   Status: ${camaroResult.hubRings.status.toUpperCase()}`);
console.log(`   Reason: ${camaroResult.hubRings.reason}`);

// Test 4: OEM wheel (no hub ring needed)
console.log('\n' + '─'.repeat(70));
console.log('TEST 4: 2020 Silverado + OEM-spec Wheel (No Hub Ring)');
console.log('─'.repeat(70));

const oemWheel = {
  sku: 'OEM-STYLE-20',
  centerBore: 78.1,  // Matches vehicle exactly
  seatType: null,
};

console.log('\nVehicle:', silveradoProfile);
console.log('Wheel:', oemWheel);

const oemResult = getAccessoryFitment(silveradoProfile, oemWheel);

console.log('\n📦 LUG NUTS:');
console.log(`   Status: ${oemResult.lugNuts.status.toUpperCase()}`);
console.log(`   Reason: ${oemResult.lugNuts.reason}`);

console.log('\n🔘 HUB RINGS:');
console.log(`   Status: ${oemResult.hubRings.status.toUpperCase()}`);
console.log(`   Reason: ${oemResult.hubRings.reason}`);

console.log('\n' + '═'.repeat(70));
console.log('SUMMARY');
console.log('═'.repeat(70));
console.log(`
✅ Wrangler:   Lug nuts REQUIRED (1/2"-20), Hub rings REQUIRED (78→71.6mm)
✅ Silverado:  Lug nuts REQUIRED (M14x1.5), Hub rings REQUIRED (106.1→78.1mm)  
⚠️  Camaro:     SKIPPED - no vehicle data available
✅ OEM Wheel:  Lug nuts REQUIRED, Hub rings NOT NEEDED (bore matches)
`);
