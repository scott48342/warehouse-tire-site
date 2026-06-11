/**
 * May 7, 2026 Import Disposition Analysis
 * 
 * Classifies unknown-tier 2018 records from May 7 import into:
 * 1. duplicate_safe_delete - Duplicates of existing certified records
 * 2. unique_needs_review - Unique records needing human review
 * 3. missing_required_wheel_fields - Missing bolt_pattern, center_bore, etc.
 * 4. lowercase_make_needs_canonicalization - Make is lowercase (e.g., "ford")
 * 5. malformed_make_needs_split - Make contains real make + category suffix (e.g., "Chevrolet Minivans")
 * 6. phantom_make_delete_candidate - Invalid/non-existent makes
 * 
 * READ-ONLY: Does not modify the database
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envMatch = envContent.match(/POSTGRES_URL="([^"]+)"/);
if (!envMatch) throw new Error('POSTGRES_URL not found in .env.local');

const pool = new pg.Pool({
  connectionString: envMatch[1],
  ssl: { rejectUnauthorized: false }
});

// Known canonical makes (proper casing)
const CANONICAL_MAKES = new Set([
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti',
  'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat',
  'Ford', 'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep',
  'Karma', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati',
  'Mazda', 'McLaren', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Pagani',
  'Porsche', 'Ram', 'Rolls-Royce', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen',
  'Volvo', 'smart', 'HUMMER', 'Saab', 'Saturn', 'Scion', 'Suzuki', 'Pontiac',
  'Mercury', 'Oldsmobile', 'Plymouth', 'Isuzu', 'Daewoo', 'Eagle', 'Geo',
  'AM General', 'Maybach', 'Morgan', 'Panoz', 'Polestar', 'Rivian', 'Lucid'
]);

// Category suffixes that get appended to makes in malformed data
const CATEGORY_SUFFIXES = [
  'Minivans', 'Vans', 'Trucks', 'SUVs', 'Crossovers', 'Sedans', 'Coupes',
  'Convertibles', 'Wagons', 'Hatchbacks', 'Pickup', 'Pickups'
];

// Lowercase version for matching
const CANONICAL_MAKES_LOWER = new Map();
for (const make of CANONICAL_MAKES) {
  CANONICAL_MAKES_LOWER.set(make.toLowerCase(), make);
}

// Results structure
const results = {
  duplicate_safe_delete: [],
  unique_needs_review: [],
  missing_required_wheel_fields: [],
  lowercase_make_needs_canonicalization: [],
  malformed_make_needs_split: [],
  phantom_make_delete_candidate: []
};

/**
 * Check if make contains a real make + category suffix
 * Returns { baseMake, canonicalMake, suffix } or null
 */
function detectMalformedMake(make) {
  if (!make) return null;
  
  for (const suffix of CATEGORY_SUFFIXES) {
    // Check if make ends with suffix (case-insensitive)
    const suffixLower = suffix.toLowerCase();
    const makeLower = make.toLowerCase();
    
    if (makeLower.endsWith(' ' + suffixLower)) {
      const baseMake = make.slice(0, -(suffix.length + 1)).trim();
      const baseMakeLower = baseMake.toLowerCase();
      
      // Check if the base part is a real make
      if (CANONICAL_MAKES_LOWER.has(baseMakeLower)) {
        return {
          baseMake: baseMake,
          canonicalMake: CANONICAL_MAKES_LOWER.get(baseMakeLower),
          suffix: suffix
        };
      }
    }
  }
  
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  May 7, 2026 Import Disposition Analysis');
  console.log('  Target: 2018 vehicles with unknown quality tier');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const client = await pool.connect();
  
  try {
    // Step 1: Find all May 7, 2026 unknown-tier 2018 records
    console.log('📊 Finding May 7 unknown-tier 2018 records...\n');
    
    const may7Records = await client.query(`
      SELECT 
        id, year, make, model, display_trim, raw_trim, submodel,
        modification_id, bolt_pattern, center_bore_mm, thread_size,
        seat_type, offset_min_mm, offset_max_mm, oem_wheel_sizes,
        oem_tire_sizes, source, quality_tier, certification_status,
        confidence_tag, created_at
      FROM vehicle_fitments
      WHERE year = 2018
        AND (quality_tier IS NULL OR quality_tier = '' OR LOWER(quality_tier) = 'unknown')
        AND created_at >= '2026-05-07 00:00:00'
        AND created_at < '2026-05-08 00:00:00'
      ORDER BY make, model, display_trim
    `);

    console.log(`Found ${may7Records.rows.length} May 7 unknown-tier 2018 records\n`);

    if (may7Records.rows.length === 0) {
      console.log('No records to analyze. Exiting.');
      return;
    }

    // Step 2: Get all existing certified/good records for 2018 (for duplicate detection)
    console.log('📋 Loading existing certified 2018 records for comparison...\n');
    
    const certifiedRecords = await client.query(`
      SELECT 
        id, year, make, model, display_trim, modification_id,
        bolt_pattern, center_bore_mm, oem_wheel_sizes, oem_tire_sizes,
        quality_tier, created_at
      FROM vehicle_fitments
      WHERE year = 2018
        AND quality_tier IS NOT NULL 
        AND quality_tier != ''
        AND LOWER(quality_tier) != 'unknown'
    `);

    console.log(`Found ${certifiedRecords.rows.length} certified 2018 records\n`);

    // Build lookup maps for certified records
    const certifiedByYMM = new Map(); // year|make|model -> records[]
    const certifiedByModId = new Map(); // modification_id -> record
    
    for (const rec of certifiedRecords.rows) {
      const ymmKey = `${rec.year}|${rec.make}|${rec.model}`.toLowerCase();
      if (!certifiedByYMM.has(ymmKey)) {
        certifiedByYMM.set(ymmKey, []);
      }
      certifiedByYMM.get(ymmKey).push(rec);
      
      if (rec.modification_id) {
        certifiedByModId.set(rec.modification_id.toLowerCase(), rec);
      }
    }

    // Step 3: Classify each May 7 record
    console.log('🔍 Classifying records...\n');

    for (const rec of may7Records.rows) {
      const categories = classifyRecord(rec, certifiedByYMM, certifiedByModId);
      
      for (const category of categories) {
        results[category].push(rec);
      }
    }

    // Step 4: Print summary
    console.log('\n' + '═'.repeat(65));
    console.log('  CLASSIFICATION RESULTS');
    console.log('═'.repeat(65) + '\n');

    const categoryDescriptions = {
      duplicate_safe_delete: 'Duplicates of certified records (safe to delete)',
      unique_needs_review: 'Unique records needing human review',
      missing_required_wheel_fields: 'Missing required wheel fitment fields',
      lowercase_make_needs_canonicalization: 'Lowercase make needs proper casing',
      malformed_make_needs_split: 'Make contains real make + category suffix (needs splitting)',
      phantom_make_delete_candidate: 'Invalid/unrecognized makes (delete candidates)'
    };

    for (const [category, records] of Object.entries(results)) {
      console.log(`\n📁 ${category}`);
      console.log(`   ${categoryDescriptions[category]}`);
      console.log(`   Count: ${records.length}`);
      
      if (records.length > 0) {
        console.log('\n   Sample records:');
        const samples = records.slice(0, 5);
        for (const rec of samples) {
          console.log(`   - ${rec.year} ${rec.make} ${rec.model} "${rec.display_trim}"`);
          if (category === 'missing_required_wheel_fields') {
            console.log(`     bolt_pattern: ${rec.bolt_pattern || 'NULL'}, center_bore: ${rec.center_bore_mm || 'NULL'}`);
          }
          if (category === 'lowercase_make_needs_canonicalization') {
            const canonical = CANONICAL_MAKES_LOWER.get(rec.make.toLowerCase());
            console.log(`     Should be: "${canonical || 'UNKNOWN'}"`);
          }
          if (category === 'malformed_make_needs_split') {
            const info = rec._malformedMakeInfo;
            console.log(`     Should be: "${info.canonicalMake}" (strip suffix: "${info.suffix}")`);
          }
        }
      }
    }

    // Step 5: Write CSV files
    console.log('\n\n📝 Writing CSV files...\n');
    
    const outputDir = path.join(__dirname, 'may7-disposition-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const [category, records] of Object.entries(results)) {
      if (records.length === 0) continue;
      
      const csvPath = path.join(outputDir, `${category}.csv`);
      const csvContent = generateCSV(records, category);
      fs.writeFileSync(csvPath, csvContent);
      console.log(`   ✓ ${csvPath} (${records.length} rows)`);
    }

    // Write summary JSON
    const summaryPath = path.join(outputDir, 'summary.json');
    const summary = {
      analysisDate: new Date().toISOString(),
      targetDate: '2026-05-07',
      targetYear: 2018,
      totalMay7Records: may7Records.rows.length,
      categories: {}
    };
    
    for (const [category, records] of Object.entries(results)) {
      summary.categories[category] = {
        count: records.length,
        percentage: ((records.length / may7Records.rows.length) * 100).toFixed(1) + '%'
      };
    }
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`   ✓ ${summaryPath}`);

    // Final summary table
    console.log('\n\n' + '═'.repeat(65));
    console.log('  SUMMARY');
    console.log('═'.repeat(65));
    console.log(`\n  Total May 7 unknown-tier 2018 records: ${may7Records.rows.length}\n`);
    console.log('  Category                               Count    %');
    console.log('  ' + '─'.repeat(55));
    
    for (const [category, records] of Object.entries(results)) {
      const pct = ((records.length / may7Records.rows.length) * 100).toFixed(1);
      console.log(`  ${category.padEnd(40)} ${String(records.length).padStart(5)}  ${pct.padStart(5)}%`);
    }
    
    // Check for records in multiple categories
    const idCounts = new Map();
    for (const [category, records] of Object.entries(results)) {
      for (const rec of records) {
        idCounts.set(rec.id, (idCounts.get(rec.id) || 0) + 1);
      }
    }
    const multiCategory = [...idCounts.values()].filter(c => c > 1).length;
    if (multiCategory > 0) {
      console.log(`\n  ⚠️  ${multiCategory} records appear in multiple categories`);
    }

    console.log('\n  Output directory: ' + outputDir);
    console.log('\n' + '═'.repeat(65) + '\n');

  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Classify a single record into one or more categories
 */
function classifyRecord(rec, certifiedByYMM, certifiedByModId) {
  const categories = [];

  // Check 1: Malformed make (real make + category suffix)
  const malformedInfo = detectMalformedMake(rec.make);
  if (malformedInfo) {
    categories.push('malformed_make_needs_split');
    rec._malformedMakeInfo = malformedInfo; // Annotate for CSV
    return categories; // Malformed makes need special handling
  }

  // Check 2: Phantom make (not in canonical list)
  const makeLower = rec.make?.toLowerCase() || '';
  if (!CANONICAL_MAKES_LOWER.has(makeLower)) {
    categories.push('phantom_make_delete_candidate');
    return categories; // Phantom makes don't need other checks
  }

  // Check 2: Lowercase make needing canonicalization
  const canonicalMake = CANONICAL_MAKES_LOWER.get(makeLower);
  if (rec.make !== canonicalMake) {
    categories.push('lowercase_make_needs_canonicalization');
  }

  // Check 3: Missing required wheel fields
  const missingFields = [];
  if (!rec.bolt_pattern) missingFields.push('bolt_pattern');
  if (!rec.center_bore_mm) missingFields.push('center_bore_mm');
  if (!rec.oem_wheel_sizes || (Array.isArray(rec.oem_wheel_sizes) && rec.oem_wheel_sizes.length === 0)) {
    missingFields.push('oem_wheel_sizes');
  }
  
  if (missingFields.length > 0) {
    categories.push('missing_required_wheel_fields');
    rec._missingFields = missingFields; // Annotate for CSV
  }

  // Check 4: Duplicate detection
  const isDuplicate = checkForDuplicate(rec, certifiedByYMM, certifiedByModId);
  if (isDuplicate) {
    categories.push('duplicate_safe_delete');
    rec._duplicateOf = isDuplicate; // Annotate for CSV
  }

  // If no issues found and not a duplicate, it needs review
  if (categories.length === 0 || 
      (categories.length === 1 && categories[0] === 'lowercase_make_needs_canonicalization')) {
    // Records with only lowercase issue + no other problems still need review
    // unless they're duplicates
    if (!isDuplicate) {
      categories.push('unique_needs_review');
    }
  }

  return categories;
}

/**
 * Check if a record is a duplicate of an existing certified record
 */
function checkForDuplicate(rec, certifiedByYMM, certifiedByModId) {
  // First check by modification_id (exact match)
  if (rec.modification_id) {
    const existing = certifiedByModId.get(rec.modification_id.toLowerCase());
    if (existing && existing.id !== rec.id) {
      return { matchType: 'modification_id', existingId: existing.id };
    }
  }

  // Check by YMM + trim
  const ymmKey = `${rec.year}|${rec.make}|${rec.model}`.toLowerCase();
  const ymmMatches = certifiedByYMM.get(ymmKey) || [];
  
  for (const existing of ymmMatches) {
    if (existing.id === rec.id) continue;
    
    // Exact trim match
    if (existing.display_trim?.toLowerCase() === rec.display_trim?.toLowerCase()) {
      // Additional check: similar fitment data
      const sameBolt = existing.bolt_pattern === rec.bolt_pattern;
      const sameBore = existing.center_bore_mm === rec.center_bore_mm;
      
      if (sameBolt && sameBore) {
        return { 
          matchType: 'ymm_trim_fitment',
          existingId: existing.id,
          existingTrim: existing.display_trim
        };
      }
      
      // Even without identical fitment, same YMM+trim is likely duplicate
      return {
        matchType: 'ymm_trim',
        existingId: existing.id,
        existingTrim: existing.display_trim
      };
    }
  }

  return null;
}

/**
 * Generate CSV content for a category
 */
function generateCSV(records, category) {
  const headers = [
    'id', 'year', 'make', 'model', 'display_trim', 'raw_trim',
    'modification_id', 'bolt_pattern', 'center_bore_mm', 'thread_size',
    'offset_min_mm', 'offset_max_mm', 'oem_wheel_sizes', 'oem_tire_sizes',
    'source', 'quality_tier', 'created_at'
  ];

  // Add category-specific columns
  if (category === 'missing_required_wheel_fields') {
    headers.push('missing_fields');
  }
  if (category === 'duplicate_safe_delete') {
    headers.push('duplicate_of_id', 'match_type');
  }
  if (category === 'lowercase_make_needs_canonicalization') {
    headers.push('canonical_make');
  }
  if (category === 'malformed_make_needs_split') {
    headers.push('canonical_make', 'detected_suffix');
  }

  const rows = [headers.join(',')];

  for (const rec of records) {
    const values = headers.map(h => {
      if (h === 'missing_fields') {
        return rec._missingFields?.join(';') || '';
      }
      if (h === 'duplicate_of_id') {
        return rec._duplicateOf?.existingId || '';
      }
      if (h === 'match_type') {
        return rec._duplicateOf?.matchType || '';
      }
      if (h === 'canonical_make') {
        // For malformed make, use the detected canonical
        if (rec._malformedMakeInfo) {
          return rec._malformedMakeInfo.canonicalMake || '';
        }
        return CANONICAL_MAKES_LOWER.get(rec.make?.toLowerCase()) || '';
      }
      if (h === 'detected_suffix') {
        return rec._malformedMakeInfo?.suffix || '';
      }
      
      let val = rec[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') val = JSON.stringify(val);
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    });
    
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
