/**
 * Analyze Morimoto SKU patterns to build URL mapping
 */
import pg from 'pg';
import { readFileSync } from 'fs';
const { Pool } = pg;

const envFile = readFileSync('.env.local', 'utf-8');
const pgUrl = envFile.split('\n').find(l => l.startsWith('POSTGRES_URL='))?.replace('POSTGRES_URL=', '').replace(/^["']|["']$/g, '').trim();
const pool = new Pool({ connectionString: pgUrl });

async function main() {
  // Get all unique SKU prefixes and sample titles
  const result = await pool.query(`
    SELECT 
      REGEXP_REPLACE(sku, '-\\d{4}$', '') as prefix,
      MIN(title) as sample_title,
      COUNT(*) as cnt
    FROM accessories 
    WHERE brand = 'Morimoto Offroad' 
    AND image_url IS NULL
    GROUP BY REGEXP_REPLACE(sku, '-\\d{4}$', '')
    ORDER BY cnt DESC
    LIMIT 50
  `);
  
  console.log('=== SKU Prefixes Needing Images ===\n');
  for (const row of result.rows) {
    console.log(`${row.prefix} (${row.cnt}): ${row.sample_title}`);
  }
  
  // Get headtailkit patterns
  console.log('\n\n=== HEADTAILKIT Patterns ===\n');
  const headtail = await pool.query(`
    SELECT DISTINCT 
      SUBSTRING(title FROM '\\d+ \\d+ ([A-Z0-9 ]+) HEADS') as vehicle,
      COUNT(*) as cnt
    FROM accessories 
    WHERE brand = 'Morimoto Offroad' 
    AND sku LIKE 'HEADTAILKIT%'
    AND image_url IS NULL
    GROUP BY SUBSTRING(title FROM '\\d+ \\d+ ([A-Z0-9 ]+) HEADS')
    ORDER BY cnt DESC
  `);
  
  for (const row of headtail.rows) {
    console.log(`${row.vehicle}: ${row.cnt}`);
  }
  
  await pool.end();
}

main().catch(console.error);
