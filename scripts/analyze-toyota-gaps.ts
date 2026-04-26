import { readFileSync } from 'fs';

// Analyze the actual data gaps
const data = JSON.parse(readFileSync('scripts/toyota-missing.json', 'utf-8'));

interface Record {
  id: string;
  year: number;
  make: string;
  model: string;
  display_trim: string;
  modification_id: string;
  oem_wheel_sizes: any;
  oem_tire_sizes: any;
  quality_tier: string;
  source: string;
}

const byModel: Record<string, Record[]> = {};
for (const r of data) {
  if (!byModel[r.model]) byModel[r.model] = [];
  byModel[r.model].push(r);
}

console.log('=== ANALYSIS OF TOYOTA GAPS ===\n');

for (const [model, records] of Object.entries(byModel)) {
  console.log(`\n=== ${model} (${records.length} records) ===`);
  
  // Check what's actually missing
  const noTires = records.filter(r => !r.oem_tire_sizes || r.oem_tire_sizes.length === 0);
  const noWheels = records.filter(r => !r.oem_wheel_sizes || r.oem_wheel_sizes.length === 0);
  const hasButIncomplete = records.filter(r => 
    r.oem_tire_sizes?.length > 0 && r.quality_tier !== 'complete'
  );
  
  console.log(`  No tire sizes: ${noTires.length}`);
  console.log(`  No wheel sizes: ${noWheels.length}`);
  console.log(`  Has data but not marked complete: ${hasButIncomplete.length}`);
  
  // Sample some records
  const sample = records.slice(0, 3);
  for (const r of sample) {
    console.log(`    ${r.year} ${r.display_trim}:`, {
      wheels: r.oem_wheel_sizes,
      tires: r.oem_tire_sizes,
      tier: r.quality_tier
    });
  }
}
