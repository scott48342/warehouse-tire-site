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
  // Check 2024 Trax
  const trax = await client`
    SELECT year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE year = 2024 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax'
  `;
  console.log('2024 Chevy Trax records:', trax.length);
  trax.forEach(x => console.log(`  ${x.display_trim}: tires=${JSON.stringify(x.oem_tire_sizes)} wheels=${JSON.stringify(x.oem_wheel_sizes)}`));
  
  // Check 2022 Encore GX  
  const encoreGx = await client`
    SELECT year, make, model, display_trim, oem_tire_sizes, oem_wheel_sizes
    FROM vehicle_fitments 
    WHERE year = 2022 AND LOWER(make) = 'buick' AND LOWER(model) = 'encore gx'
  `;
  console.log('\n2022 Buick Encore GX records:', encoreGx.length);
  encoreGx.forEach(x => console.log(`  ${x.display_trim}: tires=${JSON.stringify(x.oem_tire_sizes)} wheels=${JSON.stringify(x.oem_wheel_sizes)}`));
  
  await client.end();
})();
