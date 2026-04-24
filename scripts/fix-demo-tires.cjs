const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Read .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const client = postgres(process.env.POSTGRES_URL);

// Tire sizes to add for demo vehicles
const FIXES = [
  {
    year: 2022,
    make: 'Buick', 
    model: 'Encore GX',
    trim: 'Preferred',
    tireSizes: ['225/55R18'],
    source: 'Buick specs - 18" wheel standard'
  },
  {
    year: 2022,
    make: 'Buick',
    model: 'Encore GX', 
    trim: 'Essence',
    tireSizes: ['225/55R18'],
    source: 'Buick specs'
  },
  {
    year: 2022,
    make: 'Buick',
    model: 'Encore GX',
    trim: 'Avenir',
    tireSizes: ['245/45R19'],
    source: 'Buick specs - 19" wheel on Avenir'
  },
  {
    year: 2024,
    make: 'Chevrolet',
    model: 'Trax',
    trim: 'LT',
    tireSizes: ['215/55R17'],
    source: 'Chevy specs - 17" on LT'
  },
  {
    year: 2024,
    make: 'Chevrolet',
    model: 'Trax',
    trim: 'LS',
    tireSizes: ['205/65R16'],
    source: 'Chevy specs - 16" on base'
  },
  {
    year: 2024,
    make: 'Chevrolet',
    model: 'Trax',
    trim: 'RS',
    tireSizes: ['215/55R17'],
    source: 'Chevy specs - 17" on RS'
  },
  // Also add 2023+ Encore GX years
  {
    year: 2023,
    make: 'Buick',
    model: 'Encore GX',
    trim: null, // all trims
    tireSizes: ['225/55R18', '245/45R19'],
    source: 'Buick specs'
  },
  {
    year: 2024,
    make: 'Buick',
    model: 'Encore GX',
    trim: null,
    tireSizes: ['225/55R18', '245/45R19'],
    source: 'Buick specs'
  },
];

async function fix() {
  console.log('Fixing demo vehicle tire sizes...\n');
  
  for (const fix of FIXES) {
    const { year, make, model, trim, tireSizes } = fix;
    
    // Build query
    let query;
    if (trim) {
      query = client`
        UPDATE vehicle_fitments 
        SET oem_tire_sizes = ${JSON.stringify(tireSizes)}::jsonb,
            updated_at = NOW()
        WHERE year = ${year}
          AND LOWER(make) = LOWER(${make})
          AND LOWER(model) = LOWER(${model})
          AND LOWER(display_trim) = LOWER(${trim})
          AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
        RETURNING year, make, model, display_trim
      `;
    } else {
      query = client`
        UPDATE vehicle_fitments 
        SET oem_tire_sizes = ${JSON.stringify(tireSizes)}::jsonb,
            updated_at = NOW()
        WHERE year = ${year}
          AND LOWER(make) = LOWER(${make})
          AND LOWER(model) = LOWER(${model})
          AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
        RETURNING year, make, model, display_trim
      `;
    }
    
    const updated = await query;
    
    if (updated.length > 0) {
      console.log(`✓ ${year} ${make} ${model} ${trim || '(all trims)'}: ${updated.length} records → ${tireSizes.join(', ')}`);
    } else {
      console.log(`- ${year} ${make} ${model} ${trim || '(all trims)'}: no records needed update`);
    }
  }
  
  // Verify
  console.log('\n--- Verification ---');
  const verify = await client`
    SELECT year, make, model, display_trim, oem_tire_sizes
    FROM vehicle_fitments
    WHERE (LOWER(make) = 'buick' AND LOWER(model) = 'encore gx')
       OR (LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax')
    ORDER BY year DESC, make, model, display_trim
  `;
  
  verify.forEach(r => {
    const sizes = r.oem_tire_sizes ? JSON.stringify(r.oem_tire_sizes) : '[]';
    console.log(`  ${r.year} ${r.make} ${r.model} ${r.display_trim}: ${sizes}`);
  });
  
  await client.end();
  console.log('\nDone!');
}

fix().catch(e => { console.error(e); process.exit(1); });
