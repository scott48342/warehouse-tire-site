#!/usr/bin/env node
/**
 * Corvette E-Ray Review
 * 
 * Compare E-Ray tire sizes with Stingray/Z06 pattern
 * to determine if safe to apply canonical staggered format.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.POSTGRES_URL);

async function review() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   CORVETTE E-RAY STAGGERED REVIEW                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Get all E-Ray records
  const erayRecords = await sql`
    SELECT id, year, display_trim, oem_tire_sizes, oem_wheel_sizes, source
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%E-Ray%'
    ORDER BY year DESC, display_trim
  `;

  console.log('=== E-RAY CURRENT DATA ===\n');
  for (const r of erayRecords) {
    console.log(`${r.year} ${r.display_trim}:`);
    console.log(`  Tire sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  Wheel sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`  Source: ${r.source}`);
    console.log('');
  }

  // Get Stingray for comparison (canonical format)
  const stingrayRecords = await sql`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%Stingray%' AND year >= 2024
    ORDER BY year DESC
    LIMIT 3
  `;

  console.log('\n=== STINGRAY REFERENCE (CANONICAL) ===\n');
  for (const r of stingrayRecords) {
    console.log(`${r.year} ${r.display_trim}:`);
    console.log(`  Tire sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  Wheel sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log('');
  }

  // Get Z06 for comparison
  const z06Records = await sql`
    SELECT year, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE make='Chevrolet' AND model='Corvette' AND display_trim ILIKE '%Z06%' AND year >= 2024
    ORDER BY year DESC
    LIMIT 3
  `;

  console.log('\n=== Z06 REFERENCE (CANONICAL) ===\n');
  for (const r of z06Records) {
    console.log(`${r.year} ${r.display_trim}:`);
    console.log(`  Tire sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
    console.log(`  Wheel sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log('');
  }

  // Analyze E-Ray pattern
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const eraySample = erayRecords[0];
  if (!eraySample) {
    console.log('❌ No E-Ray records found');
    await sql.end();
    return;
  }

  const tireSizes = eraySample.oem_tire_sizes;
  
  // Check if already canonical
  if (tireSizes?.front && tireSizes?.rear) {
    console.log('✅ E-Ray already in canonical format');
    await sql.end();
    return;
  }

  // Analyze array format
  if (Array.isArray(tireSizes) && tireSizes.length === 2) {
    const [size1, size2] = tireSizes;
    
    // Parse sizes
    const parse = (s) => {
      const m = s.match(/^P?(\d{3})\/(\d{2})Z?R(\d{2})/i);
      return m ? { width: parseInt(m[1]), aspect: parseInt(m[2]), diameter: parseInt(m[3]) } : null;
    };
    
    const p1 = parse(size1);
    const p2 = parse(size2);
    
    if (p1 && p2) {
      console.log(`Size 1: ${size1} → width=${p1.width}, diameter=${p1.diameter}`);
      console.log(`Size 2: ${size2} → width=${p2.width}, diameter=${p2.diameter}`);
      console.log('');
      
      // Determine front/rear
      // Rule: Narrower width = front, wider = rear
      // For same width: smaller diameter = front
      let front, rear;
      let confidence = 0;
      let reason = '';
      
      if (p1.width < p2.width) {
        front = size1;
        rear = size2;
        confidence = 100;
        reason = `Width difference: ${p1.width}mm (front) < ${p2.width}mm (rear)`;
      } else if (p1.width > p2.width) {
        front = size2;
        rear = size1;
        confidence = 100;
        reason = `Width difference: ${p2.width}mm (front) < ${p1.width}mm (rear)`;
      } else if (p1.diameter < p2.diameter) {
        front = size1;
        rear = size2;
        confidence = 95;
        reason = `Same width, diameter difference: ${p1.diameter}" (front) < ${p2.diameter}" (rear)`;
      } else if (p1.diameter > p2.diameter) {
        front = size2;
        rear = size1;
        confidence = 95;
        reason = `Same width, diameter difference: ${p2.diameter}" (front) < ${p1.diameter}" (rear)`;
      } else {
        console.log('❌ AMBIGUOUS: Same width and diameter - cannot determine front/rear');
        confidence = 0;
      }
      
      if (confidence > 0) {
        console.log('PROPOSED MAPPING:');
        console.log(`  Front: ${front}`);
        console.log(`  Rear:  ${rear}`);
        console.log(`  Confidence: ${confidence}%`);
        console.log(`  Reason: ${reason}`);
        console.log('');
        
        // Compare with Z06
        const z06Sample = z06Records[0];
        if (z06Sample?.oem_tire_sizes?.front && z06Sample?.oem_tire_sizes?.rear) {
          console.log('COMPARISON WITH Z06:');
          console.log(`  Z06 Front: ${z06Sample.oem_tire_sizes.front}`);
          console.log(`  Z06 Rear:  ${z06Sample.oem_tire_sizes.rear}`);
          
          // Check if E-Ray matches Z06 pattern (same tires)
          const z06Front = z06Sample.oem_tire_sizes.front;
          const z06Rear = z06Sample.oem_tire_sizes.rear;
          
          if (front === z06Front && rear === z06Rear) {
            console.log('  ✅ EXACT MATCH with Z06 - high confidence');
          } else {
            console.log('  ⚠️  Different from Z06');
          }
        }
        
        // Output proposed canonical format
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('RECOMMENDATION');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        if (confidence >= 95) {
          console.log('✅ SAFE TO APPLY');
          console.log('');
          console.log('Proposed update for all E-Ray records:');
          console.log(`  FROM: ${JSON.stringify(tireSizes)}`);
          console.log(`  TO:   ${JSON.stringify({ front, rear })}`);
          console.log('');
          console.log(`Records to update: ${erayRecords.length}`);
          console.log('');
          
          // List all IDs
          console.log('Record IDs:');
          for (const r of erayRecords) {
            console.log(`  ${r.id} - ${r.year} ${r.display_trim}`);
          }
        } else {
          console.log('❌ NOT SAFE - Confidence too low');
        }
      }
    }
  } else {
    console.log(`❌ Unexpected format: ${JSON.stringify(tireSizes)}`);
  }

  await sql.end();
}

review().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
