import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function runFixes() {
  await client.connect();
  console.log('Connected to database\n');

  // Run fix-invalid-fitments.sql
  console.log('=== Running fix-invalid-fitments.sql ===\n');
  const invalidFixes = readFileSync('scripts/verification/fix-invalid-fitments.sql', 'utf8');
  
  // Split by semicolons and run each statement
  const statements1 = invalidFixes.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements1) {
    if (stmt.trim()) {
      try {
        const result = await client.query(stmt);
        if (result.rowCount !== null && result.rowCount > 0) {
          console.log(`✓ ${result.rowCount} rows affected`);
        }
        if (result.rows && result.rows.length > 0) {
          console.table(result.rows.slice(0, 5));
        }
      } catch (err) {
        // Skip comment-only or empty statements
        if (!err.message.includes('syntax error at end of input')) {
          console.log(`⚠ ${err.message.slice(0, 100)}`);
        }
      }
    }
  }

  // Run fix-flagged-fitments.sql
  console.log('\n=== Running fix-flagged-fitments.sql ===\n');
  const flaggedFixes = readFileSync('scripts/verification/fix-flagged-fitments.sql', 'utf8');
  
  const statements2 = flaggedFixes.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements2) {
    if (stmt.trim()) {
      try {
        const result = await client.query(stmt);
        if (result.rowCount !== null && result.rowCount > 0) {
          console.log(`✓ ${result.rowCount} rows affected`);
        }
        if (result.rows && result.rows.length > 0) {
          console.table(result.rows.slice(0, 5));
        }
      } catch (err) {
        if (!err.message.includes('syntax error at end of input')) {
          console.log(`⚠ ${err.message.slice(0, 100)}`);
        }
      }
    }
  }

  await client.end();
  console.log('\n✅ Done');
}

runFixes().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
