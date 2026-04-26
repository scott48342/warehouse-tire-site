/**
 * Check FUTURE_TRIM contamination across all models
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check all Lexus models
  const models = await pool.query(`
    SELECT DISTINCT model, certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE make = 'Lexus'
    GROUP BY model, certification_status
    ORDER BY model, certification_status
  `);
  
  console.log('=== ALL LEXUS MODELS ===');
  for (const r of models.rows) {
    const marker = r.model?.toLowerCase().includes('lx') ? '* ' : '  ';
    console.log(`${marker}${r.model} [${r.certification_status}]: ${r.cnt}`);
  }
  
  // Check needs_review records with FUTURE_TRIM
  const future = await pool.query(`
    SELECT make, model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    GROUP BY make, model
    ORDER BY cnt DESC
    LIMIT 30
  `);
  
  console.log('\n=== FUTURE_TRIM BY MODEL ===');
  for (const r of future.rows) {
    console.log(`  ${r.make} ${r.model}: ${r.cnt}`);
  }
  
  // Total needs_review
  const total = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE certification_status = 'needs_review'
  `);
  console.log('\n=== TOTAL NEEDS_REVIEW ===');
  console.log('  Total:', total.rows[0].cnt);
  
  await pool.end();
}

check().catch(console.error);
