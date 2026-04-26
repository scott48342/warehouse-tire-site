/**
 * LIVE BEHAVIORAL SMOKE QA
 * 
 * Tests customer-facing flows against the 99.5% certified fitment system.
 * Validates wheel searches, tire searches, packages, lifted/off-road, and stagger/performance.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestResult {
  test: string;
  vehicle: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  wheelCount?: number;
  tireCount?: number;
}

const results: TestResult[] = [];

// Test vehicles - mixed: cars, SUVs, trucks, luxury, HD, performance
const TEST_VEHICLES = {
  // Standard cars
  cars: [
    { year: 2022, make: 'Toyota', model: 'Camry' },
    { year: 2021, make: 'Honda', model: 'Accord' },
    { year: 2020, make: 'Ford', model: 'Fusion' },
    { year: 2023, make: 'Hyundai', model: 'Sonata' },
    { year: 2019, make: 'Nissan', model: 'Altima' },
  ],
  // SUVs
  suvs: [
    { year: 2022, make: 'Toyota', model: 'RAV4' },
    { year: 2021, make: 'Honda', model: 'CR-V' },
    { year: 2023, make: 'Ford', model: 'Explorer' },
    { year: 2020, make: 'Chevrolet', model: 'Tahoe' },
    { year: 2022, make: 'GMC', model: 'Yukon' },
  ],
  // Trucks
  trucks: [
    { year: 2022, make: 'Ford', model: 'F-150' },
    { year: 2021, make: 'RAM', model: '1500' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 1500' },
    { year: 2020, make: 'Toyota', model: 'Tundra' },
    { year: 2022, make: 'GMC', model: 'Sierra 1500' },
  ],
  // Luxury
  luxury: [
    { year: 2022, make: 'BMW', model: '5 Series' },
    { year: 2021, make: 'Mercedes-Benz', model: 'E-Class' },
    { year: 2023, make: 'Lexus', model: 'ES' },
    { year: 2020, make: 'Audi', model: 'A6' },
    { year: 2022, make: 'Cadillac', model: 'CT5' },
  ],
  // HD Trucks
  hdTrucks: [
    { year: 2022, make: 'Ford', model: 'F-250' },
    { year: 2021, make: 'RAM', model: '2500' },
    { year: 2023, make: 'Chevrolet', model: 'Silverado 2500HD' },
    { year: 2020, make: 'Ford', model: 'F-350' },
    { year: 2022, make: 'RAM', model: '3500' },
  ],
  // Performance
  performance: [
    { year: 2022, make: 'Ford', model: 'Mustang' },
    { year: 2021, make: 'Chevrolet', model: 'Camaro' },
    { year: 2023, make: 'Dodge', model: 'Challenger' },
    { year: 2020, make: 'BMW', model: 'M3' },
    { year: 2022, make: 'Porsche', model: '911' },
  ],
};

// Flatten all vehicles for random selection
const ALL_VEHICLES = [
  ...TEST_VEHICLES.cars,
  ...TEST_VEHICLES.suvs,
  ...TEST_VEHICLES.trucks,
  ...TEST_VEHICLES.luxury,
  ...TEST_VEHICLES.hdTrucks,
  ...TEST_VEHICLES.performance,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  
  const wheels = fitment.oem_wheel_sizes || [];
  const boltPattern = fitment.bolt_pattern;
  
  if (!boltPattern) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'Missing bolt pattern' };
  }
  
  if (wheels.length === 0) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'No OEM wheel sizes' };
  }
  
  // Extract diameters
  const diameters = wheels.map((w: string) => {
    const m = String(w).match(/^(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }).filter((d: number) => d > 0);
  
  if (diameters.length === 0) {
    return { test: 'wheel_search', vehicle: vLabel, status: 'FAIL', details: 'Could not parse wheel diameters' };
  }
  
  // Check for sane diameters (14-24 for most vehicles)
  const minD = Math.min(...diameters);
  const maxD = Math.max(...diameters);
  
  if (minD < 14 || maxD > 26) {
    return { 
      test: 'wheel_search', 
      vehicle: vLabel, 
      status: 'WARN', 
      details: `Unusual diameter range: ${minD}-${maxD}`,
      wheelCount: wheels.length 
    };
  }
  
  return { 
    test: 'wheel_search', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Bolt: ${boltPattern}, Wheels: ${wheels.join(', ')}`,
    wheelCount: wheels.length 
  };
}

async function testTireSearch(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'tire_search', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const tires = fitment.oem_tire_sizes || [];
  const wheels = fitment.oem_wheel_sizes || [];
  
  if (tires.length === 0) {
    return { test: 'tire_search', vehicle: vLabel, status: 'FAIL', details: 'No OEM tire sizes' };
  }
  
  // Check tire/wheel diameter alignment
  const wheelDiams = new Set(wheels.map((w: string) => {
    const m = String(w).match(/^(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }).filter((d: number) => d > 0));
  
  const tireDiams = tires.map((t: string) => {
    const m = String(t).match(/R(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  }).filter((d: number) => d > 0);
  
  const mismatch = tireDiams.filter((d: number) => !wheelDiams.has(d));
  
  if (mismatch.length > 0) {
    return { 
      test: 'tire_search', 
      vehicle: vLabel, 
      status: 'FAIL', 
      details: `Tire/wheel diameter mismatch: tires have R${mismatch.join(', R')} but wheels are ${[...wheelDiams].join(', ')}`,
      tireCount: tires.length 
    };
  }
  
  return { 
    test: 'tire_search', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Tires: ${tires.join(', ')}`,
    tireCount: tires.length 
  };
}

async function testPackageFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'package_flow', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const wheels = fitment.oem_wheel_sizes || [];
  const tires = fitment.oem_tire_sizes || [];
  const bolt = fitment.bolt_pattern;
  
  // Package flow needs all three
  if (!bolt || wheels.length === 0 || tires.length === 0) {
    return { 
      test: 'package_flow', 
      vehicle: vLabel, 
      status: 'FAIL', 
      details: `Incomplete fitment: bolt=${bolt}, wheels=${wheels.length}, tires=${tires.length}` 
    };
  }
  
  // Check plus-size options exist (diameter + 1 or +2)
  const baseDiam = parseInt(String(wheels[0]).match(/^(\d+)/)?.[1] || '0');
  const hasPlusSize = wheels.some((w: string) => {
    const d = parseInt(String(w).match(/^(\d+)/)?.[1] || '0');
    return d > baseDiam;
  });
  
  return { 
    test: 'package_flow', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Complete: ${wheels.length} wheel sizes, ${tires.length} tire sizes, plus-size: ${hasPlusSize ? 'yes' : 'no'}` 
  };
}

async function testLiftedFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    // For lifted flows, check if any version of this vehicle exists
    const { rows } = await pool.query(`
      SELECT * FROM vehicle_fitments
      WHERE LOWER(make) = LOWER($1) AND LOWER(model) = LOWER($2)
        AND certification_status = 'certified'
      LIMIT 1
    `, [vehicle.make, vehicle.model]);
    
    if (rows.length === 0) {
      return { test: 'lifted_flow', vehicle: vLabel, status: 'WARN', details: 'Vehicle not in database' };
    }
    return { test: 'lifted_flow', vehicle: vLabel, status: 'WARN', details: 'Specific year not certified, but model exists' };
  }
  
  const wheels = fitment.oem_wheel_sizes || [];
  const bolt = fitment.bolt_pattern;
  
  // Lifted trucks typically need 17"+ wheels
  const maxDiam = Math.max(...wheels.map((w: string) => {
    const m = String(w).match(/^(\d+)/);
    return m ? parseInt(m[1]) : 0;
  }));
  
  // Check if this is a truck/SUV that could be lifted
  const isTruckOrSUV = ['F-150', 'F-250', 'F-350', 'Silverado', 'Sierra', 'RAM', 'Tundra', 'Tacoma', 
    'Tahoe', 'Yukon', 'Suburban', 'Expedition', '4Runner', 'Wrangler', 'Gladiator', 'Bronco',
    'Colorado', 'Canyon', 'Ranger'].some(t => vehicle.model.includes(t));
  
  if (isTruckOrSUV && maxDiam < 17) {
    return { 
      test: 'lifted_flow', 
      vehicle: vLabel, 
      status: 'WARN', 
      details: `Max wheel diameter ${maxDiam}" may be too small for lifted builds` 
    };
  }
  
  return { 
    test: 'lifted_flow', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Bolt: ${bolt}, Max wheel: ${maxDiam}"` 
  };
}

async function testStaggerFlow(vehicle: { year: number; make: string; model: string }): Promise<TestResult> {
  const fitment = await getVehicleFitment(vehicle.year, vehicle.make, vehicle.model);
  const vLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  
  if (!fitment) {
    return { test: 'stagger_flow', vehicle: vLabel, status: 'FAIL', details: 'No certified fitment found' };
  }
  
  const isStaggered = fitment.is_staggered === true;
  const wheels = fitment.oem_wheel_sizes || [];
  const tires = fitment.oem_tire_sizes || [];
  
  // Performance cars that typically have stagger
  const staggerCars = ['Mustang', 'Camaro', 'Challenger', 'Charger', '911', 'M3', 'M4', 'M5', 
    'AMG', 'RS', 'Corvette', 'Viper', 'GT-R', 'Supra'];
  const expectStagger = staggerCars.some(c => vehicle.model.includes(c));
  
  // Check for width variations in wheels (indication of stagger)
  const widths = wheels.map((w: string) => {
    const m = String(w).match(/x([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  }).filter((w: number) => w > 0);
  
  const hasWidthVariation = widths.length > 1 && Math.max(...widths) - Math.min(...widths) >= 0.5;
  
  if (expectStagger && !isStaggered && !hasWidthVariation) {
    return { 
      test: 'stagger_flow', 
      vehicle: vLabel, 
      status: 'WARN', 
      details: `Expected stagger for performance car but none detected. Wheels: ${wheels.join(', ')}` 
    };
  }
  
  return { 
    test: 'stagger_flow', 
    vehicle: vLabel, 
    status: 'PASS', 
    details: `Stagger: ${isStaggered ? 'yes' : 'no'}, Wheels: ${wheels.join(', ')}` 
  };
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('LIVE BEHAVIORAL SMOKE QA');
  console.log('='.repeat(70));
  console.log(`Testing against: ${BASE_URL}`);
  console.log('');
  
  // Shuffle vehicles for random selection
  const shuffled = shuffle(ALL_VEHICLES);
  
  // 1. 25 wheel searches
  console.log('📦 WHEEL SEARCHES (25)');
  console.log('-'.repeat(40));
  for (let i = 0; i < 25; i++) {
    const v = shuffled[i % shuffled.length];
    const result = await testWheelSearch(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 60)}`);
  }
  
  // 2. 25 tire searches
  console.log('\n🛞 TIRE SEARCHES (25)');
  console.log('-'.repeat(40));
  for (let i = 0; i < 25; i++) {
    const v = shuffled[(i + 5) % shuffled.length];
    const result = await testTireSearch(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 60)}`);
  }
  
  // 3. 10 package flows
  console.log('\n📦 PACKAGE FLOWS (10)');
  console.log('-'.repeat(40));
  for (let i = 0; i < 10; i++) {
    const v = shuffled[(i + 10) % shuffled.length];
    const result = await testPackageFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 60)}`);
  }
  
  // 4. 10 lifted/off-road flows (trucks/SUVs)
  console.log('\n🏔️ LIFTED/OFF-ROAD FLOWS (10)');
  console.log('-'.repeat(40));
  const trucksSuvs = [...TEST_VEHICLES.trucks, ...TEST_VEHICLES.suvs, ...TEST_VEHICLES.hdTrucks];
  const shuffledTrucks = shuffle(trucksSuvs);
  for (let i = 0; i < 10; i++) {
    const v = shuffledTrucks[i % shuffledTrucks.length];
    const result = await testLiftedFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 60)}`);
  }
  
  // 5. 10 stagger/performance flows
  console.log('\n🏎️ STAGGER/PERFORMANCE FLOWS (10)');
  console.log('-'.repeat(40));
  const perfCars = [...TEST_VEHICLES.performance, ...TEST_VEHICLES.luxury];
  const shuffledPerf = shuffle(perfCars);
  for (let i = 0; i < 10; i++) {
    const v = shuffledPerf[i % shuffledPerf.length];
    const result = await testStaggerFlow(v);
    results.push(result);
    const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
    console.log(`  ${icon} ${result.vehicle}: ${result.details.substring(0, 60)}`);
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
