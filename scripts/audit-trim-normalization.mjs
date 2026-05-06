/**
 * Audit trim normalization mismatches
 * 
 * Finds display_trim values that won't match their modification_id
 * using standard URL-encoded trim parameter lookup.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

// Proposed normalization function
function normalizeForLookup(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\//g, '-')           // R/T → R-T
    .replace(/\s+/g, '-')          // Spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')    // Remove other punctuation
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '');        // Trim leading/trailing hyphens
}

// Patterns to check
const PATTERNS = [
  { name: 'Slash (R/T)', regex: /\// },
  { name: '1LE suffix', regex: /1le/i },
  { name: 'ZL1', regex: /zl1/i },
  { name: 'GT + number', regex: /gt\s*\d/i },
  { name: 'BMW M + number', regex: /^m\d/i },
  { name: 'AMG variants', regex: /amg/i },
  { name: 'Mercedes C/E/S + number', regex: /^[ces]\s*\d/i },
  { name: 'xDrive', regex: /xdrive/i },
  { name: '4MATIC', regex: /4matic/i },
  { name: 'TRD', regex: /trd/i },
  { name: 'RS prefix', regex: /^rs\s/i },
];

console.log('🔍 Trim Normalization Audit\n');
console.log('='.repeat(70));

// Get all unique display_trim values with their modification_id
const result = await pool.query(`
  SELECT DISTINCT display_trim, modification_id, make, model
  FROM vehicle_fitments
  WHERE display_trim IS NOT NULL AND display_trim != ''
  ORDER BY make, model, display_trim
`);

const mismatches = [];
const patternMatches = {};

for (const row of result.rows) {
  const displayTrim = row.display_trim;
  const modId = row.modification_id;
  
  // Current behavior: lowercase + trim only
  const currentNorm = displayTrim.toLowerCase().trim();
  
  // Proposed behavior: full normalization
  const proposedNorm = normalizeForLookup(displayTrim);
  
  // Check if display_trim would match modification_id
  const currentMatches = currentNorm === modId || modId.includes(currentNorm);
  const proposedMatches = proposedNorm === modId || modId.includes(proposedNorm);
  
  // Track pattern matches
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(displayTrim)) {
      if (!patternMatches[pattern.name]) {
        patternMatches[pattern.name] = [];
      }
      patternMatches[pattern.name].push({
        make: row.make,
        model: row.model,
        displayTrim,
        modId,
        currentMatches,
        proposedMatches,
      });
    }
  }
  
  // Track mismatches
  if (!currentMatches && proposedMatches) {
    mismatches.push({
      make: row.make,
      model: row.model,
      displayTrim,
      modId,
      currentNorm,
      proposedNorm,
    });
  }
}

console.log(`\nTotal unique trims: ${result.rows.length}`);

console.log('\n📊 Pattern Analysis:\n');
for (const [pattern, matches] of Object.entries(patternMatches)) {
  const wouldFix = matches.filter(m => !m.currentMatches && m.proposedMatches).length;
  const total = matches.length;
  console.log(`${pattern}: ${total} trims, ${wouldFix} would be fixed by normalization`);
}

console.log('\n⚠️  Mismatches (current lookup fails, proposed would fix):\n');
const grouped = {};
for (const m of mismatches) {
  const key = `${m.make} ${m.model}`;
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(m);
}

for (const [vehicle, trims] of Object.entries(grouped)) {
  console.log(`${vehicle}:`);
  for (const t of trims) {
    console.log(`  "${t.displayTrim}" → "${t.modId}"`);
    console.log(`    current: "${t.currentNorm}" (fails)`);
    console.log(`    proposed: "${t.proposedNorm}" (would match)`);
  }
}

console.log('\n' + '='.repeat(70));
console.log(`\n📋 Summary:`);
console.log(`   Total trims audited: ${result.rows.length}`);
console.log(`   Mismatches found: ${mismatches.length}`);
console.log(`   Vehicles affected: ${Object.keys(grouped).length}`);

await pool.end();
