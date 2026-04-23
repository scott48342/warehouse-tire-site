#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const envPath = join(__dirname, '..', '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const match = envContent.match(/POSTGRES_URL="([^"]+)"/);
const connectionString = match ? match[1] : null;

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n🧹 DELETING ADDITIONAL NON-US VEHICLES...\n');
  
  const before = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  console.log(`Before: ${before.rows[0].count} records`);
  
  const result = await client.query(`
    DELETE FROM vehicle_fitments
    WHERE 
      (make ILIKE 'Mazda' AND model ILIKE 'CX-4')
      OR (make ILIKE 'Mazda' AND model ILIKE 'CX-8')
      OR (make ILIKE 'Mazda' AND model ILIKE 'Mazda8')
      OR (make ILIKE 'Mazda' AND model ILIKE 'Roadster%')
      OR (make ILIKE 'Mazda' AND model ILIKE 'MX-5-RF')
      OR (make ILIKE 'Nissan' AND model ILIKE 'Lannia')
      OR (make ILIKE 'Nissan' AND model ILIKE 'V-Drive')
      OR (make ILIKE 'Nissan' AND model ILIKE 'Dayz%')
      OR (make ILIKE 'Nissan' AND model ILIKE 'NP300%')
      OR (make ILIKE 'Nissan' AND model ILIKE 'Micra%')
      OR (make ILIKE 'Ram' AND model ILIKE 'V1000')
      OR (make ILIKE 'Ram' AND model ILIKE 'V700%')
      OR (make ILIKE 'Ram' AND model ILIKE '1000')
      OR (make ILIKE 'Ram' AND model ILIKE 'ProMaster-Rapid')
      OR (make ILIKE 'Ram' AND model ILIKE 'ProMaster Rapid')
      OR (make ILIKE 'Chevrolet' AND model ILIKE 'Move%')
      OR (make ILIKE 'Chevrolet' AND model ILIKE 'T-Series')
      OR (make ILIKE 'Kia' AND model ILIKE 'Pro-Cee%')
      OR (make ILIKE 'Kia' AND model ILIKE 'Pro Cee%')
      OR (make ILIKE 'Kia' AND model ILIKE 'ProCeed')
      OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy-B4')
      OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy B4')
      OR (make ILIKE 'Subaru' AND model ILIKE 'Impreza-G4')
      OR (make ILIKE 'Subaru' AND model ILIKE 'Impreza G4')
      OR (make ILIKE 'Subaru' AND model ILIKE 'Legacy-Outback')
      OR (make ILIKE 'Toyota' AND model ILIKE 'Majesty')
      OR (make ILIKE 'Toyota' AND model ILIKE 'Venturer')
      OR (make ILIKE 'Ford' AND model ILIKE 'Fiesta-Active')
      OR (make ILIKE 'Ford' AND model ILIKE 'Fiesta Active')
      OR (make ILIKE 'Mercedes' AND model ILIKE 'Marco-Polo')
      OR (make ILIKE 'Mercedes' AND model ILIKE 'Marco Polo')
      OR (make ILIKE 'Chrysler' AND model ILIKE 'Grand-Voyager')
      OR (make ILIKE 'Chrysler' AND model ILIKE 'Grand Voyager')
  `);
  
  console.log(`Deleted: ${result.rowCount} records`);
  
  const after = await client.query('SELECT COUNT(*) as count FROM vehicle_fitments');
  console.log(`After: ${after.rows[0].count} records`);
  
  await client.end();
}

main().catch(console.error);
