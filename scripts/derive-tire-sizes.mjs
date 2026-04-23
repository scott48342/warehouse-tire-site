import pg from 'pg';
const { Client } = pg;

const POSTGRES_URL = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Standard tire sizes by wheel diameter (fallback)
const STANDARD_TIRES = {
  '14': ['185/65R14', '195/70R14'],
  '15': ['195/65R15', '205/65R15', '215/70R15'],
  '16': ['205/55R16', '215/60R16', '225/60R16'],
  '17': ['215/55R17', '225/50R17', '225/55R17', '235/65R17'],
  '18': ['225/45R18', '235/50R18', '235/55R18', '245/45R18'],
  '19': ['235/40R19', '245/45R19', '255/40R19'],
  '20': ['245/45R20', '255/45R20', '265/50R20', '275/45R20'],
  '21': ['265/40R21', '275/40R21', '285/40R21'],
  '22': ['275/40R22', '285/45R22', '295/35R22'],
  '23': ['285/35R23', '295/35R23'],
  '24': ['295/30R24', '305/35R24'],
};

// Extract wheel diameters from oem_wheel_sizes JSONB array
// Handles both object format {diameter: 17, width: 8, ...} and string format "17x8"
function extractDiameters(wheelSizes) {
  if (!wheelSizes || !Array.isArray(wheelSizes)) return [];
  
  const diameters = [];
  for (const ws of wheelSizes) {
    if (!ws) continue;
    
    // Object format: {diameter: 17, width: 8, offset: 35, position: "both"}
    if (typeof ws === 'object' && ws.diameter) {
      diameters.push(String(ws.diameter));
    }
    // String format: "17x8" or "17x8.5+35"
    else if (typeof ws === 'string') {
      const match = ws.match(/^(\d+)/);
      if (match) diameters.push(match[1]);
    }
  }
  
  return [...new Set(diameters)];
}

async function main() {
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();
  console.log('Connected to database');

  // Step 1: Find all records with wheel sizes but no tire sizes
  const { rows: missingTires } = await client.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_wheel_sizes IS NOT NULL 
      AND jsonb_array_length(oem_wheel_sizes) > 0
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes = 'null'::jsonb)
    ORDER BY make, model, year
  `);

  console.log(`Found ${missingTires.length} records with wheel sizes but no tire sizes\n`);

  // Step 2: Get all records that DO have tire sizes (for lookup)
  const { rows: withTires } = await client.query(`
    SELECT id, year, make, model, display_trim, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments
    WHERE oem_tire_sizes IS NOT NULL 
      AND oem_tire_sizes != '[]'::jsonb
      AND oem_tire_sizes != 'null'::jsonb
      AND jsonb_array_length(oem_tire_sizes) > 0
  `);

  console.log(`Found ${withTires.length} records with tire sizes for reference\n`);

  // Build lookup index by make/model
  const tireIndex = {};
  for (const row of withTires) {
    const key = `${row.make}|${row.model}`;
    if (!tireIndex[key]) tireIndex[key] = [];
    tireIndex[key].push(row);
  }

  // Stats tracking
  const stats = {
    adjacentYear: 0,
    sameModelAnyYear: 0,
    standardFallback: 0,
    failed: 0,
  };
  const updates = [];
  const failures = [];

  // Step 3: Derive tire sizes for each missing record
  for (const record of missingTires) {
    const { id, year, make, model, display_trim, oem_wheel_sizes } = record;
    const key = `${make}|${model}`;
    const diameters = extractDiameters(oem_wheel_sizes);
    
    let derivedTires = null;
    let method = null;

    // Get potential matches
    const candidates = tireIndex[key] || [];

    // Method 1: Adjacent year (year-1 or year+1)
    const adjacentYears = candidates.filter(c => 
      c.year === year - 1 || c.year === year + 1
    );
    if (adjacentYears.length > 0) {
      // Prefer exact year match, then closest
      const sorted = adjacentYears.sort((a, b) => 
        Math.abs(a.year - year) - Math.abs(b.year - year)
      );
      derivedTires = sorted[0].oem_tire_sizes;
      method = 'adjacentYear';
    }

    // Method 2: Same make/model, any year with matching wheel diameters
    if (!derivedTires && diameters.length > 0) {
      for (const candidate of candidates) {
        const candDiameters = extractDiameters(candidate.oem_wheel_sizes);
        // Check if diameters overlap
        const overlap = diameters.some(d => candDiameters.includes(d));
        if (overlap && candidate.oem_tire_sizes?.length > 0) {
          derivedTires = candidate.oem_tire_sizes;
          method = 'sameModelAnyYear';
          break;
        }
      }
    }

    // Method 3: Standard tire size fallback based on wheel diameter
    if (!derivedTires && diameters.length > 0) {
      const primaryDiameter = diameters[0];
      if (STANDARD_TIRES[primaryDiameter]) {
        // Pick first standard tire for that diameter
        derivedTires = [STANDARD_TIRES[primaryDiameter][0]];
        method = 'standardFallback';
      }
    }

    if (derivedTires && derivedTires.length > 0) {
      stats[method]++;
      updates.push({
        id,
        year,
        make,
        model,
        trim: display_trim,
        wheels: oem_wheel_sizes,
        diameters,
        derivedTires,
        method,
      });
    } else {
      stats.failed++;
      failures.push({ id, year, make, model, trim: display_trim, wheels: oem_wheel_sizes, diameters });
    }
  }

  console.log('\n=== Derivation Stats ===');
  console.log(`Adjacent year matches: ${stats.adjacentYear}`);
  console.log(`Same model any year: ${stats.sameModelAnyYear}`);
  console.log(`Standard fallback: ${stats.standardFallback}`);
  console.log(`Failed (no match): ${stats.failed}`);
  console.log(`Total to update: ${updates.length}`);

  // Step 4: Apply updates
  console.log('\n=== Applying Updates ===');
  let updated = 0;
  for (const upd of updates) {
    try {
      // Convert to JSONB format
      const tiresJson = JSON.stringify(upd.derivedTires);
      await client.query(
        `UPDATE vehicle_fitments SET oem_tire_sizes = $1::jsonb WHERE id = $2`,
        [tiresJson, upd.id]
      );
      updated++;
      if (updated % 100 === 0) {
        console.log(`Updated ${updated}/${updates.length}...`);
      }
    } catch (err) {
      console.error(`Failed to update id ${upd.id}:`, err.message);
    }
  }

  console.log(`\n✅ Successfully updated ${updated} records`);

  // Step 5: Save summary
  const summary = {
    timestamp: new Date().toISOString(),
    totalMissing: missingTires.length,
    totalUpdated: updated,
    stats,
    sampleUpdates: updates.slice(0, 10).map(u => ({
      vehicle: `${u.year} ${u.make} ${u.model}`,
      diameters: u.diameters,
      derivedTires: u.derivedTires,
      method: u.method,
    })),
    sampleFailures: failures.slice(0, 10).map(f => ({
      vehicle: `${f.year} ${f.make} ${f.model}`,
      diameters: f.diameters,
    })),
  };

  await client.end();
  
  // Output summary as JSON
  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  
  return summary;
}

main().catch(console.error);
