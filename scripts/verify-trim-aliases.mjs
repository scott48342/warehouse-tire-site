import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

console.log("═══════════════════════════════════════════════════════════════");
console.log("          TRIM ALIAS VERIFICATION - QA Failure Cases");
console.log("═══════════════════════════════════════════════════════════════\n");

const cases = [
  { year: 2024, make: 'Ford', model: 'Escape', searchTrim: 'Base' },
  { year: 2024, make: 'Audi', model: 'S4', searchTrim: 'Premium' },
  { year: 2024, make: 'Mercedes-Benz', model: 'C-Class', searchTrim: 'AMG C 43' },
  { year: 2024, make: 'Honda', model: 'Accord', searchTrim: 'Hybrid' },
  { year: 2024, make: 'BMW', model: 'M3', searchTrim: 'Base' },
  { year: 2024, make: 'BMW', model: 'M4', searchTrim: 'Base' },
  { year: 2022, make: 'Subaru', model: 'Impreza', searchTrim: 'Base' },
  { year: 2024, make: 'Hyundai', model: 'Ioniq 5', searchTrim: 'SE' },
  { year: 2024, make: 'Ford', model: 'Mustang Mach-E', searchTrim: 'Select' },
  { year: 2023, make: 'Mazda', model: 'Mazda3', searchTrim: 'Select' },
  { year: 2023, make: 'Nissan', model: 'Frontier', searchTrim: 'SV' },
];

for (const { year, make, model, searchTrim } of cases) {
  console.log(`\n${year} ${make} ${model} — Customer searches: "${searchTrim}"`);
  console.log("─".repeat(60));
  
  const trims = await sql`
    SELECT display_trim, modification_id, 
           oem_tire_sizes IS NOT NULL as has_tires,
           bolt_pattern IS NOT NULL as has_bolt
    FROM vehicle_fitments 
    WHERE year = ${year} 
      AND make ILIKE ${make} 
      AND (model ILIKE ${model} OR model ILIKE ${model.replace('-', ' ')} OR model ILIKE ${model.replace(' ', '')})
      AND certification_status = 'certified'
    ORDER BY display_trim
  `;
  
  if (trims.length === 0) {
    console.log(`  ❌ No records found for this vehicle`);
  } else {
    console.log(`  Available trims (${trims.length}):`);
    for (const t of trims) {
      const exact = t.display_trim.toLowerCase() === searchTrim.toLowerCase();
      const partial = t.display_trim.toLowerCase().includes(searchTrim.toLowerCase());
      const marker = exact ? '✅ EXACT' : partial ? '🔶 PARTIAL' : '';
      console.log(`    - "${t.display_trim}" ${marker}`);
    }
    
    // Suggest alias
    const exactMatch = trims.find(t => t.display_trim.toLowerCase() === searchTrim.toLowerCase());
    const partialMatch = trims.find(t => t.display_trim.toLowerCase().includes(searchTrim.toLowerCase()));
    
    if (!exactMatch && partialMatch) {
      console.log(`\n  📌 SUGGESTED ALIAS: "${searchTrim}" → "${partialMatch.display_trim}"`);
    } else if (!exactMatch && trims.length === 1) {
      console.log(`\n  📌 SUGGESTED ALIAS: "${searchTrim}" → "${trims[0].display_trim}" (only trim available)`);
    } else if (!exactMatch) {
      console.log(`\n  ⚠️ No obvious alias - needs manual review`);
    }
  }
}

await sql.end();
console.log("\n═══════════════════════════════════════════════════════════════");
