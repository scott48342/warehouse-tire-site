import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function runSQL(filename) {
  console.log(`\n=== Running ${filename} ===\n`);
  const sql = readFileSync(`scripts/verification/${filename}`, 'utf8');
  
  // Split by semicolons, filter out comments and empty
  const statements = sql.split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10);
  
  let totalAffected = 0;
  
  for (const stmt of statements) {
    // Skip pure comment blocks
    if (stmt.split('\n').every(line => line.trim().startsWith('--') || !line.trim())) continue;
    
    try {
      const result = await client.query(stmt);
      if (result.rowCount > 0) {
        console.log(`✓ ${result.rowCount} rows affected`);
        totalAffected += result.rowCount;
      }
    } catch (err) {
      console.log(`⚠ Error: ${err.message.slice(0, 120)}`);
    }
  }
  
  console.log(`\nTotal: ${totalAffected} rows affected`);
  return totalAffected;
}

async function main() {
  await client.connect();
  console.log('Connected to database');

  const t1 = await runSQL('fix-invalid-fitments-v2.sql');
  const t2 = await runSQL('fix-flagged-fitments-v2.sql');

  console.log(`\n========================================`);
  console.log(`TOTAL: ${t1 + t2} rows modified`);
  console.log(`========================================`);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
