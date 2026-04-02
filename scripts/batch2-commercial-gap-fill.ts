/**
 * Batch 2: Commercial Coverage Gap Fill
 * 
 * High-priority vehicles:
 * - Kia Optima (2001-2020) - 20 years
 * - Ford Focus (2000-2018) - 18 years  
 * - Ford Fusion (2006-2020) - 13 years
 * - Mazda3 (2004-2013) - 10 years
 */

import { db } from '../src/db';
import { vehicleFitments } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';

interface FitmentRecord {
  year: number;
  make: string;
  model: string;
  submodel: string;
  bolt_pattern: string;
  centerbore: number;
  offset_min: number;
  offset_max: number;
  thread_size: string;
  seat_type: string;
  oem_wheel_sizes: string[];
  oem_tire_sizes: string[];
}

const batch2Records: FitmentRecord[] = [];

// =============================================================================
// KIA OPTIMA (2001-2020)
// =============================================================================

// Gen 1: 2001-2006 - 5x114.3, 67.1mm CB
for (let year = 2001; year <= 2006; year++) {
  const tires = year <= 2003 
    ? ['195/70R14', '205/60R15']
    : ['205/60R15', '205/55R16'];
  const wheels = year <= 2003
    ? ['14x5.5', '15x6']
    : ['15x6', '16x6.5'];
    
  batch2Records.push({
    year,
    make: 'Kia',
    model: 'Optima',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 35,
    offset_max: 45,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: wheels,
    oem_tire_sizes: tires,
  });
}

// Gen 2: 2007-2010 - 5x114.3, 67.1mm CB
for (let year = 2007; year <= 2010; year++) {
  batch2Records.push({
    year,
    make: 'Kia',
    model: 'Optima',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 40,
    offset_max: 50,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x6.5'],
    oem_tire_sizes: ['205/60R16', '215/55R17'],
  });
}

// Gen 3: 2011-2015 - 5x114.3, 67.1mm CB
for (let year = 2011; year <= 2015; year++) {
  batch2Records.push({
    year,
    make: 'Kia',
    model: 'Optima',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 41,
    offset_max: 51,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7', '18x7.5'],
    oem_tire_sizes: ['205/65R16', '215/55R17', '235/45R18'],
  });
}

// Gen 4: 2016-2020 - 5x114.3, 67.1mm CB
for (let year = 2016; year <= 2020; year++) {
  batch2Records.push({
    year,
    make: 'Kia',
    model: 'Optima',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 41,
    offset_max: 52,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7', '18x7.5'],
    oem_tire_sizes: ['205/65R16', '215/55R17', '235/45R18'],
  });
}

// =============================================================================
// FORD FOCUS (2000-2018)
// =============================================================================

// Gen 1: 2000-2007 - 4x108, 63.4mm CB
for (let year = 2000; year <= 2007; year++) {
  batch2Records.push({
    year,
    make: 'Ford',
    model: 'Focus',
    submodel: 'Base',
    bolt_pattern: '4x108',
    centerbore: 63.4,
    offset_min: 35,
    offset_max: 52,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['14x5.5', '15x6', '16x6.5'],
    oem_tire_sizes: ['185/65R14', '195/60R15', '205/50R16'],
  });
}

// Gen 2: 2008-2011 - still 4x108, 63.4mm CB
for (let year = 2008; year <= 2011; year++) {
  batch2Records.push({
    year,
    make: 'Ford',
    model: 'Focus',
    submodel: 'Base',
    bolt_pattern: '4x108',
    centerbore: 63.4,
    offset_min: 40,
    offset_max: 52,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5', '17x7'],
    oem_tire_sizes: ['195/60R15', '205/55R16', '215/45R17'],
  });
}

// Gen 3: 2012-2018 - CHANGED to 5x108, 63.4mm CB
for (let year = 2012; year <= 2018; year++) {
  batch2Records.push({
    year,
    make: 'Ford',
    model: 'Focus',
    submodel: 'Base',
    bolt_pattern: '5x108',
    centerbore: 63.4,
    offset_min: 45,
    offset_max: 55,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x7', '17x7', '18x8'],
    oem_tire_sizes: ['215/55R16', '215/50R17', '235/40R18'],
  });
}

// =============================================================================
// FORD FUSION (2006-2020)
// =============================================================================

// Gen 1: 2006-2012 - 5x114.3, 67.1mm CB
for (let year = 2006; year <= 2012; year++) {
  batch2Records.push({
    year,
    make: 'Ford',
    model: 'Fusion',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 40,
    offset_max: 52,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7', '17x7.5'],
    oem_tire_sizes: ['205/60R16', '225/50R17'],
  });
}

// Gen 2: 2013-2020 - CHANGED to 5x108, 63.4mm CB
for (let year = 2013; year <= 2020; year++) {
  batch2Records.push({
    year,
    make: 'Ford',
    model: 'Fusion',
    submodel: 'Base',
    bolt_pattern: '5x108',
    centerbore: 63.4,
    offset_min: 45,
    offset_max: 55,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['17x7.5', '18x8', '19x8.5'],
    oem_tire_sizes: ['225/50R17', '235/45R18', '235/40R19'],
  });
}

// =============================================================================
// MAZDA3 (2004-2013)
// =============================================================================

// Gen 1: 2004-2009 - 5x114.3, 67.1mm CB
for (let year = 2004; year <= 2009; year++) {
  batch2Records.push({
    year,
    make: 'Mazda',
    model: 'Mazda3',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 45,
    offset_max: 55,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['15x6', '16x6.5', '17x7'],
    oem_tire_sizes: ['195/65R15', '205/55R16', '205/50R17'],
  });
}

// Gen 2: 2010-2013 - 5x114.3, 67.1mm CB
for (let year = 2010; year <= 2013; year++) {
  batch2Records.push({
    year,
    make: 'Mazda',
    model: 'Mazda3',
    submodel: 'Base',
    bolt_pattern: '5x114.3',
    centerbore: 67.1,
    offset_min: 45,
    offset_max: 55,
    thread_size: 'M12x1.5',
    seat_type: 'conical',
    oem_wheel_sizes: ['16x6.5', '17x7', '18x7.5'],
    oem_tire_sizes: ['205/55R16', '205/50R17', '215/45R18'],
  });
}

async function main() {
  console.log('═'.repeat(70));
  console.log('BATCH 2: COMMERCIAL COVERAGE GAP FILL');
  console.log('═'.repeat(70));
  console.log(`\nRecords to add: ${batch2Records.length}\n`);

  // Check for existing records to avoid duplicates
  let added = 0;
  let skipped = 0;

  for (const rec of batch2Records) {
    const existing = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, rec.year),
          eq(vehicleFitments.make, rec.make),
          eq(vehicleFitments.model, rec.model),
          eq(vehicleFitments.submodel, rec.submodel)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(vehicleFitments).values(rec);
    added++;
  }

  console.log(`\n✅ Added: ${added}`);
  console.log(`⏭️  Skipped (already exist): ${skipped}`);

  // Summary by vehicle
  const summary: Record<string, number> = {};
  for (const rec of batch2Records) {
    const key = `${rec.make} ${rec.model}`;
    summary[key] = (summary[key] || 0) + 1;
  }

  console.log('\n📊 Records by Vehicle:');
  for (const [vehicle, count] of Object.entries(summary)) {
    console.log(`   ${vehicle}: ${count} years`);
  }

  // Verify final count
  const total = await db.select().from(vehicleFitments);
  console.log(`\n📈 Total records in database: ${total.length}`);
  
  process.exit(0);
}

main().catch(console.error);
