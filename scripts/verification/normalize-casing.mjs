/**
 * Normalize make and model casing in vehicle_fitments
 * - Makes: Title Case (chevrolet → Chevrolet)
 * - Models: Consistent formatting (3-series → 3 Series)
 * - Special cases: BMW, GMC, etc stay uppercase
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Make normalization map (lowercase → proper)
const MAKE_MAP = {
  'amc': 'AMC',
  'bmw': 'BMW',
  'gmc': 'GMC',
  'ram': 'RAM',
  'mercedes': 'Mercedes',
  'mercedes-benz': 'Mercedes-Benz',
  'land rover': 'Land Rover',
  'land-rover': 'Land Rover',
  'alfa-romeo': 'Alfa Romeo',
  'alfa romeo': 'Alfa Romeo',
  'aston-martin': 'Aston Martin',
  'aston martin': 'Aston Martin',
  'rolls-royce': 'Rolls-Royce',
  'rolls royce': 'Rolls-Royce',
  'mclaren': 'McLaren',
  'mini': 'MINI',
};

// Model normalization patterns
const MODEL_PATTERNS = [
  // BMW series: "3-series" → "3 Series"
  { pattern: /^(\d)-series$/i, replacement: '$1 Series' },
  { pattern: /^(\d) series$/i, replacement: '$1 Series' },
  // Lowercase models to Title Case
  { pattern: /^([a-z])(.*)$/, replacement: (m, p1, p2) => p1.toUpperCase() + p2 },
];

function titleCase(str) {
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

function normalizeMake(make) {
  const lower = make.toLowerCase();
  if (MAKE_MAP[lower]) return MAKE_MAP[lower];
  return titleCase(make);
}

function normalizeModel(model) {
  let result = model;
  for (const { pattern, replacement } of MODEL_PATTERNS) {
    if (typeof replacement === 'function') {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await pool.connect();
  
  try {
    // Get distinct makes that need normalization
    const makes = await client.query(`
      SELECT DISTINCT make FROM vehicle_fitments
      WHERE make != INITCAP(make) 
         OR make IN (SELECT make FROM vehicle_fitments WHERE LOWER(make) IN ('bmw', 'gmc', 'mercedes-benz', 'land rover'))
      ORDER BY make
    `);
    
    console.log(`Found ${makes.rows.length} makes to check\n`);
    
    let totalUpdated = 0;
    
    // Fix makes
    const makeUpdates = [];
    for (const { make } of makes.rows) {
      const normalized = normalizeMake(make);
      if (make !== normalized) {
        makeUpdates.push({ from: make, to: normalized });
      }
    }
    
    console.log('=== Make updates ===');
    for (const { from, to } of makeUpdates) {
      console.log(`  "${from}" → "${to}"`);
      if (!dryRun) {
        const result = await client.query(
          `UPDATE vehicle_fitments SET make = $1 WHERE make = $2`,
          [to, from]
        );
        totalUpdated += result.rowCount;
      }
    }
    
    // Get distinct models that need normalization (BMW series pattern)
    const models = await client.query(`
      SELECT DISTINCT make, model FROM vehicle_fitments
      WHERE LOWER(make) = 'bmw' AND model ~* '^\\d-series$'
      ORDER BY make, model
    `);
    
    console.log('\n=== Model updates ===');
    for (const { make, model } of models.rows) {
      const normalized = normalizeModel(model);
      if (model !== normalized) {
        console.log(`  "${make} ${model}" → "${make} ${normalized}"`);
        if (!dryRun) {
          const result = await client.query(
            `UPDATE vehicle_fitments SET model = $1 WHERE make = $2 AND model = $3`,
            [normalized, make, model]
          );
          totalUpdated += result.rowCount;
        }
      }
    }
    
    console.log(`\n${dryRun ? '[DRY RUN] Would update' : 'Updated'} ${totalUpdated} records`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
