import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('No POSTGRES_URL found');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  // Read SQL file
  const sqlFile = fs.readFileSync(path.join(__dirname, 'corrections.sql'), 'utf8');
  const statements = sqlFile.trim().split('\n').filter(line => line.trim());
  
  console.log(`Running ${statements.length} DELETE statements...\n`);
  
  let deleted = 0;
  let errors = 0;
  
  for (const stmt of statements) {
    try {
      const result = await sql.unsafe(stmt);
      const match = stmt.match(/year = (\d+).*make\) = '([^']+)'.*model\) = '([^']+)'/);
      if (match) {
        console.log(`✓ Deleted: ${match[1]} ${match[2]} ${match[3]}`);
      }
      deleted++;
    } catch (err) {
      console.error(`✗ Error: ${stmt.slice(0, 80)}...`);
      console.error(`  ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`Completed: ${deleted} deleted, ${errors} errors`);
  console.log(`========================================`);
  
  await sql.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
