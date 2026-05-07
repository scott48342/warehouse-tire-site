/**
 * Add 2024 Nissan Frontier fitment data
 * 
 * Source: wheel-size.com screenshot
 * Bolt: 6x114.3, Hub: 66.1mm, Thread: M12x1.25, Offset: +30
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FRONTIER_FITMENTS = [
  // PRO-X (the one failing QA)
  { trim: 'PRO-X', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // PRO-4X
  { trim: 'PRO-4X', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // Hardbody Edition
  { trim: 'Hardbody Edition', tireSize: '265/70R17', wheelSize: '17x7.5' },
  // SL
  { trim: 'SL', tireSize: '265/65R17', wheelSize: '17x7.5' },
  // SV
  { trim: 'SV', tireSize: '265/65R17', wheelSize: '17x7.5' },
  // S (16" base)
  { trim: 'S', tireSize: '265/70R16', wheelSize: '16x7' },
];

// Common specs for all 2024 Frontier
const COMMON_SPECS = {
  year: 2024,
  make: 'Nissan',
  model: 'Frontier',
  boltPattern: '6x114.3',
  hubBore: 66.1,
  threadSize: 'M12x1.25',
  offset: 30,
  offsetMin: 25,
  offsetMax: 35,
};

async function addFrontierFitment() {
  console.log('Adding 2024 Nissan Frontier fitment data...\n');

  for (const fitment of FRONTIER_FITMENTS) {
    // Parse wheel size
    const wheelMatch = fitment.wheelSize.match(/(\d+)x([\d.]+)/);
    const wheelDiameter = wheelMatch ? parseInt(wheelMatch[1]) : 17;
    const wheelWidth = wheelMatch ? parseFloat(wheelMatch[2]) : 7.5;

    // Parse tire size for diameter range
    const tireMatch = fitment.tireSize.match(/(\d+)\/(\d+)R(\d+)/);
    let tireDiameter = wheelDiameter;
    if (tireMatch) {
      const width = parseInt(tireMatch[1]);
      const aspect = parseInt(tireMatch[2]);
      const rim = parseInt(tireMatch[3]);
      tireDiameter = Math.round((width * aspect / 100 * 2 / 25.4) + rim);
    }

    const record = {
      year: COMMON_SPECS.year,
      make: COMMON_SPECS.make,
      model: COMMON_SPECS.model,
      trim: fitment.trim,
      bolt_pattern: COMMON_SPECS.boltPattern,
      hub_bore: COMMON_SPECS.hubBore,
      thread_size: COMMON_SPECS.threadSize,
      offset_min: COMMON_SPECS.offsetMin,
      offset_max: COMMON_SPECS.offsetMax,
      wheel_diameter_min: wheelDiameter,
      wheel_diameter_max: wheelDiameter + 3, // Allow +3" for aftermarket
      wheel_width_min: wheelWidth,
      wheel_width_max: wheelWidth + 2, // Allow +2" for aftermarket
      tire_diameter_min: tireDiameter,
      tire_diameter_max: tireDiameter + 4, // Allow bigger tires for lifted
      oem_tire_size: fitment.tireSize,
      oem_wheel_size: fitment.wheelSize,
    };

    try {
      // Check if exists
      const existing = await prisma.vehicle_fitments.findFirst({
        where: {
          year: record.year,
          make: record.make,
          model: record.model,
          trim: record.trim,
        },
      });

      if (existing) {
        console.log(`  ⏭️  ${record.trim} already exists, updating...`);
        await prisma.vehicle_fitments.update({
          where: { id: existing.id },
          data: record,
        });
      } else {
        await prisma.vehicle_fitments.create({ data: record });
        console.log(`  ✅ Added ${record.year} ${record.make} ${record.model} ${record.trim}`);
      }
    } catch (err) {
      console.error(`  ❌ Error adding ${record.trim}:`, err);
    }
  }

  console.log('\nDone!');
}

addFrontierFitment()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
