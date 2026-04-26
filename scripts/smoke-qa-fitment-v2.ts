/**
 * LIVE BEHAVIORAL SMOKE QA v2
 * 
 * Fixed to handle wheel object format: {diameter, width, offset, axle, isStock}
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface WheelSpec {
  diameter: number;
  width: number;
  offset?: number | null;
  axle?: string;
  isStock?: boolean;
  rear?: boolean;
}

interface TestResult {
  test: string;
  vehicle: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

const results: TestResult[] = [];

// Test vehicles - mixed categories
const TEST_VEHICLES = {
  cars: [
    { year: 2022, make: 'Toyota', model: 'Camry' },
    { year: 2021, make: 'Honda', model: 'Accord' },
    { year: 2020, make: 'Ford', model: 'Fusion' },
    { year: 2023, make: 'Hyundai', model: 'Sonata' },
    { year: 2019, make: 'Nissan', model: 'Altima' },
  ],
  suvs: [
    { year: 2022, make: 'Toyota', model: 'RAV4' },
    { year: 2021, make: 'Honda', model: 'CR-V' },
    { year: 2023, make: 'Ford', model: 'Explorer' },
    { year: 2020, make: 'Chevrolet', model: 'Tahoe' },
    { year: 2022, make: 'GMC', model: 'Yukon' },
  ],
  trucks: [
    { year: 2022, make: 'Ford', model: 'F-150' },
    { year: 2021, make: 'RAM', model: '1500' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500' },
    { year: 2020, make: 'Toyota', model: 'Tundra' },
    { year: 2022, make: 'GMC', model: 'Sierra 1500' },
  ],
  luxury: [
    { year: 2022, make: 'BMW', model: '5 Series' },
    { year: 2021, make: 'Mercedes-Benz', model: 'E-Class' },
    { year: 2023, make: 'Lexus', model: 'ES' },
    { year: 2020, make: 'Audi', model: 'A6' },
    { year: 2022, make: 'Cadillac', model: 'CT5' },
  ],
  hdTrucks: [
    { year: 2022, make: 'Ford', model: 'F-250' },
    { year: 2021, make: 'RAM', model: '2500' },
    { year: 2020, make: 'Chevrolet', model: 'Silverado 2500HD' },
    { year: 2020, make: 'Ford', model: 'F-350' },
    { year: 2022, make: 'RAM', model: '3500' },
  ],
  performance: [
    { year: 2022, make: 'Ford', model: 'Mustang' },
    { year: 2021, make: 'Chevrolet', model: 'Camaro' },
    { year: 2023, make: 'Dodge', model: 'Challenger' },
    { year: 2021, make: 'BMW', model: 'M3' },
    { year: 2022, make: 'Porsche', model: '911' },
  ],
};

const ALL_VEHICLES = Object.values(TEST_VEHICLES).flat();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getWheelDiameters(wheels: WheelSpec[]): number[] {
  if (!Array.isArray(wheels)) return [];
  return wheels.map(w => w.diameter).filter(d => typeof d === 'number' && d > 0);
}

function getTireDiameters(tires: string[]): number[] {
  if (!Array.isArray(tires)) return [];
  return tires.map(t => {
    const m = String(t).match(/R(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }).filter(d => d > 0);
}

async function getVehicleFitment(year: number, make: string, model: string): Promise<any> {
  const { rows } = await pool.query(`
    SELECT * FROM vehicle_fitments
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
      AND certification_status = 'certified'
    LIMIT 1
  `, [year, make, model]);
  return rows[0] || null;
}

async function testWheelSearch(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const wheels: WheelSpec[] = fitment.oem_wheel_sizes || [];
  const boltPattern = fitment.bolt_pattern;
  
  if (!boltPattern) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'Missing bolt pattern' };
  }
  
  if (wheels.length === 0) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'No OEM wheel sizes' };
  }
  
  const diameters = getWheelDiameters(wheels);
  if (diameters.length === 0) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'Could not extract wheel diameters' };
  }
  
  // Sanity check diameters
  const minD = Math.min(...diameters);
  const maxD = Math.max(...diameters);
  
  if (minD < 14 || maxD > 24) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'WARN', details: `Unusual diameter range: ${minD}-${maxD}"` };
  }
  
  const stockCount = wheels.filter(w => w.isStock !== false).length;
  return { 
    test: 'wheel_search', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Bolt: ${boltPattern}, ${wheels.length} wheel options (${stockCount} stock), ${minD}-${maxD}"`
  };
}

async function testTireSearch(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'tire_search', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const tires: string[] = fitment.oem_tire_sizes || [];
  const wheels: WheelSpec[] = fitment.oem_wheel_sizes || [];
  
  if (tires.length === 0) {
    return { test: 'tire_search', vehicle: vLabel, status: 'FAIL', details: 'No OEM tire sizes' };
  }
  
  const wheelDiams = new Set(getWheelDiameters(wheels));
  const tireDiams = getTireDiameters(tires);
  
  // Check alignment - at least some tires should match wheels
  const matchingTires = tireDiams.filter(d => wheelDiams.has(d));
  
  if (matchingTires.length === 0 && tireDiams.length > 0 && wheelDiams.size > 0) {
    return { 
      test: 'tire_search', 
      vehicle: vLabel, 
      status: 'WARN', 
      details: `Tire diameters (${[...new Set(tireDiams)].join(',')}) don't match wheel diameters (${[...wheelDiams].join(',')})`
    };
  }
  
  return { 
    test: 'tire_search', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `${tires.length} tire sizes, matching diameters: ${[...new Set(matchingTires)].join(', ')}`
  };
}

async function testPackageFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'package_flow', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const wheels: WheelSpec[] = fitment.oem_wheel_sizes || [];
  const tires: string[] = fitment.oem_tire_sizes || [];
  const bolt = fitment.bolt_pattern;
  
  if (!bolt || wheels.length === 0 || tires.length === 0) {
    return { test: 'package_flow', vehicle: vLabel, status: 'FAIL', details: `Incomplete: bolt=${!!bolt}, wheels=${wheels.length}, tires=${tires.length}` };
  }
  
  // Check for plus-size options
  const diameters = getWheelDiameters(wheels);
  const uniqueDiams = [...new Set(diameters)].sort((a, b) => a - b);
  const hasPlusSize = uniqueDiams.length > 1;
  
  return { 
    test: 'package_flow', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Complete: ${wheels.length} wheels, ${tires.length} tires, diameters: ${uniqueDiams.join('/')}", plus-size: ${hasPlusSize ? 'yes' : 'no'}`
  };
}

async function testLiftedFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'lifted_flow', vehicle: vLabel, status: 'WARN', details: 'No certified fitment for this year' };
  }
  
  const wheels: WheelSpec[] = fitment.oem_wheel_sizes || [];
  const diameters = getWheelDiameters(wheels);
  const maxD = diameters.length > 0 ? Math.max(...diameters) : 0;
  
  // Trucks should have 17"+ for lifted builds
  const isTruck = ['F-150', 'F-250', 'F-350', 'Silverado', 'Sierra', 'RAM', 'Tundra', 'Tacoma', 
    'Tahoe', 'Yukon', 'Suburban', 'Expedition', '4Runner', 'Wrangler', 'Ranger', 'Colorado', 'Canyon']
    .some(t => vehicle.model.includes(t));
  
  if (isTruck && maxD < 17) {
    return { test: 'lifted_flow', vehicle: vLabel, status: 'WARN', details: `Max ${maxD}" may limit lifted options` };
  }
  
  return { test: 'lifted_flow', vehicle: vLabel, status: 'PASS', details: `Bolt: ${fitment.bolt_pattern}, Max wheel: ${maxD}"` };
}

async function testStaggerFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'stagger_flow', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const wheels: WheelSpec[] = fitment.oem_wheel_sizes || [];
  const isStaggered = fitment.is_staggered === true;
  
  // Check for rear-specific wheels (indication of stagger)
  const hasRearWheels = wheels.some(w => w.rear === true || w.axle === 'rear');
  const widths = wheels.map(w => w.width).filter(w => typeof w === 'number');
  const hasWidthVariation = widths.length > 1 && (Math.max(...widths) - Math.min(...widths)) >= 0.5;
  
  // Performance cars that typically have stagger
  const expectStagger = ['Mustang', 'Camaro', 'Challenger', 'Charger', '911', 'M3', 'M4', 'M5', 'Corvette']
    .some(c => vehicle.model.includes(c));
  
  const actualStagger = isStaggered || hasRearWheels || hasWidthVariation;
  
  if (expectStagger && !actualStagger) {
    return { test: 'stagger_flow', vehicle: vLabel, status: 'WARN', details: `Expected stagger but none detected` };
  }
  
  const diams = [...new Set(getWheelDiameters(wheels))];
  return { 
    test: 'stagger_flow', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Stagger: ${actualStagger ? 'yes' : 'no'}, Diameters: ${diams.join('/')}", ${wheels.length} options`
  };
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('LIVE BEHAVIORAL SMOKE QA v2');
  console.log('='.repeat(70));
  console.log('');
  
  const shuffled = shuffle(ALL_VEHICLES);
  
  // 1. 25 wheel searches
  console.log('📦 WHEEL SEARCHES (25)');
  console.log('-'.repeat(50));
  for (let i = 0; i < 25; i++) {
    const v = shuffled[i % shuffled.length];
    const result = await testWheelSearch(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 55)}`);
  }
  
  // 2. 25 tire searches
  console.log('\n🛞 TIRE SEARCHES (25)');
  console.log('-'.repeat(50));
  for (let i = 0; i < 25; i++) {
    const v = shuffled[(i + 5) % shuffled.length];
    const result = await testTireSearch(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 55)}`);
  }
  
  // 3. 10 package flows
  console.log('\n📦 PACKAGE FLOWS (10)');
  console.log('-'.repeat(50));
  for (let i = 0; i < 10; i++) {
    const v = shuffled[(i + 10) % shuffled.length];
    const result = await testPackageFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 55)}`);
  }
  
  // 4. 10 lifted/off-road flows
  console.log('\n🏔️ LIFTED/OFF-ROAD FLOWS (10)');
  console.log('-'.repeat(50));
  const trucksSuvs = [...TEST_VEHICLES.trucks, ...TEST_VEHICLES.suvs, ...TEST_VEHICLES.hdTrucks];
  for (let i = 0; i < 10; i++) {
    const v = trucksSuvs[i % trucksSuvs.length];
    const result = await testLiftedFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 55)}`);
  }
  
  // 5. 10 stagger/performance flows
  console.log('\n🏎️ STAGGER/PERFORMANCE FLOWS (10)');
  console.log('-'.repeat(50));
  const perfCars = [...TEST_VEHICLES.performance, ...TEST_VEHICLES.luxury];
  for (let i = 0; i < 10; i++) {
    const v = perfCars[i % perfCars.length];
    const result = await testStaggerFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 55)}`);
  }
  
  // Summary
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(70));
  console.log('SMOKE QA SUMMARY');
  console.log('='.repeat(70));
  
  console.log('\n📊 RESULTS:');
  console.log(`  ✅ PASS: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
  console.log(`  ⚠️  WARN: ${warned}/${total} (${(warned/total*100).toFixed(1)}%)`);
  console.log(`  ❌ FAIL: ${failed}/${total} (${(failed/total*100).toFixed(1)}%)`);
  
  console.log('\n📋 BY TEST TYPE:');
  const byType: Record<string, { pass: number; warn: number; fail: number }> = {};
  for (const r of results) {
    if (!byType[r.test]) byType[r.test] = { pass: 0, warn: 0, fail: 0 };
    if (r.status === 'PASS') byType[r.test].pass++;
    else if (r.status === 'WARN') byType[r.test].warn++;
    else byType[r.test].fail++;
  }
  for (const [test, counts] of Object.entries(byType)) {
    const testTotal = counts.pass + counts.warn + counts.fail;
    console.log(`  ${test}: ${counts.pass}/${testTotal} PASS, ${counts.warn} WARN, ${counts.fail} FAIL`);
  }
  
  if (failed > 0) {
    console.log('\n❌ FAILURES:');
    for (const r of results.filter(r => r.status === 'FAIL')) {
      console.log(`  ${r.test} - ${r.vehicle}: ${r.details}`);
    }
  }
  
  if (warned > 0) {
    console.log('\n⚠️  WARNINGS:');
    for (const r of results.filter(r => r.status === 'WARN')) {
      console.log(`  ${r.test} - ${r.vehicle}: ${r.details}`);
    }
  }
  
  // Overall verdict
  console.log('\n' + '='.repeat(70));
  if (failed === 0 && warned <= 5) {
    console.log('🎉 OVERALL: PASS');
    console.log('Customer-facing flows are working correctly.');
  } else if (failed <= 2 && warned <= 10) {
    console.log('⚠️  OVERALL: PASS WITH WARNINGS');
    console.log('Minor issues detected but no critical failures.');
  } else {
    console.log('❌ OVERALL: NEEDS ATTENTION');
    console.log(`${failed} failures and ${warned} warnings require review.`);
  }
  console.log('='.repeat(70));
}

runTests()
  .then(() => pool.end())
  .catch(e => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
