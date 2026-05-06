// Check 2015 Chevrolet Traverse fitment configurations
import { db } from '../src/lib/fitment-db/db.js';
import { vehicleFitmentConfigurations, vehicleFitments } from '../src/lib/fitment-db/schema.js';
import { eq, and, like } from 'drizzle-orm';

async function main() {
  console.log('=== Checking 2015 Chevrolet Traverse ===\n');
  
  // Check vehicle_fitment_configurations table
  const configs = await db
    .select()
    .from(vehicleFitmentConfigurations)
    .where(
      and(
        eq(vehicleFitmentConfigurations.year, 2015),
        eq(vehicleFitmentConfigurations.makeKey, 'chevrolet'),
        eq(vehicleFitmentConfigurations.modelKey, 'traverse')
      )
    );
  
  console.log('vehicle_fitment_configurations rows:', configs.length);
  if (configs.length > 0) {
    console.log(JSON.stringify(configs, null, 2));
  }
  
  // Check vehicle_fitments table
  const fitments = await db
    .select()
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, 2015),
        eq(vehicleFitments.make, 'chevrolet'),
        eq(vehicleFitments.model, 'traverse')
      )
    );
  
  console.log('\nvehicle_fitments rows:', fitments.length);
  if (fitments.length > 0) {
    for (const f of fitments) {
      console.log(`\n  Trim: ${f.displayTrim} (${f.modificationId})`);
      console.log(`  OEM Tire Sizes: ${JSON.stringify(f.oemTireSizes)}`);
      console.log(`  OEM Wheel Sizes: ${JSON.stringify(f.oemWheelSizes)}`);
    }
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
