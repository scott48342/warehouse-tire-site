#!/usr/bin/env node
import postgres from 'postgres';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function check() {
  console.log('=== MODEL NAME ANALYSIS ===\n');
  
  // RAM models
  console.log('RAM models in vehicle_fitments:');
  const ramModels = await sql`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'ram' 
    GROUP BY model 
    ORDER BY cnt DESC
  `;
  ramModels.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  // Check GM too
  console.log('\nChevrolet models with "Silverado":');
  const chevyModels = await sql`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chevrolet' 
      AND LOWER(model) LIKE '%silverado%'
    GROUP BY model 
    ORDER BY cnt DESC
  `;
  chevyModels.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  console.log('\nGMC models with "Sierra":');
  const gmcModels = await sql`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'gmc' 
      AND LOWER(model) LIKE '%sierra%'
    GROUP BY model 
    ORDER BY cnt DESC
  `;
  gmcModels.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  // Hyundai Santa Fe
  console.log('\nHyundai Santa Fe models:');
  const hyundaiModels = await sql`
    SELECT model, COUNT(*) as cnt 
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'hyundai' 
      AND LOWER(model) LIKE '%santa%fe%'
    GROUP BY model 
    ORDER BY cnt DESC
  `;
  hyundaiModels.forEach(r => console.log(`  "${r.model}": ${r.cnt} records`));
  
  // Check tier constants
  console.log('\n=== TIER 1 EXPECTS ===');
  console.log('  RAM: "Ram 1500", "Ram 2500", "Ram 3500"');
  console.log('  Chevy: "Silverado 1500", "Silverado 2500HD", "Silverado 3500HD"');
  console.log('  GMC: "Sierra 1500", "Sierra 2500HD", "Sierra 3500HD"');
  console.log('  Hyundai: "Santa Fe"');
  
  // Check CASE sensitivity
  console.log('\n=== CASE SENSITIVITY CHECK ===');
  const caseCheck = await sql`
    SELECT make, model, year
    FROM vehicle_fitments
    WHERE year = 2018
      AND (
        (LOWER(make) = 'ram' AND model IN ('1500', 'Ram 1500', 'ram 1500', 'RAM 1500'))
        OR (LOWER(make) = 'ram' AND LOWER(model) = '1500')
      )
    LIMIT 5
  `;
  console.log('2018 RAM with model ~1500:');
  caseCheck.forEach(r => console.log(`  make="${r.make}" model="${r.model}"`));
  
  await sql.end();
}

check().catch(console.error);
