#!/usr/bin/env node
/**
 * Phase 3: Full Fitment Database Audit
 * Comprehensive quality scorecard
 */

import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 FITMENT DATABASE AUDIT - COMPREHENSIVE QUALITY SCORECARD');
  console.log('='.repeat(70));
  
  const report = {
    generatedAt: new Date().toISOString(),
    overall: {},
    wheelSpecs: {},
    tireSpecs: {},
    byMake: [],
    emptyRecords: [],
    qualityIssues: []
  };

  // ============================================================
  // OVERALL STATS
  // ============================================================
  console.log('\n📈 OVERALL DATABASE STATS');
  console.log('-'.repeat(50));
  
  const totalRecords = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  const uniqueMakes = await client.query('SELECT COUNT(DISTINCT make) as count FROM vehicle_fitments');
  const uniqueModels = await client.query('SELECT COUNT(DISTINCT model) as count FROM vehicle_fitments');
  const uniqueYMM = await client.query('SELECT COUNT(DISTINCT (year, make, model)) as count FROM vehicle_fitments');
  const yearRange = await client.query('SELECT MIN(year) as min_year, MAX(year) as max_year FROM vehicle_fitments');
  
  console.log(`  Total records:        ${totalRecords.rows[0].count}`);
  console.log(`  Unique makes:         ${uniqueMakes.rows[0].count}`);
  console.log(`  Unique models:        ${uniqueModels.rows[0].count}`);
  console.log(`  Unique Y/M/M combos:  ${uniqueYMM.rows[0].count}`);
  console.log(`  Year range:           ${yearRange.rows[0].min_year} - ${yearRange.rows[0].max_year}`);
  
  report.overall = {
    totalRecords: parseInt(totalRecords.rows[0].count),
    uniqueMakes: parseInt(uniqueMakes.rows[0].count),
    uniqueModels: parseInt(uniqueModels.rows[0].count),
    uniqueYMM: parseInt(uniqueYMM.rows[0].count),
    yearRange: `${yearRange.rows[0].min_year}-${yearRange.rows[0].max_year}`
  };

  // ============================================================
  // WHEEL SPECS COVERAGE
  // ============================================================
  console.log('\n🔩 WHEEL SPECS COVERAGE');
  console.log('-'.repeat(50));
  
  const boltPattern = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
  `);
  const centerBore = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE center_bore_mm IS NOT NULL AND center_bore_mm > 0
  `);
  const wheelSizes = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND jsonb_array_length(oem_wheel_sizes) > 0
  `);
  const threadSize = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE thread_size IS NOT NULL AND thread_size != ''
  `);
  
  const total = parseInt(totalRecords.rows[0].count);
  const boltPct = ((parseInt(boltPattern.rows[0].count) / total) * 100).toFixed(1);
  const borePct = ((parseInt(centerBore.rows[0].count) / total) * 100).toFixed(1);
  const wheelPct = ((parseInt(wheelSizes.rows[0].count) / total) * 100).toFixed(1);
  const threadPct = ((parseInt(threadSize.rows[0].count) / total) * 100).toFixed(1);
  
  console.log(`  Bolt pattern:         ${boltPattern.rows[0].count} / ${total} (${boltPct}%)`);
  console.log(`  Center bore:          ${centerBore.rows[0].count} / ${total} (${borePct}%)`);
  console.log(`  Wheel sizes:          ${wheelSizes.rows[0].count} / ${total} (${wheelPct}%)`);
  console.log(`  Thread size:          ${threadSize.rows[0].count} / ${total} (${threadPct}%)`);
  
  report.wheelSpecs = {
    boltPattern: { count: parseInt(boltPattern.rows[0].count), percent: parseFloat(boltPct) },
    centerBore: { count: parseInt(centerBore.rows[0].count), percent: parseFloat(borePct) },
    wheelSizes: { count: parseInt(wheelSizes.rows[0].count), percent: parseFloat(wheelPct) },
    threadSize: { count: parseInt(threadSize.rows[0].count), percent: parseFloat(threadPct) }
  };

  // ============================================================
  // TIRE SPECS COVERAGE
  // ============================================================
  console.log('\n🛞 TIRE SPECS COVERAGE');
  console.log('-'.repeat(50));
  
  const tireSizes = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb AND jsonb_array_length(oem_tire_sizes) > 0
  `);
  const emptyTires = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0
  `);
  // Check for staggered by looking at tire sizes with multiple entries that might be front/rear
  const staggered = await client.query(`
    SELECT COUNT(*) as count FROM vehicle_fitments 
    WHERE oem_tire_sizes::text LIKE '%/%' AND jsonb_array_length(oem_tire_sizes) >= 2
  `);
  
  const tirePct = ((parseInt(tireSizes.rows[0].count) / total) * 100).toFixed(1);
  const emptyPct = ((parseInt(emptyTires.rows[0].count) / total) * 100).toFixed(1);
  
  console.log(`  With tire sizes:      ${tireSizes.rows[0].count} / ${total} (${tirePct}%)`);
  console.log(`  Empty tire sizes:     ${emptyTires.rows[0].count} / ${total} (${emptyPct}%)`);
  console.log(`  Staggered vehicles:   ${staggered.rows[0].count}`);
  
  report.tireSpecs = {
    withTireSizes: { count: parseInt(tireSizes.rows[0].count), percent: parseFloat(tirePct) },
    emptyTireSizes: { count: parseInt(emptyTires.rows[0].count), percent: parseFloat(emptyPct) },
    staggeredVehicles: parseInt(staggered.rows[0].count)
  };

  // ============================================================
  // COVERAGE BY MAKE (Top 20)
  // ============================================================
  console.log('\n🏭 COVERAGE BY MAKE (Top 20)');
  console.log('-'.repeat(70));
  console.log('  Make                 Records   Tires%   Wheels%  Bolt%');
  console.log('  ' + '-'.repeat(66));
  
  const byMake = await client.query(`
    SELECT 
      make,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE oem_tire_sizes IS NOT NULL AND oem_tire_sizes != '[]'::jsonb) as with_tires,
      COUNT(*) FILTER (WHERE oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb) as with_wheels,
      COUNT(*) FILTER (WHERE bolt_pattern IS NOT NULL AND bolt_pattern != '') as with_bolt
    FROM vehicle_fitments
    GROUP BY make
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);
  
  for (const row of byMake.rows) {
    const tPct = ((row.with_tires / row.total) * 100).toFixed(0);
    const wPct = ((row.with_wheels / row.total) * 100).toFixed(0);
    const bPct = ((row.with_bolt / row.total) * 100).toFixed(0);
    console.log(`  ${row.make.padEnd(20)} ${String(row.total).padStart(7)}   ${tPct.padStart(5)}%   ${wPct.padStart(5)}%  ${bPct.padStart(5)}%`);
    
    report.byMake.push({
      make: row.make,
      total: parseInt(row.total),
      tireCoverage: parseFloat(tPct),
      wheelCoverage: parseFloat(wPct),
      boltCoverage: parseFloat(bPct)
    });
  }

  // ============================================================
  // EMPTY RECORDS BY MAKE/MODEL
  // ============================================================
  console.log('\n📭 MODELS WITH MOST EMPTY TIRE DATA');
  console.log('-'.repeat(50));
  
  const emptyByModel = await client.query(`
    SELECT make, model, COUNT(*) as empty_count
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0
    GROUP BY make, model
    ORDER BY COUNT(*) DESC
    LIMIT 25
  `);
  
  for (const row of emptyByModel.rows) {
    console.log(`  ${row.make} ${row.model}: ${row.empty_count} records`);
    report.emptyRecords.push({
      make: row.make,
      model: row.model,
      emptyCount: parseInt(row.empty_count)
    });
  }

  // ============================================================
  // QUALITY ISSUES
  // ============================================================
  console.log('\n⚠️  POTENTIAL QUALITY ISSUES');
  console.log('-'.repeat(50));
  
  // Check for suspicious bolt patterns
  const suspiciousBolt = await client.query(`
    SELECT bolt_pattern, COUNT(*) as count
    FROM vehicle_fitments
    WHERE bolt_pattern IS NOT NULL 
      AND bolt_pattern != ''
      AND bolt_pattern NOT LIKE '%x%'
    GROUP BY bolt_pattern
    ORDER BY COUNT(*) DESC
    LIMIT 5
  `);
  
  if (suspiciousBolt.rows.length > 0) {
    console.log('  Unusual bolt pattern formats:');
    for (const row of suspiciousBolt.rows) {
      console.log(`    "${row.bolt_pattern}": ${row.count} records`);
    }
  }
  
  // Check for future years
  const futureYears = await client.query(`
    SELECT year, COUNT(*) as count
    FROM vehicle_fitments
    WHERE year > 2026
    GROUP BY year
    ORDER BY year
  `);
  
  if (futureYears.rows.length > 0) {
    console.log('  Future years (may be placeholder):');
    for (const row of futureYears.rows) {
      console.log(`    ${row.year}: ${row.count} records`);
      report.qualityIssues.push({ type: 'future_year', year: row.year, count: parseInt(row.count) });
    }
  }
  
  // Check for very old years
  const oldYears = await client.query(`
    SELECT year, COUNT(*) as count
    FROM vehicle_fitments
    WHERE year < 1990
    GROUP BY year
    ORDER BY year
    LIMIT 10
  `);
  
  if (oldYears.rows.length > 0) {
    console.log('  Very old years (<1990):');
    for (const row of oldYears.rows) {
      console.log(`    ${row.year}: ${row.count} records`);
    }
  }

  // ============================================================
  // QUALITY SCORE
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 OVERALL QUALITY SCORE');
  console.log('='.repeat(70));
  
  const tireScore = parseFloat(tirePct);
  const wheelScore = parseFloat(wheelPct);
  const boltScore = parseFloat(boltPct);
  const overallScore = ((tireScore + wheelScore + boltScore) / 3).toFixed(1);
  
  console.log(`
  Tire Data Coverage:    ${tirePct}%  ${getBar(tireScore)}
  Wheel Data Coverage:   ${wheelPct}%  ${getBar(wheelScore)}
  Bolt Pattern Coverage: ${boltPct}%  ${getBar(boltScore)}
  ─────────────────────────────────────────────────
  OVERALL SCORE:         ${overallScore}%  ${getGrade(parseFloat(overallScore))}
  `);
  
  report.qualityScore = {
    tireDataCoverage: parseFloat(tirePct),
    wheelDataCoverage: parseFloat(wheelPct),
    boltPatternCoverage: parseFloat(boltPct),
    overallScore: parseFloat(overallScore),
    grade: getGrade(parseFloat(overallScore))
  };
  
  // Save report
  const reportPath = join(__dirname, 'audit-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: audit-report.json\n`);
  
  await client.end();
}

function getBar(pct) {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getGrade(score) {
  if (score >= 95) return '🏆 A+';
  if (score >= 90) return '🥇 A';
  if (score >= 85) return '🥈 A-';
  if (score >= 80) return '🥉 B+';
  if (score >= 75) return '📗 B';
  if (score >= 70) return '📘 B-';
  if (score >= 65) return '📙 C+';
  if (score >= 60) return '📕 C';
  return '⚠️ Needs Work';
}

main().catch(console.error);
