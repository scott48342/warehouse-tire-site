/**
 * Cleanup Round 2 - Remove non-US vehicles from vehicle_fitments
 * 
 * Non-US models to delete:
 * - China-only Buicks: electra-e4, electra-e4-gs, envision-s-gs, envista-gs, verano-pro-gs, regal-gs (post-2017)
 * - China-only Chevrolet: cruze-sport6-rs, tracker-rs
 * - Europe-only: ford transit-t8
 * - Other non-US: audi q2l-e-tron, q5-e-tron, q6, sq8-sportback-e-tron, dodge charger-pursuit, ford fiesta-ikon
 */

import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const POSTGRES_URL = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Non-US models to delete (make, model patterns)
const NON_US_MODELS = [
  // China-only Buick
  { make: 'buick', model: 'electra-e4' },
  { make: 'buick', model: 'electra-e4-gs' },
  { make: 'buick', model: 'envision-s-gs' },
  { make: 'buick', model: 'envista-gs' },
  { make: 'buick', model: 'verano-pro-gs' },
  { make: 'buick', model: 'regal-gs', yearMin: 2018 }, // post-2017 only
  
  // China-only Chevrolet
  { make: 'chevrolet', model: 'cruze-sport6-rs' },
  { make: 'chevrolet', model: 'tracker-rs' },
  
  // Europe-only
  { make: 'ford', model: 'transit-t8' },
  
  // Other non-US
  { make: 'audi', model: 'q2l-e-tron' },
  { make: 'audi', model: 'q5-e-tron' },
  { make: 'audi', model: 'q6' }, // China Q6, not Q6 e-tron
  { make: 'audi', model: 'sq8-sportback-e-tron' },
  { make: 'dodge', model: 'charger-pursuit' },
  { make: 'ford', model: 'fiesta-ikon' },
];

// Discontinued US models - flag only, don't delete
const DISCONTINUED_US = [
  { make: 'chevrolet', model: 'camaro', endYear: 2024 },
  { make: 'chevrolet', model: 'spark', endYear: 2023 },
  { make: 'dodge', model: 'challenger', endYear: 2024 },
  { make: 'ford', model: 'fiesta', endYear: 2019 },
  { make: 'ford', model: 'focus', endYear: 2018 },
  { make: 'ford', model: 'taurus', endYear: 2019 },
  { make: 'hyundai', model: 'ioniq', endYear: 2022 },
  { make: 'infiniti', model: 'q60', endYear: 2022 },
  { make: 'acura', model: 'nsx', endYear: 2022 },
];

async function main() {
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();
  
  const results = {
    timestamp: new Date().toISOString(),
    deletions: [],
    totalDeleted: 0,
    discontinued: [],
    errors: []
  };
  
  console.log('=== Non-US Vehicle Cleanup Round 2 ===\n');
  
  // Process each non-US model
  for (const target of NON_US_MODELS) {
    try {
      let query, params;
      
      if (target.yearMin) {
        // Year-constrained delete (e.g., Regal GS post-2017)
        query = `
          DELETE FROM vehicle_fitments 
          WHERE LOWER(make) = $1 
            AND LOWER(model) = $2
            AND year >= $3
          RETURNING id, year, make, model, raw_trim
        `;
        params = [target.make.toLowerCase(), target.model.toLowerCase(), target.yearMin];
      } else {
        // Standard delete by make/model
        query = `
          DELETE FROM vehicle_fitments 
          WHERE LOWER(make) = $1 
            AND LOWER(model) = $2
          RETURNING id, year, make, model, raw_trim
        `;
        params = [target.make.toLowerCase(), target.model.toLowerCase()];
      }
      
      const result = await client.query(query, params);
      
      if (result.rowCount > 0) {
        const deleted = {
          make: target.make,
          model: target.model,
          yearMin: target.yearMin || null,
          count: result.rowCount,
          records: result.rows.map(r => `${r.year} ${r.make} ${r.model} ${r.raw_trim || ''}`.trim())
        };
        results.deletions.push(deleted);
        results.totalDeleted += result.rowCount;
        console.log(`✓ Deleted ${result.rowCount} ${target.make} ${target.model}${target.yearMin ? ` (${target.yearMin}+)` : ''}`);
        result.rows.forEach(r => console.log(`  - ${r.year} ${r.make} ${r.model} ${r.raw_trim || ''}`));
      } else {
        console.log(`○ No records found: ${target.make} ${target.model}${target.yearMin ? ` (${target.yearMin}+)` : ''}`);
      }
    } catch (err) {
      console.error(`✗ Error deleting ${target.make} ${target.model}: ${err.message}`);
      results.errors.push({ target, error: err.message });
    }
  }
  
  console.log('\n=== Discontinued US Models (Flagged Only) ===\n');
  
  // Check discontinued models (flag only, don't delete)
  for (const disc of DISCONTINUED_US) {
    try {
      const result = await client.query(`
        SELECT COUNT(*) as total,
               MIN(year) as min_year,
               MAX(year) as max_year
        FROM vehicle_fitments
        WHERE LOWER(make) = $1 AND LOWER(model) = $2
      `, [disc.make.toLowerCase(), disc.model.toLowerCase()]);
      
      const info = result.rows[0];
      if (parseInt(info.total) > 0) {
        const entry = {
          make: disc.make,
          model: disc.model,
          endYear: disc.endYear,
          recordCount: parseInt(info.total),
          yearRange: `${info.min_year}-${info.max_year}`,
          status: 'KEPT - discontinued but valid US vehicle'
        };
        results.discontinued.push(entry);
        console.log(`📋 ${disc.make} ${disc.model}: ${info.total} records (${info.min_year}-${info.max_year}) - ended ${disc.endYear}`);
      }
    } catch (err) {
      console.error(`✗ Error checking ${disc.make} ${disc.model}: ${err.message}`);
    }
  }
  
  await client.end();
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total records deleted: ${results.totalDeleted}`);
  console.log(`Models cleaned: ${results.deletions.length}`);
  console.log(`Discontinued models flagged: ${results.discontinued.length}`);
  console.log(`Errors: ${results.errors.length}`);
  
  return results;
}

main().then(results => {
  // Write results to file
  fs.writeFileSync('C:\\Users\\Scott-Pc\\clawd\\gap-results\\cleanup-round2-results.json', JSON.stringify(results, null, 2));
  console.log('\nResults saved to gap-results/cleanup-round2-results.json');
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
