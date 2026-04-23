import pg from 'pg';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const client = await pool.connect();
  
  if (dryRun) console.log('=== DRY RUN MODE ===\n');
  
  try {
    // Step 1: Add 90s years to existing catalog models
    const needYears = await client.query(`
      SELECT DISTINCT cm.id, cm.make_slug, cm.name, cm.years, vf.year as needs_year
      FROM vehicle_fitments vf
      JOIN catalog_models cm ON LOWER(cm.make_slug) = LOWER(vf.make) AND LOWER(cm.name) = LOWER(vf.model)
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT (vf.year = ANY(cm.years))
    `);
    
    console.log(`Step 1: Adding years to ${needYears.rows.length} existing catalog entries...`);
    
    // Group by model ID
    const yearsByModel = {};
    needYears.rows.forEach(r => {
      if (!yearsByModel[r.id]) {
        yearsByModel[r.id] = { years: [...r.years], make: r.make_slug, model: r.name };
      }
      if (!yearsByModel[r.id].years.includes(r.needs_year)) {
        yearsByModel[r.id].years.push(r.needs_year);
      }
    });
    
    let yearsAdded = 0;
    for (const [id, data] of Object.entries(yearsByModel)) {
      data.years.sort((a, b) => b - a); // Sort descending
      if (!dryRun) {
        await client.query(`UPDATE catalog_models SET years = $1, updated_at = NOW() WHERE id = $2`, [data.years, id]);
      }
      yearsAdded++;
    }
    console.log(`  Updated ${yearsAdded} models with 90s years`);
    
    // Step 2: Add missing makes (Geo, Eagle, Oldsmobile, Plymouth, Isuzu)
    const defunctMakes = ['geo', 'eagle', 'oldsmobile', 'plymouth', 'isuzu', 'saturn', 'mercury'];
    
    console.log('\nStep 2: Adding defunct makes...');
    for (const make of defunctMakes) {
      const exists = await client.query(`SELECT id FROM catalog_makes WHERE LOWER(slug) = $1`, [make]);
      if (exists.rows.length === 0) {
        if (!dryRun) {
          await client.query(`
            INSERT INTO catalog_makes (id, slug, name, created_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
          `, [randomUUID(), make, make.charAt(0).toUpperCase() + make.slice(1)]);
        }
        console.log(`  Added make: ${make}`);
      }
    }
    
    // Step 3: Add missing models from fitment data
    console.log('\nStep 3: Adding missing models...');
    
    const orphanModels = await client.query(`
      SELECT DISTINCT vf.make, vf.model, array_agg(DISTINCT vf.year ORDER BY vf.year DESC) as years
      FROM vehicle_fitments vf
      WHERE vf.year >= 1990 AND vf.year < 2000
      AND NOT EXISTS (
        SELECT 1 FROM catalog_models cm 
        WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
        AND LOWER(cm.name) = LOWER(vf.model)
      )
      GROUP BY vf.make, vf.model
    `);
    
    let modelsAdded = 0;
    for (const row of orphanModels.rows) {
      const slug = row.model.toLowerCase().replace(/\s+/g, '-');
      if (!dryRun) {
        await client.query(`
          INSERT INTO catalog_models (id, make_slug, slug, name, years, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT DO NOTHING
        `, [randomUUID(), row.make.toLowerCase(), slug, row.model, row.years]);
      }
      modelsAdded++;
    }
    console.log(`  Added ${modelsAdded} missing models`);
    
    // Final check
    if (!dryRun) {
      const remaining = await client.query(`
        SELECT COUNT(DISTINCT vf.year::text || vf.make || vf.model) as count
        FROM vehicle_fitments vf
        WHERE vf.year >= 1990 AND vf.year < 2000
        AND NOT EXISTS (
          SELECT 1 FROM catalog_models cm 
          WHERE LOWER(cm.make_slug) = LOWER(vf.make) 
          AND LOWER(cm.name) = LOWER(vf.model)
          AND vf.year = ANY(cm.years)
        )
      `);
      console.log(`\nRemaining orphans: ${remaining.rows[0].count}`);
    }
    
    console.log('\n=== SYNC COMPLETE ===');
    if (dryRun) console.log('(Dry run - no changes made)');
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
