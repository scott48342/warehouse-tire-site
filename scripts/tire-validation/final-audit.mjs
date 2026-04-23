/**
 * FINAL COMPREHENSIVE AUDIT - Vehicle Fitment Database
 * Validates data quality before fitment engine goes live
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database connection
const POSTGRES_URL = process.env.POSTGRES_URL || 
  "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

const pool = new pg.Pool({ connectionString: POSTGRES_URL });

// Major US makes to audit (lowercase/slug format as stored in DB)
const MAJOR_MAKES = [
  'acura', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet', 'chrysler', 
  'dodge', 'ford', 'genesis', 'gmc', 'honda', 'hyundai', 'infiniti', 
  'jaguar', 'jeep', 'kia', 'land-rover', 'lexus', 'lincoln', 'mazda', 
  'mercedes', 'mini', 'mitsubishi', 'nissan', 'porsche', 'ram', 'subaru', 
  'tesla', 'toyota', 'volkswagen', 'volvo'
];

// Display names for reporting
const MAKE_DISPLAY_NAMES = {
  'acura': 'Acura', 'audi': 'Audi', 'bmw': 'BMW', 'buick': 'Buick',
  'cadillac': 'Cadillac', 'chevrolet': 'Chevrolet', 'chrysler': 'Chrysler',
  'dodge': 'Dodge', 'ford': 'Ford', 'genesis': 'Genesis', 'gmc': 'GMC',
  'honda': 'Honda', 'hyundai': 'Hyundai', 'infiniti': 'Infiniti',
  'jaguar': 'Jaguar', 'jeep': 'Jeep', 'kia': 'Kia', 'land-rover': 'Land Rover',
  'lexus': 'Lexus', 'lincoln': 'Lincoln', 'mazda': 'Mazda',
  'mercedes': 'Mercedes', 'mini': 'Mini', 'mitsubishi': 'Mitsubishi',
  'nissan': 'Nissan', 'porsche': 'Porsche', 'ram': 'Ram', 'subaru': 'Subaru',
  'tesla': 'Tesla', 'toyota': 'Toyota', 'volkswagen': 'Volkswagen', 'volvo': 'Volvo'
};

// Popular models that should definitely exist (lowercase make, slugified model names)
const MUST_HAVE_MODELS = [
  { make: 'toyota', model: 'camry', display: 'Camry' },
  { make: 'toyota', model: 'corolla', display: 'Corolla' },
  { make: 'toyota', model: 'rav4', display: 'RAV4' },
  { make: 'honda', model: 'accord', display: 'Accord' },
  { make: 'honda', model: 'civic', display: 'Civic' },
  { make: 'honda', model: 'cr-v', display: 'CR-V' },
  { make: 'ford', model: 'f-150', display: 'F-150' },
  { make: 'ford', model: 'mustang', display: 'Mustang' },
  { make: 'chevrolet', model: 'silverado', display: 'Silverado' },
  { make: 'chevrolet', model: 'camaro', display: 'Camaro' },
  { make: 'dodge', model: 'challenger', display: 'Challenger' },
  { make: 'dodge', model: 'charger', display: 'Charger' },
  { make: 'jeep', model: 'wrangler', display: 'Wrangler' },
  { make: 'jeep', model: 'grand-cherokee', display: 'Grand Cherokee' },
  { make: 'nissan', model: 'altima', display: 'Altima' },
  { make: 'nissan', model: 'rogue', display: 'Rogue' },
  { make: 'tesla', model: 'model-3', display: 'Model 3' },
  { make: 'tesla', model: 'model-y', display: 'Model Y' },
  { make: 'bmw', model: '3-series', display: '3 Series' },
  { make: 'mercedes', model: 'c-class', display: 'C-Class' },
];

const results = {
  timestamp: new Date().toISOString(),
  summary: {},
  coverage: {},
  wheelSpecs: {},
  tireSpecs: {},
  dataQuality: {},
  deadEnds: {},
  recommendations: []
};

async function runAudit() {
  console.log('🔍 Starting FINAL AUDIT of vehicle fitment database...\n');
  
  try {
    // Basic counts
    await getBasicCounts();
    
    // YMM Coverage Analysis
    await analyzeYMMCoverage();
    
    // Wheel Spec Completeness
    await analyzeWheelSpecs();
    
    // Tire Spec Completeness
    await analyzeTireSpecs();
    
    // Data Quality Checks
    await runDataQualityChecks();
    
    // Dead End Analysis
    await analyzeDeadEnds();
    
    // Generate health score
    calculateHealthScore();
    
    // Generate recommendations
    generateRecommendations();
    
    // Write report
    await writeReport();
    
    console.log('\n✅ Audit complete! Report saved.');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function getBasicCounts() {
  console.log('📊 Getting basic counts...');
  
  const totalRecords = await pool.query('SELECT COUNT(*) FROM vehicle_fitments');
  const uniqueMakes = await pool.query('SELECT COUNT(DISTINCT make) FROM vehicle_fitments');
  const uniqueModels = await pool.query('SELECT COUNT(DISTINCT make || model) FROM vehicle_fitments');
  const yearRange = await pool.query('SELECT MIN(year), MAX(year) FROM vehicle_fitments');
  
  results.summary.totalRecords = parseInt(totalRecords.rows[0].count);
  results.summary.uniqueMakes = parseInt(uniqueMakes.rows[0].count);
  results.summary.uniqueModels = parseInt(uniqueModels.rows[0].count);
  results.summary.yearRange = {
    min: yearRange.rows[0].min,
    max: yearRange.rows[0].max
  };
  
  console.log(`  Total records: ${results.summary.totalRecords.toLocaleString()}`);
  console.log(`  Unique makes: ${results.summary.uniqueMakes}`);
  console.log(`  Unique models: ${results.summary.uniqueModels}`);
  console.log(`  Year range: ${results.summary.yearRange.min}-${results.summary.yearRange.max}`);
}

async function analyzeYMMCoverage() {
  console.log('\n📈 Analyzing YMM coverage (2000-2026)...');
  
  results.coverage.byMake = {};
  results.coverage.missingRecentYears = [];
  results.coverage.yearGaps = [];
  
  for (const make of MAJOR_MAKES) {
    const displayMake = MAKE_DISPLAY_NAMES[make] || make;
    
    // Get all models and years for this make (case-insensitive)
    const modelsQuery = await pool.query(`
      SELECT DISTINCT model, 
             array_agg(DISTINCT year ORDER BY year) as years,
             COUNT(DISTINCT year) as year_count,
             COUNT(*) as total_records
      FROM vehicle_fitments
      WHERE LOWER(make) = LOWER($1) AND year >= 2000 AND year <= 2026
      GROUP BY model
      ORDER BY model
    `, [make]);
    
    const makeStats = {
      totalRecords: 0,
      modelCount: modelsQuery.rows.length,
      yearsWithData: new Set(),
      models: [],
      missingRecentYears: [],
      yearGaps: []
    };
    
    for (const row of modelsQuery.rows) {
      const years = row.years.map(Number);
      makeStats.totalRecords += parseInt(row.total_records);
      years.forEach(y => makeStats.yearsWithData.add(y));
      
      makeStats.models.push({
        name: row.model,
        yearCount: row.year_count,
        years: years,
        recordCount: parseInt(row.total_records)
      });
      
      // Check for missing recent years (2024-2026)
      const recentYears = [2024, 2025, 2026];
      const missingRecent = recentYears.filter(y => !years.includes(y));
      if (missingRecent.length > 0 && years.includes(2023)) {
        // Only flag if model has 2023 but missing 2024+
        makeStats.missingRecentYears.push({
          model: row.model,
          lastYear: Math.max(...years),
          missing: missingRecent
        });
      }
      
      // Check for year gaps (non-consecutive years)
      const sortedYears = [...years].sort((a, b) => a - b);
      for (let i = 1; i < sortedYears.length; i++) {
        const gap = sortedYears[i] - sortedYears[i-1];
        if (gap > 1) {
          makeStats.yearGaps.push({
            model: row.model,
            gapStart: sortedYears[i-1],
            gapEnd: sortedYears[i],
            missingYears: gap - 1
          });
        }
      }
    }
    
    makeStats.yearsWithData = makeStats.yearsWithData.size;
    results.coverage.byMake[displayMake] = makeStats;
    
    // Add to global lists
    if (makeStats.missingRecentYears.length > 0) {
      results.coverage.missingRecentYears.push(...makeStats.missingRecentYears.map(m => ({
        make: displayMake, ...m
      })));
    }
    if (makeStats.yearGaps.length > 0) {
      results.coverage.yearGaps.push(...makeStats.yearGaps.map(g => ({
        make: displayMake, ...g
      })));
    }
    
    console.log(`  ${displayMake}: ${makeStats.modelCount} models, ${makeStats.totalRecords.toLocaleString()} records, ${makeStats.yearsWithData}/27 years`);
  }
}

async function analyzeWheelSpecs() {
  console.log('\n🔧 Analyzing wheel spec completeness...');
  
  const total = results.summary.totalRecords;
  
  // Bolt pattern
  const boltPattern = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE bolt_pattern IS NOT NULL AND bolt_pattern != ''
  `);
  
  // Center bore
  const centerBore = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE center_bore_mm IS NOT NULL
  `);
  
  // Thread size
  const threadSize = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE thread_size IS NOT NULL AND thread_size != ''
  `);
  
  // Offset range
  const offsetMin = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE offset_min_mm IS NOT NULL
  `);
  const offsetMax = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE offset_max_mm IS NOT NULL
  `);
  
  // OEM wheel sizes (non-empty array)
  const oemWheelSizes = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE oem_wheel_sizes IS NOT NULL 
      AND oem_wheel_sizes != '[]'::jsonb 
      AND jsonb_array_length(oem_wheel_sizes) > 0
  `);
  
  results.wheelSpecs = {
    boltPattern: {
      count: parseInt(boltPattern.rows[0].count),
      percentage: (parseInt(boltPattern.rows[0].count) / total * 100).toFixed(2)
    },
    centerBore: {
      count: parseInt(centerBore.rows[0].count),
      percentage: (parseInt(centerBore.rows[0].count) / total * 100).toFixed(2)
    },
    threadSize: {
      count: parseInt(threadSize.rows[0].count),
      percentage: (parseInt(threadSize.rows[0].count) / total * 100).toFixed(2)
    },
    offsetMin: {
      count: parseInt(offsetMin.rows[0].count),
      percentage: (parseInt(offsetMin.rows[0].count) / total * 100).toFixed(2)
    },
    offsetMax: {
      count: parseInt(offsetMax.rows[0].count),
      percentage: (parseInt(offsetMax.rows[0].count) / total * 100).toFixed(2)
    },
    oemWheelSizes: {
      count: parseInt(oemWheelSizes.rows[0].count),
      percentage: (parseInt(oemWheelSizes.rows[0].count) / total * 100).toFixed(2)
    }
  };
  
  console.log(`  bolt_pattern: ${results.wheelSpecs.boltPattern.percentage}%`);
  console.log(`  center_bore_mm: ${results.wheelSpecs.centerBore.percentage}%`);
  console.log(`  thread_size: ${results.wheelSpecs.threadSize.percentage}%`);
  console.log(`  offset_min_mm: ${results.wheelSpecs.offsetMin.percentage}%`);
  console.log(`  offset_max_mm: ${results.wheelSpecs.offsetMax.percentage}%`);
  console.log(`  oem_wheel_sizes (non-empty): ${results.wheelSpecs.oemWheelSizes.percentage}%`);
}

async function analyzeTireSpecs() {
  console.log('\n🛞 Analyzing tire spec completeness...');
  
  const total = results.summary.totalRecords;
  
  // OEM tire sizes (non-empty array)
  const oemTireSizes = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb 
      AND jsonb_array_length(oem_tire_sizes) > 0
  `);
  
  // Records with wheel sizes but no tire sizes
  const wheelsNoTires = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND jsonb_array_length(oem_wheel_sizes) > 0)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0)
  `);
  
  // Sample of vehicles with wheels but no tires
  const wheelsNoTiresSample = await pool.query(`
    SELECT year, make, model, display_trim, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE (oem_wheel_sizes IS NOT NULL AND oem_wheel_sizes != '[]'::jsonb AND jsonb_array_length(oem_wheel_sizes) > 0)
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR jsonb_array_length(oem_tire_sizes) = 0)
    ORDER BY year DESC, make, model
    LIMIT 20
  `);
  
  results.tireSpecs = {
    oemTireSizes: {
      count: parseInt(oemTireSizes.rows[0].count),
      percentage: (parseInt(oemTireSizes.rows[0].count) / total * 100).toFixed(2)
    },
    wheelsWithoutTires: {
      count: parseInt(wheelsNoTires.rows[0].count),
      percentage: (parseInt(wheelsNoTires.rows[0].count) / total * 100).toFixed(2),
      samples: wheelsNoTiresSample.rows
    }
  };
  
  console.log(`  oem_tire_sizes (non-empty): ${results.tireSpecs.oemTireSizes.percentage}%`);
  console.log(`  ⚠️ Records with wheels but NO tires: ${results.tireSpecs.wheelsWithoutTires.count.toLocaleString()} (${results.tireSpecs.wheelsWithoutTires.percentage}%)`);
}

async function runDataQualityChecks() {
  console.log('\n🔍 Running data quality checks...');
  
  // Duplicates check
  const duplicates = await pool.query(`
    SELECT year, make, model, modification_id, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY year, make, model, modification_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 50
  `);
  
  // Year range sanity
  const invalidYears = await pool.query(`
    SELECT year, COUNT(*) as count
    FROM vehicle_fitments
    WHERE year < 2000 OR year > 2026
    GROUP BY year
    ORDER BY year
  `);
  
  // Models with suspiciously few trims (1 trim only)
  const fewTrims = await pool.query(`
    SELECT make, model, COUNT(DISTINCT modification_id) as trim_count
    FROM vehicle_fitments
    WHERE year >= 2020
    GROUP BY make, model
    HAVING COUNT(DISTINCT modification_id) = 1
    ORDER BY make, model
    LIMIT 50
  `);
  
  // Empty critical fields
  const emptyBoltPattern = await pool.query(`
    SELECT COUNT(*) FROM vehicle_fitments 
    WHERE bolt_pattern IS NULL OR bolt_pattern = ''
  `);
  
  // Quality tier distribution
  const qualityTiers = await pool.query(`
    SELECT quality_tier, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY quality_tier
    ORDER BY count DESC
  `);
  
  results.dataQuality = {
    duplicates: {
      count: duplicates.rows.length,
      samples: duplicates.rows.slice(0, 20)
    },
    invalidYears: {
      count: invalidYears.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
      details: invalidYears.rows
    },
    fewTrims: {
      count: fewTrims.rows.length,
      samples: fewTrims.rows.slice(0, 20)
    },
    emptyBoltPattern: {
      count: parseInt(emptyBoltPattern.rows[0].count),
      percentage: (parseInt(emptyBoltPattern.rows[0].count) / results.summary.totalRecords * 100).toFixed(2)
    },
    qualityTiers: qualityTiers.rows.map(r => ({
      tier: r.quality_tier || 'null',
      count: parseInt(r.count)
    }))
  };
  
  console.log(`  Duplicate entries: ${results.dataQuality.duplicates.count}`);
  console.log(`  Invalid years (<2000 or >2026): ${results.dataQuality.invalidYears.count}`);
  console.log(`  Models with only 1 trim (2020+): ${results.dataQuality.fewTrims.count}`);
  console.log(`  Empty bolt patterns: ${results.dataQuality.emptyBoltPattern.count.toLocaleString()} (${results.dataQuality.emptyBoltPattern.percentage}%)`);
  console.log(`  Quality tier distribution:`);
  for (const tier of results.dataQuality.qualityTiers) {
    console.log(`    - ${tier.tier}: ${tier.count.toLocaleString()}`);
  }
}

async function analyzeDeadEnds() {
  console.log('\n🚫 Analyzing dead ends...');
  
  // Makes with < 50 records
  const smallMakes = await pool.query(`
    SELECT make, COUNT(*) as count
    FROM vehicle_fitments
    GROUP BY make
    HAVING COUNT(*) < 50
    ORDER BY count
  `);
  
  // Models that exist for only 1 year
  const singleYearModels = await pool.query(`
    SELECT make, model, MIN(year) as only_year, COUNT(*) as record_count
    FROM vehicle_fitments
    GROUP BY make, model
    HAVING COUNT(DISTINCT year) = 1
    ORDER BY make, model
    LIMIT 100
  `);
  
  // Check for must-have models (exact match on slugified names)
  const missingPopular = [];
  for (const { make, model, display } of MUST_HAVE_MODELS) {
    const check = await pool.query(`
      SELECT COUNT(*) FROM vehicle_fitments
      WHERE LOWER(make) = LOWER($1) AND (LOWER(model) = LOWER($2) OR LOWER(model) LIKE LOWER($3))
    `, [make, model, `%${model}%`]);
    
    if (parseInt(check.rows[0].count) === 0) {
      missingPopular.push({ make: MAKE_DISPLAY_NAMES[make] || make, model: display || model });
    }
  }
  
  // Check for makes with zero records
  const missingMakes = [];
  for (const make of MAJOR_MAKES) {
    const check = await pool.query(`
      SELECT COUNT(*) FROM vehicle_fitments WHERE LOWER(make) = LOWER($1)
    `, [make]);
    
    if (parseInt(check.rows[0].count) === 0) {
      missingMakes.push(MAKE_DISPLAY_NAMES[make] || make);
    }
  }
  
  results.deadEnds = {
    smallMakes: smallMakes.rows.map(r => ({
      make: r.make,
      count: parseInt(r.count)
    })),
    singleYearModels: {
      count: singleYearModels.rows.length,
      samples: singleYearModels.rows.slice(0, 30)
    },
    missingPopularModels: missingPopular,
    missingMakes: missingMakes
  };
  
  console.log(`  Makes with < 50 records: ${results.deadEnds.smallMakes.length}`);
  for (const m of results.deadEnds.smallMakes.slice(0, 10)) {
    console.log(`    - ${m.make}: ${m.count} records`);
  }
  console.log(`  Models existing for only 1 year: ${results.deadEnds.singleYearModels.count}`);
  console.log(`  Missing popular models: ${results.deadEnds.missingPopularModels.length}`);
  for (const m of results.deadEnds.missingPopularModels) {
    console.log(`    - ${m.make} ${m.model}`);
  }
  console.log(`  Missing major makes: ${results.deadEnds.missingMakes.length}`);
  for (const m of results.deadEnds.missingMakes) {
    console.log(`    - ${m}`);
  }
}

function calculateHealthScore() {
  console.log('\n📊 Calculating overall health score...');
  
  // Scoring weights
  const scores = {
    coverage: 0,        // 30 points max
    wheelSpecs: 0,      // 25 points max
    tireSpecs: 0,       // 25 points max
    dataQuality: 0,     // 20 points max
  };
  
  // Coverage score (30 points)
  // - Total records > 50000 = 10 points
  // - All major makes present = 10 points
  // - Good year coverage = 10 points
  if (results.summary.totalRecords > 50000) scores.coverage += 10;
  else if (results.summary.totalRecords > 20000) scores.coverage += 5;
  
  const missingMakesPenalty = results.deadEnds.missingMakes.length * 2;
  scores.coverage += Math.max(0, 10 - missingMakesPenalty);
  
  const avgYearCoverage = Object.values(results.coverage.byMake)
    .reduce((sum, m) => sum + (m.yearsWithData || 0), 0) / MAJOR_MAKES.length;
  scores.coverage += Math.min(10, avgYearCoverage / 27 * 10);
  
  // Wheel specs score (25 points)
  const wheelPcts = [
    parseFloat(results.wheelSpecs.boltPattern.percentage),
    parseFloat(results.wheelSpecs.centerBore.percentage),
    parseFloat(results.wheelSpecs.threadSize.percentage),
    parseFloat(results.wheelSpecs.oemWheelSizes.percentage),
  ];
  const avgWheelPct = wheelPcts.reduce((a, b) => a + b, 0) / wheelPcts.length;
  scores.wheelSpecs = avgWheelPct / 100 * 25;
  
  // Tire specs score (25 points)
  const tirePct = parseFloat(results.tireSpecs.oemTireSizes.percentage);
  scores.tireSpecs = tirePct / 100 * 25;
  
  // Data quality score (20 points)
  // Penalties for issues
  let qualityScore = 20;
  if (results.dataQuality.duplicates.count > 0) qualityScore -= Math.min(5, results.dataQuality.duplicates.count);
  if (results.dataQuality.invalidYears.count > 0) qualityScore -= Math.min(5, results.dataQuality.invalidYears.count / 100);
  if (results.deadEnds.missingPopularModels.length > 0) qualityScore -= results.deadEnds.missingPopularModels.length;
  scores.dataQuality = Math.max(0, qualityScore);
  
  // Total score
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  results.summary.healthScore = {
    total: Math.round(totalScore),
    maxPossible: 100,
    breakdown: {
      coverage: Math.round(scores.coverage),
      wheelSpecs: Math.round(scores.wheelSpecs),
      tireSpecs: Math.round(scores.tireSpecs),
      dataQuality: Math.round(scores.dataQuality)
    },
    grade: totalScore >= 90 ? 'A' : totalScore >= 80 ? 'B' : totalScore >= 70 ? 'C' : totalScore >= 60 ? 'D' : 'F'
  };
  
  console.log(`  Total Health Score: ${results.summary.healthScore.total}/100 (Grade: ${results.summary.healthScore.grade})`);
  console.log(`    Coverage: ${results.summary.healthScore.breakdown.coverage}/30`);
  console.log(`    Wheel Specs: ${results.summary.healthScore.breakdown.wheelSpecs}/25`);
  console.log(`    Tire Specs: ${results.summary.healthScore.breakdown.tireSpecs}/25`);
  console.log(`    Data Quality: ${results.summary.healthScore.breakdown.dataQuality}/20`);
}

function generateRecommendations() {
  console.log('\n💡 Generating recommendations...');
  
  const recs = [];
  
  // Coverage recommendations
  if (results.deadEnds.missingMakes.length > 0) {
    recs.push({
      priority: 'CRITICAL',
      category: 'Coverage',
      issue: `Missing ${results.deadEnds.missingMakes.length} major makes: ${results.deadEnds.missingMakes.join(', ')}`,
      action: 'Import fitment data for these makes immediately'
    });
  }
  
  if (results.deadEnds.missingPopularModels.length > 0) {
    recs.push({
      priority: 'HIGH',
      category: 'Coverage',
      issue: `Missing ${results.deadEnds.missingPopularModels.length} popular models`,
      action: `Import data for: ${results.deadEnds.missingPopularModels.map(m => `${m.make} ${m.model}`).join(', ')}`
    });
  }
  
  if (results.coverage.missingRecentYears.length > 10) {
    recs.push({
      priority: 'HIGH',
      category: 'Coverage',
      issue: `${results.coverage.missingRecentYears.length} models missing 2024-2026 data`,
      action: 'Run targeted import for recent model years'
    });
  }
  
  // Wheel spec recommendations
  if (parseFloat(results.wheelSpecs.boltPattern.percentage) < 90) {
    recs.push({
      priority: 'HIGH',
      category: 'Wheel Specs',
      issue: `Only ${results.wheelSpecs.boltPattern.percentage}% have bolt pattern`,
      action: 'Bolt pattern is critical for fitment - prioritize filling this data'
    });
  }
  
  if (parseFloat(results.wheelSpecs.oemWheelSizes.percentage) < 80) {
    recs.push({
      priority: 'MEDIUM',
      category: 'Wheel Specs',
      issue: `Only ${results.wheelSpecs.oemWheelSizes.percentage}% have OEM wheel sizes`,
      action: 'Import wheel size data from manufacturer sources'
    });
  }
  
  // Tire spec recommendations
  if (parseFloat(results.tireSpecs.oemTireSizes.percentage) < 80) {
    recs.push({
      priority: 'HIGH',
      category: 'Tire Specs',
      issue: `Only ${results.tireSpecs.oemTireSizes.percentage}% have OEM tire sizes`,
      action: 'Tire sizes are essential for search - prioritize this data'
    });
  }
  
  if (results.tireSpecs.wheelsWithoutTires.count > 1000) {
    recs.push({
      priority: 'MEDIUM',
      category: 'Tire Specs',
      issue: `${results.tireSpecs.wheelsWithoutTires.count.toLocaleString()} records have wheel sizes but no tire sizes`,
      action: 'Cross-reference wheel diameters to derive appropriate tire sizes'
    });
  }
  
  // Data quality recommendations
  if (results.dataQuality.duplicates.count > 0) {
    recs.push({
      priority: 'MEDIUM',
      category: 'Data Quality',
      issue: `${results.dataQuality.duplicates.count} duplicate entries found`,
      action: 'Run deduplication script to clean up duplicates'
    });
  }
  
  if (results.dataQuality.invalidYears.count > 0) {
    recs.push({
      priority: 'LOW',
      category: 'Data Quality',
      issue: `${results.dataQuality.invalidYears.count} records with years outside 2000-2026`,
      action: 'Review and clean up invalid year data'
    });
  }
  
  results.recommendations = recs;
  
  console.log(`  Generated ${recs.length} recommendations`);
  for (const rec of recs) {
    console.log(`    [${rec.priority}] ${rec.category}: ${rec.issue}`);
  }
}

async function writeReport() {
  const reportPath = path.join(__dirname, 'FINAL_AUDIT_REPORT.md');
  
  let report = `# 🔍 Vehicle Fitment Database - FINAL AUDIT REPORT

**Generated:** ${new Date().toLocaleString()}  
**Database:** Prisma Postgres (Neon)  
**Table:** vehicle_fitments

---

## 📊 Executive Summary

### Overall Health Score: ${results.summary.healthScore.total}/100 (Grade: ${results.summary.healthScore.grade})

| Category | Score | Max |
|----------|-------|-----|
| Coverage | ${results.summary.healthScore.breakdown.coverage} | 30 |
| Wheel Specs | ${results.summary.healthScore.breakdown.wheelSpecs} | 25 |
| Tire Specs | ${results.summary.healthScore.breakdown.tireSpecs} | 25 |
| Data Quality | ${results.summary.healthScore.breakdown.dataQuality} | 20 |

### Quick Stats
- **Total Records:** ${results.summary.totalRecords.toLocaleString()}
- **Unique Makes:** ${results.summary.uniqueMakes}
- **Unique Models:** ${results.summary.uniqueModels}
- **Year Range:** ${results.summary.yearRange.min} - ${results.summary.yearRange.max}

---

## 📈 YMM Coverage Analysis (2000-2026)

### Coverage by Make

| Make | Models | Records | Years Covered (/27) |
|------|--------|---------|---------------------|
`;

  // Sort makes by record count
  const sortedMakes = Object.entries(results.coverage.byMake)
    .sort((a, b) => b[1].totalRecords - a[1].totalRecords);
  
  for (const [make, stats] of sortedMakes) {
    report += `| ${make} | ${stats.modelCount} | ${stats.totalRecords.toLocaleString()} | ${stats.yearsWithData} |\n`;
  }

  // Missing recent years section
  if (results.coverage.missingRecentYears.length > 0) {
    report += `
### ⚠️ Models Missing Recent Years (2024-2026)

These models have 2023 data but are missing 2024-2026:

| Make | Model | Last Year | Missing Years |
|------|-------|-----------|---------------|
`;
    for (const item of results.coverage.missingRecentYears.slice(0, 50)) {
      report += `| ${item.make} | ${item.model} | ${item.lastYear} | ${item.missing.join(', ')} |\n`;
    }
    if (results.coverage.missingRecentYears.length > 50) {
      report += `\n*...and ${results.coverage.missingRecentYears.length - 50} more*\n`;
    }
  }

  // Year gaps section
  if (results.coverage.yearGaps.length > 0) {
    report += `
### 🕳️ Year Gaps in Model Coverage

| Make | Model | Gap Start | Gap End | Missing Years |
|------|-------|-----------|---------|---------------|
`;
    for (const gap of results.coverage.yearGaps.slice(0, 30)) {
      report += `| ${gap.make} | ${gap.model} | ${gap.gapStart} | ${gap.gapEnd} | ${gap.missingYears} |\n`;
    }
    if (results.coverage.yearGaps.length > 30) {
      report += `\n*...and ${results.coverage.yearGaps.length - 30} more gaps*\n`;
    }
  }

  report += `
---

## 🔧 Wheel Spec Completeness

| Field | Records | Percentage |
|-------|---------|------------|
| bolt_pattern | ${results.wheelSpecs.boltPattern.count.toLocaleString()} | ${results.wheelSpecs.boltPattern.percentage}% |
| center_bore_mm | ${results.wheelSpecs.centerBore.count.toLocaleString()} | ${results.wheelSpecs.centerBore.percentage}% |
| thread_size | ${results.wheelSpecs.threadSize.count.toLocaleString()} | ${results.wheelSpecs.threadSize.percentage}% |
| offset_min_mm | ${results.wheelSpecs.offsetMin.count.toLocaleString()} | ${results.wheelSpecs.offsetMin.percentage}% |
| offset_max_mm | ${results.wheelSpecs.offsetMax.count.toLocaleString()} | ${results.wheelSpecs.offsetMax.percentage}% |
| oem_wheel_sizes (non-empty) | ${results.wheelSpecs.oemWheelSizes.count.toLocaleString()} | ${results.wheelSpecs.oemWheelSizes.percentage}% |

---

## 🛞 Tire Spec Completeness

| Metric | Count | Percentage |
|--------|-------|------------|
| oem_tire_sizes (non-empty) | ${results.tireSpecs.oemTireSizes.count.toLocaleString()} | ${results.tireSpecs.oemTireSizes.percentage}% |
| **Records with wheels but NO tires** | ${results.tireSpecs.wheelsWithoutTires.count.toLocaleString()} | ${results.tireSpecs.wheelsWithoutTires.percentage}% |

`;

  if (results.tireSpecs.wheelsWithoutTires.samples.length > 0) {
    report += `### Sample Records with Wheels but No Tires

| Year | Make | Model | Trim | Wheel Sizes |
|------|------|-------|------|-------------|
`;
    for (const r of results.tireSpecs.wheelsWithoutTires.samples) {
      const wheelSizes = Array.isArray(r.oem_wheel_sizes) 
        ? r.oem_wheel_sizes.map(w => w.diameter ? `${w.diameter}"` : 'unknown').join(', ')
        : 'N/A';
      report += `| ${r.year} | ${r.make} | ${r.model} | ${r.display_trim || 'N/A'} | ${wheelSizes} |\n`;
    }
  }

  report += `
---

## 🔍 Data Quality Checks

### Quality Tier Distribution

| Tier | Count |
|------|-------|
`;
  for (const tier of results.dataQuality.qualityTiers) {
    report += `| ${tier.tier} | ${tier.count.toLocaleString()} |\n`;
  }

  report += `
### Issues Found

- **Duplicate Entries:** ${results.dataQuality.duplicates.count}
- **Invalid Years (<2000 or >2026):** ${results.dataQuality.invalidYears.count}
- **Models with Only 1 Trim (2020+):** ${results.dataQuality.fewTrims.count}
- **Empty Bolt Patterns:** ${results.dataQuality.emptyBoltPattern.count.toLocaleString()} (${results.dataQuality.emptyBoltPattern.percentage}%)
`;

  if (results.dataQuality.duplicates.samples.length > 0) {
    report += `
### Sample Duplicates

| Year | Make | Model | Modification ID | Count |
|------|------|-------|-----------------|-------|
`;
    for (const d of results.dataQuality.duplicates.samples) {
      report += `| ${d.year} | ${d.make} | ${d.model} | ${d.modification_id} | ${d.count} |\n`;
    }
  }

  report += `
---

## 🚫 Dead End Analysis

### Makes with < 50 Records (Potentially Incomplete)

`;
  if (results.deadEnds.smallMakes.length === 0) {
    report += `✅ No makes with < 50 records\n`;
  } else {
    report += `| Make | Records |\n|------|--------|\n`;
    for (const m of results.deadEnds.smallMakes) {
      report += `| ${m.make} | ${m.count} |\n`;
    }
  }

  report += `
### Missing Major Makes

`;
  if (results.deadEnds.missingMakes.length === 0) {
    report += `✅ All major makes present\n`;
  } else {
    report += `⚠️ Missing: ${results.deadEnds.missingMakes.join(', ')}\n`;
  }

  report += `
### Missing Popular Models

`;
  if (results.deadEnds.missingPopularModels.length === 0) {
    report += `✅ All popular models present\n`;
  } else {
    for (const m of results.deadEnds.missingPopularModels) {
      report += `- ❌ ${m.make} ${m.model}\n`;
    }
  }

  report += `
### Single-Year Models (${results.deadEnds.singleYearModels.count} total)

Models that only exist for 1 year (potential data errors):

| Make | Model | Year | Records |
|------|-------|------|---------|
`;
  for (const m of results.deadEnds.singleYearModels.samples) {
    report += `| ${m.make} | ${m.model} | ${m.only_year} | ${m.record_count} |\n`;
  }

  report += `
---

## 💡 Recommendations

`;

  // Group recommendations by priority
  const critical = results.recommendations.filter(r => r.priority === 'CRITICAL');
  const high = results.recommendations.filter(r => r.priority === 'HIGH');
  const medium = results.recommendations.filter(r => r.priority === 'MEDIUM');
  const low = results.recommendations.filter(r => r.priority === 'LOW');

  if (critical.length > 0) {
    report += `### 🚨 CRITICAL\n`;
    for (const r of critical) {
      report += `- **[${r.category}]** ${r.issue}\n  - Action: ${r.action}\n\n`;
    }
  }

  if (high.length > 0) {
    report += `### ⚠️ HIGH Priority\n`;
    for (const r of high) {
      report += `- **[${r.category}]** ${r.issue}\n  - Action: ${r.action}\n\n`;
    }
  }

  if (medium.length > 0) {
    report += `### 📋 MEDIUM Priority\n`;
    for (const r of medium) {
      report += `- **[${r.category}]** ${r.issue}\n  - Action: ${r.action}\n\n`;
    }
  }

  if (low.length > 0) {
    report += `### 📝 LOW Priority\n`;
    for (const r of low) {
      report += `- **[${r.category}]** ${r.issue}\n  - Action: ${r.action}\n\n`;
    }
  }

  report += `
---

## 📋 Next Steps

1. ${results.summary.healthScore.grade === 'A' || results.summary.healthScore.grade === 'B' 
    ? '✅ Database is ready for production with minor cleanup tasks'
    : '⚠️ Address CRITICAL and HIGH priority issues before going live'}
2. Address any CRITICAL issues immediately
3. Create import jobs for missing makes/models
4. Run tire size derivation for records with wheels but no tires
5. Schedule regular data quality audits (weekly recommended)

---

*Report generated by final-audit.mjs*
`;

  // Also save raw JSON results
  const jsonPath = path.join(__dirname, 'FINAL_AUDIT_RESULTS.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  
  fs.writeFileSync(reportPath, report);
  
  console.log(`\n📄 Report saved to: ${reportPath}`);
  console.log(`📄 Raw data saved to: ${jsonPath}`);
}

// Run the audit
runAudit().catch(console.error);
