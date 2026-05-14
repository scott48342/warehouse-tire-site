#!/usr/bin/env node
/**
 * Phase A QA - Staggered Fitment Verification
 * 
 * Tests:
 * 1. Verify staggered data structure in DB
 * 2. Test API endpoints return correct front/rear sizes
 * 3. Verify wheel specs preserved
 * 4. Smoke test key trims
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

// QA test cases - specific trims to verify
const QA_TEST_CASES = [
  // Camaro
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trimPattern: 'SS 1LE', expectedFront: '285/30R20', expectedRear: '305/30R20' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro', trimPattern: 'ZL1 1LE', expectedFront: '305/30R19', expectedRear: '325/30R19' },
  { year: 2023, make: 'Chevrolet', model: 'Camaro', trimPattern: 'SS 1LE', expectedFront: '285/30R20', expectedRear: '305/30R20' },
  
  // Corvette
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trimPattern: 'Stingray', expectedFront: '245/35ZR19', expectedRear: '305/30ZR20' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette', trimPattern: 'Z06', expectedFront: '275/30ZR20', expectedRear: '345/25ZR21' },
  { year: 2023, make: 'Chevrolet', model: 'Corvette', trimPattern: 'Stingray', expectedFront: '245/35ZR19', expectedRear: '305/30ZR20' },
  
  // BMW M3
  { year: 2024, make: 'BMW', model: 'M3', trimPattern: 'Competition', expectedFront: '255/35R19', expectedRear: '275/35R19' },
  { year: 2023, make: 'BMW', model: 'M3', trimPattern: 'Competition', expectedFront: '255/35R19', expectedRear: '275/35R19' },
  
  // BMW M4
  { year: 2024, make: 'BMW', model: 'M4', trimPattern: 'Competition', expectedFront: '275/35R19', expectedRear: '285/30R20' },
  { year: 2023, make: 'BMW', model: 'M4', trimPattern: 'CS', expectedFront: '275/35R19', expectedRear: '285/30R20' },
  
  // BMW M5
  { year: 2024, make: 'BMW', model: 'M5', trimPattern: 'Competition', expectedFront: '275/35R20', expectedRear: '285/35R20' },
  { year: 2023, make: 'BMW', model: 'M5', trimPattern: 'CS', expectedFront: '275/35R20', expectedRear: '285/35R20' },
];

// Preserved field checks
const PRESERVED_FIELDS = [
  'bolt_pattern',
  'center_bore_mm',
  'thread_size',
  'seat_type',
  'oem_wheel_sizes',
  'offset_min_mm',
  'offset_max_mm',
];

async function runQA() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   PHASE A QA - STAGGERED FITMENT VERIFICATION                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not configured');
    process.exit(1);
  }

  const sql = postgres(connectionString);

  const results = {
    timestamp: new Date().toISOString(),
    tests: {
      staggeredFormat: { passed: 0, failed: 0, details: [] },
      expectedSizes: { passed: 0, failed: 0, details: [] },
      preservedFields: { passed: 0, failed: 0, details: [] },
      apiSmoke: { passed: 0, failed: 0, details: [] },
    },
    regressions: [],
    summary: {},
  };

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: Verify staggered data format in DB
    // ═══════════════════════════════════════════════════════════════════════
    console.log('📋 TEST 1: Staggered Data Format\n');
    
    const updatedRecords = await sql`
      SELECT id, year, make, model, display_trim, oem_tire_sizes
      FROM vehicle_fitments
      WHERE make IN ('Chevrolet', 'BMW', 'Ford')
        AND model IN ('Corvette', 'Camaro', 'Mustang', 'M3', 'M4', 'M5')
        AND year >= 2015
        AND oem_tire_sizes IS NOT NULL
      ORDER BY year DESC, make, model
      LIMIT 50
    `;

    for (const record of updatedRecords) {
      const tireSizes = record.oem_tire_sizes;
      
      // Check if it's an array with axle annotations
      if (Array.isArray(tireSizes) && tireSizes.length >= 2) {
        const hasFront = tireSizes.some(t => t.axle === 'front' || t.axle === 'Front');
        const hasRear = tireSizes.some(t => t.axle === 'rear' || t.axle === 'Rear');
        
        if (hasFront && hasRear) {
          results.tests.staggeredFormat.passed++;
        } else {
          results.tests.staggeredFormat.failed++;
          results.tests.staggeredFormat.details.push({
            id: record.id,
            year: record.year,
            make: record.make,
            model: record.model,
            trim: record.display_trim,
            issue: `Missing axle annotations: front=${hasFront}, rear=${hasRear}`,
            data: tireSizes,
          });
        }
      }
    }

    console.log(`   ✅ Passed: ${results.tests.staggeredFormat.passed}`);
    console.log(`   ❌ Failed: ${results.tests.staggeredFormat.failed}\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: Verify expected tire sizes for specific trims
    // ═══════════════════════════════════════════════════════════════════════
    console.log('📋 TEST 2: Expected Tire Sizes\n');

    for (const testCase of QA_TEST_CASES) {
      const records = await sql`
        SELECT id, year, make, model, display_trim, oem_tire_sizes
        FROM vehicle_fitments
        WHERE year = ${testCase.year}
          AND make = ${testCase.make}
          AND model = ${testCase.model}
          AND display_trim ILIKE ${'%' + testCase.trimPattern + '%'}
        LIMIT 1
      `;

      if (records.length === 0) {
        results.tests.expectedSizes.details.push({
          testCase,
          issue: 'Record not found',
        });
        continue;
      }

      const record = records[0];
      const tireSizes = record.oem_tire_sizes;
      
      if (!Array.isArray(tireSizes)) {
        results.tests.expectedSizes.failed++;
        results.tests.expectedSizes.details.push({
          testCase,
          issue: 'oem_tire_sizes is not an array',
          actual: tireSizes,
        });
        continue;
      }

      const frontSize = tireSizes.find(t => t.axle === 'front')?.size;
      const rearSize = tireSizes.find(t => t.axle === 'rear')?.size;

      if (frontSize === testCase.expectedFront && rearSize === testCase.expectedRear) {
        results.tests.expectedSizes.passed++;
        console.log(`   ✅ ${testCase.year} ${testCase.make} ${testCase.model} ${testCase.trimPattern}`);
        console.log(`      Front: ${frontSize} | Rear: ${rearSize}`);
      } else {
        results.tests.expectedSizes.failed++;
        results.tests.expectedSizes.details.push({
          testCase,
          issue: 'Size mismatch',
          expectedFront: testCase.expectedFront,
          expectedRear: testCase.expectedRear,
          actualFront: frontSize,
          actualRear: rearSize,
        });
        console.log(`   ❌ ${testCase.year} ${testCase.make} ${testCase.model} ${testCase.trimPattern}`);
        console.log(`      Expected: F:${testCase.expectedFront} R:${testCase.expectedRear}`);
        console.log(`      Actual:   F:${frontSize} R:${rearSize}`);
        results.regressions.push({
          type: 'size_mismatch',
          ...testCase,
          actualFront: frontSize,
          actualRear: rearSize,
        });
      }
    }

    console.log(`\n   Summary: ${results.tests.expectedSizes.passed}/${QA_TEST_CASES.length} passed\n`);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: Verify preserved fields (bolt pattern, center bore, etc.)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('📋 TEST 3: Preserved Fields\n');

    // Load snapshot to compare
    const snapshotDir = resolve(__dirname, 'output/snapshots');
    const { readdirSync, readFileSync } = await import('fs');
    const snapshotFiles = readdirSync(snapshotDir).filter(f => f.startsWith('phase-a-snapshot-'));
    
    if (snapshotFiles.length > 0) {
      const latestSnapshot = snapshotFiles.sort().pop();
      const snapshotData = JSON.parse(readFileSync(resolve(snapshotDir, latestSnapshot), 'utf8'));
      
      // Sample 10 records to verify
      const sampleIds = snapshotData.records.slice(0, 10).map(r => r.id);
      
      const currentRecords = await sql`
        SELECT id, bolt_pattern, center_bore_mm, thread_size, seat_type, 
               oem_wheel_sizes, offset_min_mm, offset_max_mm
        FROM vehicle_fitments
        WHERE id = ANY(${sampleIds}::uuid[])
      `;

      for (const current of currentRecords) {
        const original = snapshotData.records.find(r => r.id === current.id);
        if (!original) continue;

        let allPreserved = true;
        for (const field of PRESERVED_FIELDS) {
          const origVal = JSON.stringify(original[field]);
          const currVal = JSON.stringify(current[field]);
          
          if (origVal !== currVal) {
            allPreserved = false;
            results.tests.preservedFields.details.push({
              id: current.id,
              field,
              original: original[field],
              current: current[field],
            });
            results.regressions.push({
              type: 'field_changed',
              id: current.id,
              field,
              original: original[field],
              current: current[field],
            });
          }
        }

        if (allPreserved) {
          results.tests.preservedFields.passed++;
        } else {
          results.tests.preservedFields.failed++;
        }
      }

      console.log(`   ✅ Passed: ${results.tests.preservedFields.passed}`);
      console.log(`   ❌ Failed: ${results.tests.preservedFields.failed}\n`);
    } else {
      console.log('   ⚠️  No snapshot found, skipping preserved fields check\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4: API Smoke Tests
    // ═══════════════════════════════════════════════════════════════════════
    console.log('📋 TEST 4: API Smoke Tests\n');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    
    const apiTests = [
      { 
        name: '2024 Camaro SS 1LE tire sizes',
        url: `/api/vehicles/tire-sizes?year=2024&make=Chevrolet&model=Camaro`,
      },
      { 
        name: '2024 Corvette trims',
        url: `/api/vehicles/trims?year=2024&make=Chevrolet&model=Corvette`,
      },
      {
        name: '2024 BMW M4 wheel fitment',
        url: `/api/wheels/fitment-search?year=2024&make=BMW&model=M4&trim=Competition`,
      },
    ];

    for (const test of apiTests) {
      try {
        const response = await fetch(`${baseUrl}${test.url}`);
        if (response.ok) {
          const data = await response.json();
          results.tests.apiSmoke.passed++;
          console.log(`   ✅ ${test.name}`);
          
          // Quick sanity check on response
          if (data.tireSizes && Array.isArray(data.tireSizes)) {
            console.log(`      Found ${data.tireSizes.length} tire sizes`);
          }
        } else {
          results.tests.apiSmoke.failed++;
          console.log(`   ❌ ${test.name} - ${response.status}`);
          results.tests.apiSmoke.details.push({
            test: test.name,
            status: response.status,
          });
        }
      } catch (err) {
        results.tests.apiSmoke.failed++;
        console.log(`   ⚠️  ${test.name} - ${err.message}`);
        results.tests.apiSmoke.details.push({
          test: test.name,
          error: err.message,
        });
      }
    }

    console.log(`\n   Summary: ${results.tests.apiSmoke.passed}/${apiTests.length} passed\n`);

  } finally {
    await sql.end();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  results.summary = {
    totalTests: 
      results.tests.staggeredFormat.passed + results.tests.staggeredFormat.failed +
      results.tests.expectedSizes.passed + results.tests.expectedSizes.failed +
      results.tests.preservedFields.passed + results.tests.preservedFields.failed +
      results.tests.apiSmoke.passed + results.tests.apiSmoke.failed,
    totalPassed:
      results.tests.staggeredFormat.passed +
      results.tests.expectedSizes.passed +
      results.tests.preservedFields.passed +
      results.tests.apiSmoke.passed,
    totalFailed:
      results.tests.staggeredFormat.failed +
      results.tests.expectedSizes.failed +
      results.tests.preservedFields.failed +
      results.tests.apiSmoke.failed,
    regressionCount: results.regressions.length,
  };

  // Save QA results
  const outputDir = resolve(__dirname, 'output');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const qaPath = resolve(outputDir, `phase-a-qa-${timestamp}.json`);
  writeFileSync(qaPath, JSON.stringify(results, null, 2));

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     QA SUMMARY                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`
  Total Tests:    ${results.summary.totalTests}
  ✅ Passed:      ${results.summary.totalPassed}
  ❌ Failed:      ${results.summary.totalFailed}
  ⚠️  Regressions: ${results.summary.regressionCount}
  
  📁 Results: ${qaPath}
  `);

  if (results.regressions.length > 0) {
    console.log('⚠️  REGRESSIONS DETECTED:');
    for (const reg of results.regressions) {
      console.log(`   - ${reg.type}: ${JSON.stringify(reg)}`);
    }
  }

  return results;
}

// Run
runQA().catch(err => {
  console.error('QA failed:', err);
  process.exit(1);
});
