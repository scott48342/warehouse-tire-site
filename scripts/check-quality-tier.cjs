const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const client = postgres(process.env.POSTGRES_URL);

(async () => {
  // Check Encore GX quality tier
  const records = await client`
    SELECT year, make, model, display_trim, quality_tier, 
           bolt_pattern, oem_wheel_sizes, oem_tire_sizes
    FROM vehicle_fitments 
    WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
  `;
  
  console.log('2022 Buick Encore GX records:');
  records.forEach(r => {
    console.log(`\n  ${r.display_trim}:`);
    console.log(`    quality_tier: ${r.quality_tier}`);
    console.log(`    bolt_pattern: ${r.bolt_pattern}`);
    console.log(`    oem_wheel_sizes: ${JSON.stringify(r.oem_wheel_sizes)}`);
    console.log(`    oem_tire_sizes: ${JSON.stringify(r.oem_tire_sizes)}`);
  });
  
  // Also check if quality_tier calculation would give different result
  console.log('\n--- Quality tier assessment ---');
  for (const r of records) {
    const hasWheels = Array.isArray(r.oem_wheel_sizes) && r.oem_wheel_sizes.length > 0 &&
      r.oem_wheel_sizes.some(w => w.diameter && w.width);
    const hasTires = Array.isArray(r.oem_tire_sizes) && r.oem_tire_sizes.length > 0 &&
      r.oem_tire_sizes.some(ts => /^\d{3}\/\d{2}R\d{2}/.test(ts));
    const hasBolt = Boolean(r.bolt_pattern);
    
    const expectedTier = (hasWheels && hasTires && hasBolt) ? 'complete' :
                         (hasTires && hasBolt) ? 'partial' : 'low_confidence';
    
    console.log(`  ${r.display_trim}: stored=${r.quality_tier}, expected=${expectedTier}`);
    console.log(`    hasWheels=${hasWheels}, hasTires=${hasTires}, hasBolt=${hasBolt}`);
  }
  
  await client.end();
})();
